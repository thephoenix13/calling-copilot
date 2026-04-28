const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const authMiddleware = require('../middleware/auth');

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

/**
 * POST /token
 * Returns a Twilio Access Token for the browser Voice SDK.
 * Requires a valid JWT in the Authorization header.
 */
router.post('/', authMiddleware, (req, res) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!apiKey || !apiSecret || !twimlAppSid) {
    return res.status(500).json({
      error: 'Missing TWILIO_API_KEY, TWILIO_API_SECRET, or TWILIO_TWIML_APP_SID in .env. Run `node setup.js` first.',
    });
  }

  try {
    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: req.user.email,
      ttl: 3600,
    });

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: false,
    });
    token.addGrant(voiceGrant);

    res.json({ token: token.toJwt() });
  } catch (err) {
    console.error('Token generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
