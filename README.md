# Golden Eagle — Demo (Ready-to-upload repository)

This repo is a **production-ready skeleton** for the Golden Eagle Aviator-style betting app.
It implements a demo/full-feature skeleton where **deposits and withdrawals are manual** (admin approves).

## What's included
- `/server` — Node.js + Express backend (MongoDB) with admin endpoints
- `/app` — Expo React Native app (simple UI, eagle animation, bet/cashout, deposit/withdraw requests)
- `/app/.github/workflows/android-build.yml` — GitHub Actions workflow to build Android debug APK

## Quick start (local)
1. Start MongoDB locally.
2. Run server:
   ```
   cd server
   npm install
   cp .env.example .env
   # edit .env if needed
   node server.js
   ```
3. Run app (dev):
   ```
   cd app
   npm install
   expo start
   ```
   Edit `app/App.js` and replace `API` with your server URL (use ngrok for phone testing).

## Build APK via GitHub Actions
1. Create a GitHub repo and push the entire project.
2. In GitHub Actions, run the workflow **Build Android Debug APK** (or push to `main`).
3. When finished, download artifact `GoldenEagle-APK` from Actions -> Artifacts.

## Admin usage (manual deposit/withdraw)
- Admin header: set `x-user-email` header to `zee9t9zoo@gmail.com` to access admin endpoints.
- Deposit flow (manual):
  - User POST `/deposit/request` → server returns reference and message.
  - User sends money manually to Easypaisa: `03228829471` using the reference.
  - Admin GET `/admin/deposits` and POST `/admin/deposit/approve` with `reqId` to credit the user.
- Withdraw flow (manual):
  - User POST `/withdraw/request` (balance reserved).
  - Admin pays user manually and POST `/admin/withdraw/mark-paid` with `reqId` to mark paid.

## Commission
- Commission (10%) is taken at cashout time (10% of bet amount) and stored in `commissions` collection.
- Admin can GET `/admin/commission/report` to see total commission for admin email.

## NOTE (LEGAL & SECURITY)
- This is a demo/production skeleton. Before going live with real money:
  - Ensure you have the correct license and comply with local laws.
  - Use HTTPS, secure auth, input validation, rate limiting and DB transactions for financial operations.
  - Payment provider integrations require merchant accounts and their docs.
