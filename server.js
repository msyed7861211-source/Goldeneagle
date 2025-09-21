// server/server.js
// Run: cd server && npm install && node server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());
const PORT = process.env.PORT || 3000;

// Connect DB
const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/goldeneagle';
mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });

// Schemas
const UserSchema = new mongoose.Schema({
  email: String,
  phone: String,
  balance: { type: Number, default: 0 },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const BetSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  roundId: String,
  amount: Number,
  cashedOut: { type: Boolean, default: false },
  cashedAtMultiplier: { type: Number, default: 0 },
  resultPaid: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const RoundSchema = new mongoose.Schema({
  roundId: String,
  multiplierAtCrash: Number,
  finished: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const CommissionSchema = new mongoose.Schema({
  adminEmail: String,
  amount: Number,
  roundId: String,
  createdAt: { type: Date, default: Date.now }
});
const DepositReqSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  amount: Number,
  method: String,
  note: String,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});
const WithdrawReqSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  amount: Number,
  method: String,
  details: Object,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Bet = mongoose.model('Bet', BetSchema);
const Round = mongoose.model('Round', RoundSchema);
const Commission = mongoose.model('Commission', CommissionSchema);
const DepositReq = mongoose.model('DepositReq', DepositReqSchema);
const WithdrawReq = mongoose.model('WithdrawReq', WithdrawReqSchema);

// Helper: random multiplier (demo purpose)
function randomMultiplier() {
  const p = Math.random();
  if (p < 0.6) return +(1 + Math.random()*1.5).toFixed(2);
  if (p < 0.9) return +(2.5 + Math.random()*5).toFixed(2);
  return +(7.5 + Math.random()*50).toFixed(2);
}

// Simple auth middleware via header x-user-email (DEMO only)
app.use(async (req, res, next) => {
  const em = req.header('x-user-email');
  if (em) {
    let u = await User.findOne({ email: em });
    if (!u) {
      u = await User.create({ email: em, isAdmin: em === process.env.ADMIN_EMAIL, balance: 0 });
    }
    req.user = u;
  }
  next();
});

// Routes

// Public: create test user /get profile
app.get('/me', async (req,res)=> {
  if(!req.user) return res.status(401).send('login required (set x-user-email header)');
  res.json(req.user);
});

// Admin: start a round
app.post('/admin/round/start', async (req,res)=>{
  if(!req.user || !req.user.isAdmin) return res.status(403).send('admin only');
  const roundId = 'R' + Date.now();
  const r = await Round.create({ roundId });
  res.json(r);
});

// Place bet
app.post('/bet/place', async (req,res)=>{
  if(!req.user) return res.status(401).send('login required');
  const { roundId, amount } = req.body;
  if(!roundId || !amount) return res.status(400).send('roundId & amount required');
  if(req.user.balance < amount) return res.status(400).send('insufficient balance');
  req.user.balance -= Number(amount);
  await req.user.save();
  const bet = await Bet.create({ userId: req.user._id, roundId, amount });
  res.json({ ok:true, bet });
});

// Cashout endpoint (user triggers cashout at multiplier)
app.post('/bet/cashout', async (req,res)=>{
  if(!req.user) return res.status(401).send('login required');
  const { betId, multiplier } = req.body;
  const bet = await Bet.findById(betId);
  if(!bet) return res.status(404).send('bet not found');
  if(String(bet.userId) !== String(req.user._id)) return res.status(403).send('not your bet');
  if(bet.cashedOut) return res.status(400).send('already cashed');
  bet.cashedOut = true; bet.cashedAtMultiplier = Number(multiplier || 1);
  await bet.save();

  // compute payout & commission
  const payout = +(bet.amount * bet.cashedAtMultiplier).toFixed(2);
  const commission = +(bet.amount * 0.10).toFixed(2); // 10% of bet amount
  const net = +(payout - commission).toFixed(2);

  req.user.balance += net;
  await req.user.save();
  await Commission.create({ adminEmail: process.env.ADMIN_EMAIL, amount: commission, roundId: bet.roundId });

  res.json({ ok:true, payout, commission, net, balance: req.user.balance });
});

// Admin finishes round (calculates crash and marks unresolved bets as lost)
app.post('/admin/round/finish', async (req,res)=>{
  if(!req.user || !req.user.isAdmin) return res.status(403).send('admin only');
  const { roundId } = req.body;
  const round = await Round.findOne({ roundId });
  if(!round) return res.status(404).send('round not found');
  if(round.finished) return res.status(400).send('already finished');
  const crash = randomMultiplier();
  round.multiplierAtCrash = crash;
  round.finished = true;
  await round.save();

  const bets = await Bet.find({ roundId });
  for(const b of bets){
    if(!b.cashedOut) {
      b.resultPaid = false; await b.save();
    } else {
      b.resultPaid = true; await b.save();
    }
  }
  res.json({ ok:true, round, processed: bets.length });
});

// Deposit request (user creates request -> admin approves later)
app.post('/deposit/request', async (req,res)=>{
  if(!req.user) return res.status(401).send('login required');
  const { amount, method, note } = req.body;
  const dr = await DepositReq.create({ userId: req.user._id, amount, method, note });
  // return bank/easypaisa info to user for manual transfer
  return res.json({
    ok:true,
    message: `Send payment manually to Easypaisa: 03228829471 or other account. Use reference: ${dr._id}`,
    depositRequest: dr
  });
});

// Admin: list deposit requests
app.get('/admin/deposits', async (req,res)=>{
  if(!req.user || !req.user.isAdmin) return res.status(403).send('admin only');
  const all = await DepositReq.find().populate('userId');
  res.json(all);
});

// Admin: approve deposit (credits user)
app.post('/admin/deposit/approve', async (req,res)=>{
  if(!req.user || !req.user.isAdmin) return res.status(403).send('admin only');
  const { reqId } = req.body;
  const dr = await DepositReq.findById(reqId);
  if(!dr) return res.status(404).send('request not found');
  if(dr.status !== 'pending') return res.status(400).send('already processed');
  dr.status = 'approved';
  await dr.save();
  const u = await User.findById(dr.userId);
  u.balance += Number(dr.amount);
  await u.save();
  res.json({ ok:true, user: u, deposit: dr });
});

// Withdraw request (user creates; admin approves -> admin will manually pay user outside the system)
app.post('/withdraw/request', async (req,res)=>{
  if(!req.user) return res.status(401).send('login required');
  const { amount, method, details } = req.body;
  if(req.user.balance < Number(amount)) return res.status(400).send('insufficient balance');
  req.user.balance -= Number(amount); // reserve funds immediately
  await req.user.save();
  const wr = await WithdrawReq.create({ userId: req.user._id, amount, method, details });
  res.json({ ok:true, message: 'Withdraw request created. Admin will manually pay you and then approve.', withdrawReq: wr });
});

// Admin: view withdraws
app.get('/admin/withdraws', async (req,res)=>{
  if(!req.user || !req.user.isAdmin) return res.status(403).send('admin only');
  const all = await WithdrawReq.find().populate('userId');
  res.json(all);
});

// Admin: mark withdraw paid (admin will manually send money to user's easypaisa/bank)
app.post('/admin/withdraw/mark-paid', async (req,res)=>{
  if(!req.user || !req.user.isAdmin) return res.status(403).send('admin only');
  const { reqId } = req.body;
  const wr = await WithdrawReq.findById(reqId);
  if(!wr) return res.status(404).send('not found');
  wr.status = 'paid';
  await wr.save();
  res.json({ ok:true, withdraw: wr });
});

// Admin: commission report
app.get('/admin/commission/report', async (req,res)=>{
  if(!req.user || !req.user.isAdmin) return res.status(403).send('admin only');
  const agg = await Commission.aggregate([
    { $match: { adminEmail: process.env.ADMIN_EMAIL } },
    { $group: { _id: '$adminEmail', total: { $sum: '$amount' } } }
  ]);
  res.json(agg[0] || { adminEmail: process.env.ADMIN_EMAIL, total: 0 });
});

// Create test user (for convenience)
app.post('/setup/user', async (req,res)=>{
  const { email, isAdmin } = req.body;
  const u = await User.findOneAndUpdate({ email }, { email, isAdmin: !!isAdmin }, { upsert:true, new:true });
  res.json(u);
});

app.listen(PORT, ()=> console.log('Server running on port', PORT));
