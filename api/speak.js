import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const VOICES = {
  george: { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", desc: "Warm British" },
  aria: { id: "9BWtsMINqrJLrRacOk9x", name: "Aria", desc: "Expressive American" },
  roger: { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", desc: "Confident American" },
  sarah: { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", desc: "Soft American" },
  charlie: { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", desc: "Casual Australian" },
};

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_KEY
});

const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY;
const DODO_BASE_URL = process.env.DODO_ENV === 'live'
  ? 'https://live.dodopayments.com'
  : 'https://test.dodopayments.com';

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, voice, customerId } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: "No text provided" });
  }

  if (text.length > 500) {
    return res.status(400).json({ error: "Text too long. Max 500 characters." });
  }

  if (!customerId) {
    return res.status(400).json({ error: "customerId is required" });
  }

  const voiceId = VOICES[voice]?.id || VOICES.george.id;
  const charCost = text.length;

  try {
    // Check wallet balance before calling ElevenLabs
    const balanceRes = await fetch(
      `${DODO_BASE_URL}/customers/${customerId}/wallets`,
      { headers: { 'Authorization': `Bearer ${DODO_API_KEY}` } }
    );

    const balanceData = await balanceRes.json();
    if (!balanceRes.ok) throw new Error('Failed to check balance');

    const wallet = balanceData.items?.find(w => w.currency === 'USD');
    const balance = wallet?.balance || 0;

    if (balance < charCost) {
      return res.status(402).json({
        error: `Insufficient credits. Need ${charCost}, have ${balance}.`,
        balance,
      });
    }

    // Generate speech via ElevenLabs
    const audio = await client.textToSpeech.convert(voiceId, {
      text: text,
      model_id: "eleven_multilingual_v2"
    });

    const chunks = [];
    for await (const chunk of audio) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Debit wallet only after successful generation
    const debitRes = await fetch(
      `${DODO_BASE_URL}/customers/${customerId}/wallets/ledger-entries`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DODO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: charCost,
          currency: 'USD',
          entry_type: 'debit',
          idempotency_key: `tts_${customerId}_${Date.now()}`,
          reason: `TTS generation: ${charCost} characters`,
        }),
      }
    );

    const debitData = await debitRes.json();
    if (!debitRes.ok) throw new Error('Failed to debit credits');

    res.json({
      audio: buffer.toString("base64"),
      characters: charCost,
      voice: VOICES[voice]?.name || "George",
      balance: debitData.balance,
    });
  } catch (err) {
    console.error("Speak error:", err.message);
    if (err.message.includes('Insufficient')) {
      return res.status(402).json({ error: err.message });
    }
    res.status(500).json({ error: "Speech generation failed. Try again." });
  }
}
