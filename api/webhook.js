const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY;
const DODO_BASE_URL = process.env.DODO_ENV === 'live'
  ? 'https://live.dodopayments.com'
  : 'https://test.dodopayments.com';

// Map product IDs to character credits
const PRODUCT_CREDITS = {
  'pdt_0NZCiIwZqFmmRpNK6z00J': 10000,   // Starter Pack
  'pdt_0NZCiKxzvABY1VnpQrCS5': 50000,   // Pro Pack
  'pdt_0NZCiMdfSCB8t18kVCowo': 200000,  // Power Pack
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookId = req.headers['webhook-id'];
  const webhookTimestamp = req.headers['webhook-timestamp'];
  const webhookSignature = req.headers['webhook-signature'];

  // Basic header validation (add full Svix verification for production)
  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return res.status(400).json({ error: 'Missing webhook signature headers' });
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
    // Credit the customer's wallet with character credits
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
