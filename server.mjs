import express from "express";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_KEY || "sk_7a9f5db99b4c40e584e52548c12d41a08589d6460027e2ea"
});

// Available voices
const VOICES = {
  george: { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", desc: "Warm British" },
  aria: { id: "9BWtsMINqrJLrRacOk9x", name: "Aria", desc: "Expressive American" },
  roger: { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", desc: "Confident American" },
  sarah: { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", desc: "Soft American" },
  charlie: { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", desc: "Casual Australian" },
};

app.get("/api/voices", (req, res) => {
  res.json(VOICES);
});

app.post("/api/speak", async (req, res) => {
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
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n  🐦 Chirpify AI is live at http://localhost:${PORT}\n`);
});
