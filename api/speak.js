import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import DodoPayments from 'dodopayments';

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

const dodo = new DodoPayments({
  environment: process.env.DODO_ENV || 'test_mode',
});

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
    // Check wallet balance
    const walletData = await dodo.customers.wallets.list(customerId);
    const wallet = walletData.items?.find(w => w.currency === 'USD');
    const balance = wallet?.balance || 0;

    if (balance < charCost) {
      return res.status(402).json({
        error: `Insufficient credits. Need ${charCost}, have ${balance}.`,
        balance,
      });
    }

    // Generate speech via ElevenLabs
    const audio = await client.textToSpeech.convert(voiceId, {
      text, model_id: "eleven_multilingual_v2"
    });

    const chunks = [];
    for await (const chunk of audio) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Debit wallet only after successful generation
    const debitResult = await dodo.customers.wallets.ledgerEntries.create(
      customerId,
      {
        amount: charCost,
        currency: 'USD',
        entry_type: 'debit',
        idempotency_key: `tts_${customerId}_${Date.now()}`,
        reason: `TTS generation: ${charCost} characters`,
      }
    );

    res.json({
      audio: buffer.toString("base64"),
      characters: charCost,
      voice: VOICES[voice]?.name || "George",
      balance: debitResult.balance,
    });
  } catch (err) {
    console.error("Speak error:", err.message);
    if (err.message.includes('Insufficient')) {
      return res.status(402).json({ error: err.message });
    }
    res.status(500).json({ error: "Speech generation failed. Try again." });
  }
}
