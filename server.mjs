import express from "express";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

const ELEVENLABS_KEY = process.env.ELEVENLABS_KEY;
const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY;
const DODO_BASE_URL = process.env.DODO_ENV === 'live'
  ? 'https://live.dodopayments.com'
  : 'https://test.dodopayments.com';

const client = new ElevenLabsClient({ apiKey: ELEVENLABS_KEY });

// Available voices
const VOICES = {
  george: { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", desc: "Warm British" },
  aria: { id: "9BWtsMINqrJLrRacOk9x", name: "Aria", desc: "Expressive American" },
  roger: { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", desc: "Confident American" },
  sarah: { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", desc: "Soft American" },
  charlie: { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", desc: "Casual Australian" },
};

const PRODUCTS = {
  starter: { id: 'pdt_0NZCiIwZqFmmRpNK6z00J', characters: 10000, price: 5, name: 'Starter Pack' },
  pro:     { id: 'pdt_0NZCiKxzvABY1VnpQrCS5', characters: 50000, price: 10, name: 'Pro Pack' },
  power:   { id: 'pdt_0NZCiMdfSCB8t18kVCowo', characters: 200000, price: 25, name: 'Power Pack' },
};

const PRODUCT_CREDITS = {
  'pdt_0NZCiIwZqFmmRpNK6z00J': 10000,
  'pdt_0NZCiKxzvABY1VnpQrCS5': 50000,
  'pdt_0NZCiMdfSCB8t18kVCowo': 200000,
};

// Helper: Dodo fetch
async function dodoFetch(path, options = {}) {
  const res = await fetch(`${DODO_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${DODO_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Dodo API error: ${res.status}`);
  return data;
}

app.get("/api/voices", (req, res) => {
  res.json(VOICES);
});

// Create a new customer with 500 free characters
app.post("/api/customer", async (req, res) => {
  try {
    const customer = await dodoFetch('/customers', {
      method: 'POST',
      body: JSON.stringify({
        email: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@chirpify.ai`,
        name: 'Chirpify User',
      }),
    });

    const wallet = await dodoFetch(
      `/customers/${customer.customer_id}/wallets/ledger-entries`,
      {
        method: 'POST',
        body: JSON.stringify({
          amount: 500,
          currency: 'USD',
          entry_type: 'credit',
          idempotency_key: `welcome_${customer.customer_id}`,
          reason: 'Welcome bonus: 500 free characters',
        }),
      }
    );

    res.json({ customerId: customer.customer_id, balance: wallet.balance });
  } catch (err) {
    console.error('Customer creation error:', err.message);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Get wallet balance
app.get("/api/balance", async (req, res) => {
  const customerId = req.query.customer_id;
  if (!customerId) return res.status(400).json({ error: 'customer_id is required' });

  try {
    const data = await dodoFetch(`/customers/${customerId}/wallets`);
    const wallet = data.items?.find(w => w.currency === 'USD');
    res.json({ balance: wallet?.balance || 0, customerId });
  } catch (err) {
    console.error('Balance error:', err.message);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// Create checkout session
app.post("/api/checkout", async (req, res) => {
  const { pack, customerId } = req.body;

  if (!pack || !PRODUCTS[pack]) return res.status(400).json({ error: 'Invalid pack' });
  if (!customerId) return res.status(400).json({ error: 'customerId is required' });

  const product = PRODUCTS[pack];
  const returnUrl = process.env.SITE_URL || 'http://localhost:3000';

  try {
    const data = await dodoFetch('/payments', {
      method: 'POST',
      body: JSON.stringify({
        payment_link: true,
        billing: { country: 'US' },
        customer: { customer_id: customerId },
        product_cart: [{ product_id: product.id, quantity: 1 }],
        return_url: `${returnUrl}?success=true`,
      }),
    });

    res.json({
      checkoutUrl: data.payment_link,
      characters: product.characters,
      productName: product.name,
    });
  } catch (err) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Generate speech with server-side credit management
app.post("/api/speak", async (req, res) => {
  const { text, voice, customerId } = req.body;

  if (!text || text.trim().length === 0) return res.status(400).json({ error: "No text provided" });
  if (text.length > 500) return res.status(400).json({ error: "Text too long. Max 500 characters." });
  if (!customerId) return res.status(400).json({ error: "customerId is required" });

  const voiceId = VOICES[voice]?.id || VOICES.george.id;
  const charCost = text.length;

  try {
    // Check wallet balance
    const balanceData = await dodoFetch(`/customers/${customerId}/wallets`);
    const wallet = balanceData.items?.find(w => w.currency === 'USD');
    const balance = wallet?.balance || 0;

    if (balance < charCost) {
      return res.status(402).json({
        error: `Insufficient credits. Need ${charCost}, have ${balance}.`,
        balance,
      });
    }

    // Generate speech
    const audio = await client.textToSpeech.convert(voiceId, {
      text, model_id: "eleven_multilingual_v2"
    });
    const chunks = [];
    for await (const chunk of audio) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // Debit wallet after successful generation
    const debitData = await dodoFetch(
      `/customers/${customerId}/wallets/ledger-entries`,
      {
        method: 'POST',
        body: JSON.stringify({
          amount: charCost,
          currency: 'USD',
          entry_type: 'debit',
          idempotency_key: `tts_${customerId}_${Date.now()}`,
          reason: `TTS generation: ${charCost} characters`,
        }),
      }
    );

    res.json({
      audio: buffer.toString("base64"),
      characters: charCost,
      voice: VOICES[voice]?.name || "George",
      balance: debitData.balance,
    });
  } catch (err) {
    console.error("Speak error:", err.message);
    res.status(500).json({ error: "Speech generation failed. Try again." });
  }
});

// Webhook handler for payment.succeeded
app.post("/api/webhook", async (req, res) => {
  const webhookId = req.headers['webhook-id'];
  const webhookTimestamp = req.headers['webhook-timestamp'];
  const webhookSignature = req.headers['webhook-signature'];

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return res.status(400).json({ error: 'Missing webhook signature headers' });
  }

  const event = req.body;
  const eventType = req.headers['webhook-event-type'];

  if (eventType !== 'payment.succeeded') {
    return res.json({ received: true });
  }

  const customerId = event.customer?.customer_id;
  const paymentId = event.payment_id;
  const productId = event.product_cart?.[0]?.product_id;

  if (!customerId || !productId) {
    return res.status(400).json({ error: 'Missing customer or product info' });
  }

  const characters = PRODUCT_CREDITS[productId];
  if (!characters) return res.status(400).json({ error: 'Unknown product' });

  try {
    const wallet = await dodoFetch(
      `/customers/${customerId}/wallets/ledger-entries`,
      {
        method: 'POST',
        body: JSON.stringify({
          amount: characters,
          currency: 'USD',
          entry_type: 'credit',
          idempotency_key: paymentId,
          reason: `Credit pack purchase: ${characters.toLocaleString()} characters`,
        }),
      }
    );

    console.log(`Credited ${characters} chars to ${customerId}. Balance: ${wallet.balance}`);
    res.json({ received: true, credited: characters, balance: wallet.balance });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n  🐦 Chirpify AI is live at http://localhost:${PORT}\n`);
});
