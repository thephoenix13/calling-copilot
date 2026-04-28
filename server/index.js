require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const expressWs = require('express-ws');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { db, seedUsers } = require('./db');

// ── App setup ──────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
expressWs(app, server);           // attaches .ws() to app, must come before routes

// Force polling transport — express-ws hijacks the server's WebSocket upgrade
// handler, which breaks Socket.io's WebSocket mode. Polling is equally
// responsive for small text payloads like transcript lines.
const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['polling'],
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Storage directories ────────────────────────────────────────────────────
const RECORDINGS_DIR = path.join(__dirname, '..', 'recordings');
const TRANSCRIPTS_DIR = path.join(__dirname, '..', 'transcripts');
fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });

// ── In-memory call state ────────────────────────────────────────────────────
// callSid -> { transcript: string[], deepgramConn }
const activeCalls = {};

// ── Deepgram client ─────────────────────────────────────────────────────────
const deepgramClient = createClient(process.env.DEEPGRAM_API_KEY);

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth',  require('./routes/auth'));
app.use('/token', require('./routes/token'));
app.use('/voice', require('./routes/voice'));
app.use('/ai',    require('./routes/ai'));
app.use('/calls',      require('./routes/calls'));
app.use('/admin',      require('./routes/admin'));
app.use('/jobs',        require('./routes/jobs'));
app.use('/candidates',  require('./routes/candidates'));
app.use('/enhance-jd',  require('./routes/enhance-jd'));
app.use('/sessions',    require('./routes/sessions'));

// ── Recording status webhook ────────────────────────────────────────────────
app.post('/recording-status', async (req, res) => {
  const { RecordingSid, RecordingUrl, RecordingStatus, CallSid } = req.body;
  console.log(`Recording status: ${RecordingStatus} | SID: ${RecordingSid}`);

  if (RecordingStatus === 'completed' && RecordingUrl) {
    try {
      const response = await axios.get(`${RecordingUrl}.mp3`, {
        responseType: 'arraybuffer',
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
      });

      const filename = `${CallSid || RecordingSid}_${Date.now()}.mp3`;
      const filepath = path.join(RECORDINGS_DIR, filename);
      fs.writeFileSync(filepath, Buffer.from(response.data));
      console.log(`✅ Recording saved: ${filepath}`);

      // Update call record in DB
      if (CallSid) {
        db.prepare(
          `UPDATE calls SET recording_filename = ?, recording_sid = ?, status = 'completed', ended_at = datetime('now')
           WHERE call_sid = ?`
        ).run(filename, RecordingSid || null, CallSid);
      }
    } catch (err) {
      console.error('❌ Failed to save recording:', err.message);
    }
  }

  res.sendStatus(200);
});

// ── Helper: create one Deepgram connection for a single audio track ───────────
function createDgConnection(speaker, callSidRef, onTranscript) {
  const state = { conn: null, ready: false, queue: [], sent: 0 };

  state.conn = deepgramClient.listen.live({
    model: 'nova-2',
    encoding: 'mulaw',
    sample_rate: 8000,
    channels: 1,
    interim_results: true,
    utterance_end_ms: 1000,
  });

  state.conn.on(LiveTranscriptionEvents.Open, () => {
    console.log(`🎙️  Deepgram [${speaker}] opened — flushing ${state.queue.length} buffered packets`);
    state.ready = true;
    state.queue.forEach((chunk) => state.conn.send(chunk));
    state.sent += state.queue.length;
    state.queue = [];
  });

  state.conn.on(LiveTranscriptionEvents.Transcript, (result) => {
    const alt = result?.channel?.alternatives?.[0];
    if (!alt?.transcript?.trim()) return;
    const text = alt.transcript.trim();
    const isFinal = result.is_final === true;
    console.log(`📝 [${speaker}] [${isFinal ? 'FINAL' : 'interim'}]: "${text}"`);
    onTranscript(text, isFinal, speaker);
  });

  state.conn.on(LiveTranscriptionEvents.Error, (err) => {
    console.error(`Deepgram [${speaker}] error:`, err);
  });

  state.conn.on(LiveTranscriptionEvents.Close, () => {
    console.log(`Deepgram [${speaker}] closed | packets sent: ${state.sent}`);
    state.ready = false;
  });

  return state;
}

