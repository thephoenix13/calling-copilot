# Recruiter Call App

A browser-based calling app with live transcription. Recruiters can dial candidates directly from their browser, see a live transcript as the conversation happens, and get recordings + transcripts saved automatically.

---

## How it works

```
Browser (React)
  └─ Twilio Voice SDK  ──calls──▶  Twilio Cloud
                                       │
                          /voice webhook (ngrok → your laptop)
                                       │
                               Node.js backend
                                  │        │
                           Deepgram WS   recordings/
                           (live transcript)  transcripts/
                                  │
                           Socket.io ──live text──▶ Browser
```

---

## Prerequisites

Install these before starting:

1. **Node.js** (v18+): https://nodejs.org
2. **ngrok** (free account): https://ngrok.com/download
   - After installing, authenticate once: `ngrok config add-authtoken YOUR_TOKEN`

---

## First-time setup (run once)

### Step 1 — Install backend dependencies

```bash
cd server
npm install
cd ..
```

### Step 2 — Install frontend dependencies

```bash
cd client
npm install
cd ..
```

### Step 3 — Install setup script dependency

```bash
npm init -y
npm install twilio dotenv
```

> You only need this in the root folder for the setup script.

### Step 4 — Start ngrok

Open a **new terminal window** and run:

```bash
ngrok http 3000
```

You'll see output like:

```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

**Copy the `https://` URL** — you'll need it in the next step.

### Step 5 — Run setup

Back in your main terminal:

```bash
node setup.js
```

Paste your ngrok URL when prompted. This will:
- Create a Twilio API Key (for browser tokens)
- Create a Twilio TwiML App (so Twilio knows to call your `/voice` webhook)
- Save everything to `.env`

---

## Starting the app

You need **two terminals** running at the same time:

**Terminal 1 — Backend:**
```bash
cd server
npm start
```

You should see:
```
🚀 Server running at http://localhost:3000
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```

You should see:
```
Local: http://localhost:5173
```

**Open http://localhost:5173 in your browser.**

The browser will ask for microphone permission — click **Allow**.

---

## Making a call

1. Type a phone number in E.164 format (e.g. `+15551234567`)
   - Or click the dialpad keys to build the number
2. Click **📞 Call**
3. Watch the transcript appear on the right as the candidate speaks
4. Click **📵 Hang Up** to end the call

After the call ends:
- Recording is saved to `/recordings/` as an MP3
- Transcript is saved to `/transcripts/` as a TXT file

---

## Every time you restart ngrok

ngrok gives you a **new URL each time** (on the free plan). When you restart it:

1. Stop the backend server (Ctrl+C)
2. Run `node setup.js` again with the new URL
3. Restart the backend: `cd server && npm start`

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Missing TWILIO_API_KEY" error | Run `node setup.js` first |
| "Device not ready" in browser | Check that the backend is running on port 3000 |
| No transcript appears | Check ngrok is running and the URL in `.env` is current |
| TWILIO_ACCOUNT_SID auth error | Your Account SID should start with `AC`. Log in to console.twilio.com → copy the SID from the dashboard top-right |
| Microphone blocked | Click the lock icon in your browser's address bar → allow microphone |
| Recording not saved | Check the terminal for download errors; Twilio takes ~1 min after hang-up |

---

## File structure

```
recruiter-call-app/
├── .env                        ← credentials (never commit this)
├── setup.js                    ← one-time setup script
├── recordings/                 ← MP3 files saved here after each call
├── transcripts/                ← TXT files saved here after each call
├── server/
│   ├── index.js                ← Express + WebSocket + Socket.io server
│   └── routes/
│       ├── token.js            ← issues Twilio access tokens to browser
│       └── voice.js            ← Twilio webhook: returns TwiML for calls
└── client/
    └── src/
        ├── App.jsx             ← main app component
        └── components/
            ├── Dialpad.jsx     ← phone keypad UI
            ├── CallStatus.jsx  ← status indicator
            └── Transcript.jsx  ← live transcript display
```
