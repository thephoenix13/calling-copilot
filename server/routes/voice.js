const express = require('express');
const router = express.Router();
const twilio = require('twilio');

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * POST /voice
 * Twilio calls this webhook when the browser initiates an outbound call.
 * Returns TwiML that:
 *   1. Streams audio to our /stream WebSocket (for live Deepgram transcription)
 *   2. Dials the destination number with recording enabled
 */
router.post('/', (req, res) => {
  console.log('\n📞 /voice webhook hit');
  console.log('   Body:', JSON.stringify(req.body, null, 2));

  // Ensure E.164 format — Twilio requires a leading +
  const rawTo = req.body.To || '';
  const to = rawTo.startsWith('+') ? rawTo : '+' + rawTo;
  const ngrokUrl = process.env.NGROK_URL;

  if (!rawTo) {
    return res.status(400).send('<Response><Say>Missing destination number.</Say></Response>');
  }

  if (!ngrokUrl) {
    console.error('NGROK_URL not set in .env');
    return res.status(500).send('<Response><Say>Server configuration error.</Say></Response>');
  }

  // Convert https://xxx.ngrok.io  →  wss://xxx.ngrok.io
  const wsUrl = ngrokUrl.replace(/^https?:\/\//, 'wss://') + '/stream';

  const response = new VoiceResponse();

  // Stream both tracks: inbound = recruiter (browser→Twilio), outbound = candidate (PSTN→Twilio)
  const start = response.start();
  start.stream({ url: wsUrl, track: 'both_tracks' });

  // Dial the candidate with recording
  const dial = response.dial({
    callerId: process.env.TWILIO_PHONE_NUMBER,
    record: 'record-from-ringing',
    recordingStatusCallback: `${ngrokUrl}/recording-status`,
    recordingStatusCallbackMethod: 'POST',
  });
  dial.number(to);

  const twiml = response.toString();
  console.log('   Returning TwiML:\n', twiml);
  res.type('text/xml');
  res.send(twiml);
});

module.exports = router;