// ── Twilio Media Stream WebSocket (/stream) ─────────────────────────────────
app.ws('/stream', (ws, req) => {
  console.log('🔌 Twilio media stream connected');

  let callSid = null;
  // One Deepgram connection per track: inbound = recruiter, outbound = candidate
  const tracks = {};  // 'inbound' | 'outbound' -> state object

  ws.on('message', (rawMsg) => {
    let data;
    try { data = JSON.parse(rawMsg); } catch { return; }

    switch (data.event) {
      case 'connected':
        console.log('Twilio stream: connected');
        break;

      case 'start': {
        callSid = data.start.callSid;
        console.log(`▶️  Stream started | CallSid: ${callSid}`);
        activeCalls[callSid] = { transcript: [] };

        const onTranscript = (text, isFinal, speaker) => {
          if (isFinal && activeCalls[callSid]) {
            activeCalls[callSid].transcript.push(`[${speaker}]: ${text}`);
          }
          io.emit('transcript', { text, isFinal, callSid, speaker });
        };

        // inbound  = audio from recruiter's browser → Twilio
        // outbound = audio from candidate's phone  → Twilio (then to recruiter)
        tracks['inbound']  = createDgConnection('Recruiter', callSid, onTranscript);
        tracks['outbound'] = createDgConnection('Candidate', callSid, onTranscript);
        break;
      }

      case 'media': {
        const trackName = data.media?.track || 'inbound';
        const state = tracks[trackName];
        if (!state) break;

        const chunk = Buffer.from(data.media.payload, 'base64');
        if (state.ready) {
          state.conn.send(chunk);
          state.sent++;
        } else if (state.queue.length < 500) {
          // Buffer up to ~12s of audio while Deepgram connection opens
          state.queue.push(chunk);
        }
        break;
      }

      case 'stop': {
        console.log(`⏹️  Stream stopped | CallSid: ${callSid}`);

        Object.values(tracks).forEach((state) => {
          if (state.conn) try { state.conn.requestClose(); } catch (_) {}
        });

        // Save transcript to flat file (backup) and to DB
        if (callSid && activeCalls[callSid]?.transcript.length > 0) {
          const lines = activeCalls[callSid].transcript;

          // Flat file backup
          try {
            const content = lines.join('\n');
            const filename = `${callSid}_${Date.now()}.txt`;
            fs.writeFileSync(path.join(TRANSCRIPTS_DIR, filename), content, 'utf8');
            console.log(`📝 Transcript saved: ${filename}`);
          } catch (err) {
            console.error('Failed to save transcript file:', err.message);
          }

          // DB — insert transcript rows if call record exists
          try {
            const callRow = db.prepare('SELECT id FROM calls WHERE call_sid = ?').get(callSid);
            if (callRow) {
              const insertLine = db.prepare(
                'INSERT INTO transcripts (call_id, seq, speaker, text) VALUES (?, ?, ?, ?)'
              );
              // Parse "[Speaker]: text" format
              const insertMany = db.transaction((entries) => {
                entries.forEach((line, idx) => {
                  const match = line.match(/^\[([^\]]+)\]:\s*(.+)$/);
                  if (match) insertLine.run(callRow.id, idx, match[1], match[2]);
                });
              });
              insertMany(lines);
              console.log(`💾 Saved ${lines.length} transcript lines to DB for ${callSid}`);
            }
          } catch (err) {
            console.error('Failed to save transcript to DB:', err.message);
          }
        }

        if (callSid) delete activeCalls[callSid];
        io.emit('call-ended', { callSid });
        break;
      }
    }
  });

  ws.on('close', () => {
    console.log('Twilio media stream WebSocket closed');
    Object.values(tracks).forEach((state) => {
      if (state.conn) try { state.conn.requestClose(); } catch (_) {}
    });
  });

  ws.on('error', (err) => {
    console.error('Stream WebSocket error:', err.message);
  });
});

// ── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`💻 Frontend connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`💻 Frontend disconnected: ${socket.id}`);
  });
});

// ── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  await seedUsers();
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`   Token endpoint:     POST http://localhost:${PORT}/token`);
  console.log(`   Voice webhook:      POST http://localhost:${PORT}/voice`);
  console.log(`   Recording webhook:  POST http://localhost:${PORT}/recording-status`);
  console.log(`   Media stream WS:    ws://localhost:${PORT}/stream`);
  console.log(`   Auth:               POST http://localhost:${PORT}/auth/login`);
  console.log(`   Calls API:          http://localhost:${PORT}/calls\n`);
});
