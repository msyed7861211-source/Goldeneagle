import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Animated, Image, ScrollView } from 'react-native';
import axios from 'axios';

const API = 'http://YOUR_SERVER_IP:3000'; // <-- replace with your server URL or ngrok URL

export default function App(){
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState('10');
  const [log, setLog] = useState([]);
  const eagleX = useRef(new Animated.Value(10)).current;
  const [roundId, setRoundId] = useState('');
  const userEmail = 'player1@test.com';

  useEffect(()=>{
    (async ()=>{
      try{
        await axios.post(`${API}/setup/user`, { email: userEmail });
        const r = await axios.post(`${API}/admin/round/start`, {}, { headers: { 'x-user-email': 'zee9t9zoo@gmail.com' }});
        setRoundId(r.data.roundId || r.data._id || 'R' + Date.now());
        const me = await axios.get(`${API}/me`, { headers: { 'x-user-email': userEmail }});
        setBalance(me.data.balance || 0);
      }catch(e){
        console.log('init error', e.message);
      }
    })();
  }, []);

  function animateEagle(){
    eagleX.setValue(10);
    Animated.timing(eagleX, {
      toValue: 300,
      duration: 7000,
      useNativeDriver: false
    }).start();
  }

  async function placeBet(){
    const amt = Number(bet);
    if(amt <= 0 || amt > balance){ alert('Invalid bet or insufficient balance'); return; }
    try{
      const res = await axios.post(`${API}/bet/place`, { roundId, amount: amt }, { headers: { 'x-user-email': userEmail }});
      setLog(prev => [`Placed ${amt}`, ...prev]);
      setBalance(prev => +(prev - amt).toFixed(2));
      animateEagle();
    }catch(e){
      alert('bet error: ' + (e.response?.data || e.message));
    }
  }

  async function cashout(){
    try{
      const multiplier = +(1 + Math.random()*5).toFixed(2);
      const res = await axios.post(`${API}/bet/cashout`, { betId: '', multiplier }, { headers: { 'x-user-email': userEmail }});
      if(res.data && res.data.balance !== undefined){
        setBalance(res.data.balance);
        setLog(prev => [`Cashed x${multiplier} -> +${res.data.net}`, ...prev]);
      } else {
        const payout = Number(bet) * multiplier;
        const commission = +(Number(bet) * 0.10).toFixed(2);
        const net = +(payout - commission).toFixed(2);
        setBalance(prev => +(prev + net).toFixed(2));
        setLog(prev => [`Cashed locally x${multiplier} -> +${net}`, ...prev]);
      }
    }catch(e){
      alert('cashout error');
    }
  }

  async function createDeposit(){
    try{
      const res = await axios.post(`${API}/deposit/request`, { amount: 100, method: 'easypaisa', note: 'test deposit' }, { headers: { 'x-user-email': userEmail }});
      alert(res.data.message);
    }catch(e){ alert('deposit req failed'); }
  }

  async function createWithdraw(){
    try{
      const res = await axios.post(`${API}/withdraw/request`, { amount: 50, method: 'easypaisa', details: { msisdn: '03XXXXXXXXX' } }, { headers: { 'x-user-email': userEmail }});
      alert('Withdraw request created; admin will pay manually and then approve.');
      setBalance(prev => +(prev - 50).toFixed(2));
    }catch(e){ alert('withdraw req failed'); }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Golden Eagle — Demo</Text>
      <View style={styles.hud}>
        <Text>Balance: ₨ {balance}</Text>
        <Text>Admin: zee9t9zoo@gmail.com</Text>
      </View>

      <View style={styles.canvas}>
        <Animated.Image source={{ uri: 'https://i.imgur.com/3WwGQXr.png' }} style={[styles.eagle, { left: eagleX }]} />
      </View>

      <View style={styles.controls}>
        <TextInput keyboardType="numeric" value={bet} onChangeText={setBet} style={styles.input} />
        <TouchableOpacity style={styles.btn} onPress={placeBet}><Text style={styles.btnt}>Place Bet</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor:'#f6c' }]} onPress={cashout}><Text style={styles.btnt}>Cashout</Text></TouchableOpacity>
      </View>

      <View style={{marginTop:12}}>
        <TouchableOpacity style={styles.smallBtn} onPress={createDeposit}><Text>Create Deposit Request (Manual)</Text></TouchableOpacity>
        <TouchableOpacity style={styles.smallBtn} onPress={createWithdraw}><Text>Create Withdraw Request</Text></TouchableOpacity>
      </View>

      <View style={styles.log}>
        {log.map((l,i)=> <Text key={i} style={{fontSize:12}}>• {l}</Text>)}
      </View>

      <View style={{marginTop:20}}>
        <Text style={{fontSize:12,color:'#666'}}>Send manual deposits to Easypaisa: 03228829471 (use deposit reference shown in app).</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:{ padding:18, backgroundColor:'#fff', minHeight:800 },
  title:{ fontSize:22, fontWeight:'700', marginBottom:10 },
  hud:{ flexDirection:'row', justifyContent:'space-between', marginBottom:10 },
  canvas:{ height:180, borderWidth:1, borderColor:'#ddd', borderRadius:8, backgroundColor:'#fdfdfd', overflow:'hidden' },
  eagle:{ width:64, height:64, position:'absolute', bottom:10 },
  controls:{ flexDirection:'row', alignItems:'center', marginTop:12 },
  input:{ width:100, borderWidth:1, padding:8, marginRight:8, borderRadius:6 },
  btn:{ padding:10, backgroundColor:'#2e86de', borderRadius:6, marginRight:8 },
  btnt:{ color:'#fff', fontWeight:'700' },
  smallBtn:{ marginTop:8, padding:10, borderWidth:1, borderRadius:6, alignItems:'center' },
  log:{ marginTop:12 }
});
