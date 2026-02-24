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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, voice } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: "No text provided" });
  }

  if (text.length > 500) {
    return res.status(400).json({ error: "Text too long. Max 500 characters." });
  }

  const voiceId = VOICES[voice]?.id || VOICES.george.id;
  const charCount = text.length;

  try {
    const audio = await client.textToSpeech.convert(voiceId, {
      text: text,
      model_id: "eleven_multilingual_v2"
    });

    const chunks = [];
    for await (const chunk of audio) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    res.json({
      audio: buffer.toString("base64"),
      characters: charCount,
      voice: VOICES[voice]?.name || "George"
    });
  } catch (err) {
    console.error("ElevenLabs error:", err.message);
    res.status(500).json({ error: "Speech generation failed. Try again." });
  }
}
