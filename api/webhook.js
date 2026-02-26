import crypto from 'crypto';

const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY;
const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET;
const DODO_BASE_URL = process.env.DODO_ENV === 'live'
  ? 'https://live.dodopayments.com'
  : 'https://test.dodopayments.com';

// Map product IDs to character credits
const PRODUCT_CREDITS = {
  'pdt_0NZCiIwZqFmmRpNK6z00J': 10000,   // Starter Pack
  'pdt_0NZCiKxzvABY1VnpQrCS5': 50000,   // Pro Pack
  'pdt_0NZCiMdfSCB8t18kVCowo': 200000,  // Power Pack
};

// Verify Dodo webhook signature (Standard Webhooks / Svix format)
function verifyWebhookSignature(body, headers) {
  const webhookId = headers['webhook-id'];
  const webhookTimestamp = headers['webhook-timestamp'];
  const webhookSignature = headers['webhook-signature'];

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    throw new Error('Missing webhook signature headers');
  }

  // Reject webhooks older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(webhookTimestamp)) > 300) {
    throw new Error('Webhook timestamp too old');
  }

  // The signed content is: "{webhook-id}.{webhook-timestamp}.{body}"
  const signedContent = `${webhookId}.${webhookTimestamp}.${typeof body === 'string' ? body : JSON.stringify(body)}`;

  // Decode the secret (strip the "whsec_" prefix, then base64-decode)
  const secretBytes = Buffer.from(DODO_WEBHOOK_SECRET.replace('whsec_', ''), 'base64');

  // Compute the expected signature
  const expectedSignature = crypto
    .createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64');

  // The header can contain multiple signatures (e.g., "v1,abc123 v1,def456")
  const passedSignatures = webhookSignature.split(' ').map(sig => sig.split(',')[1]);

  if (!passedSignatures.some(sig => sig === expectedSignature)) {
    throw new Error('Invalid webhook signature');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Step 1: Verify the webhook signature
  try {
    verifyWebhookSignature(req.body, req.headers);
  } catch (err) {
    console.error('Webhook verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const event = req.body;
  const eventType = req.headers['webhook-event-type'];

  // Only handle successful payments
  if (eventType !== 'payment.succeeded') {
    return res.json({ received: true });
  }

  const customerId = event.customer?.customer_id;
  const paymentId = event.payment_id;
  const productCart = event.product_cart || [];
  const productId = productCart[0]?.product_id;

  if (!customerId || !productId) {
    console.error('Webhook missing customer or product:', { customerId, productId });
    return res.status(400).json({ error: 'Missing customer or product info' });
  }

  const characters = PRODUCT_CREDITS[productId];
  if (!characters) {
    console.error('Unknown product ID:', productId);
    return res.status(400).json({ error: 'Unknown product' });
  }

  try {
    // Step 2: Credit the customer's wallet
    const walletRes = await fetch(
      `${DODO_BASE_URL}/customers/${customerId}/wallets/ledger-entries`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DODO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: characters,
          currency: 'USD',
          entry_type: 'credit',
          idempotency_key: paymentId, // Prevents double-credit on webhook retry
          reason: `Credit pack purchase: ${characters.toLocaleString()} characters`,
        }),
      }
    );

    const wallet = await walletRes.json();
    if (!walletRes.ok) throw new Error(wallet.message || 'Wallet credit failed');

    console.log(`Credited ${characters} chars to ${customerId}. New balance: ${wallet.balance}`);
    res.json({ received: true, credited: characters, balance: wallet.balance });
  } catch (err) {
    console.error('Webhook processing error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
