import crypto from 'crypto';
import DodoPayments from 'dodopayments';

const DODO_WEBHOOK_KEY = process.env.DODO_PAYMENTS_WEBHOOK_KEY;

const dodo = new DodoPayments({
  environment: process.env.DODO_ENV || 'test_mode',
});

const PRODUCT_CREDITS = {
  'pdt_0NZCiIwZqFmmRpNK6z00J': 10000,   // Starter Pack
  'pdt_0NZCiKxzvABY1VnpQrCS5': 50000,   // Pro Pack
  'pdt_0NZCiMdfSCB8t18kVCowo': 200000,  // Power Pack
};

function verifyWebhookSignature(body, headers) {
  const webhookId = headers['webhook-id'];
  const webhookTimestamp = headers['webhook-timestamp'];
  const webhookSignature = headers['webhook-signature'];

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    throw new Error('Missing webhook signature headers');
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(webhookTimestamp)) > 300) {
    throw new Error('Webhook timestamp too old');
  }

  const signedContent = `${webhookId}.${webhookTimestamp}.${typeof body === 'string' ? body : JSON.stringify(body)}`;
  const secretBytes = Buffer.from(DODO_WEBHOOK_KEY.replace('whsec_', ''), 'base64');
  const expectedSignature = crypto
    .createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64');

  const passedSignatures = webhookSignature.split(' ').map(sig => sig.split(',')[1]);
  if (!passedSignatures.some(sig => sig === expectedSignature)) {
    throw new Error('Invalid webhook signature');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    verifyWebhookSignature(req.body, req.headers);
  } catch (err) {
    console.error('Webhook verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const event = req.body;
  const eventType = req.headers['webhook-event-type'];

  if (eventType !== 'payment.succeeded') {
    return res.json({ received: true });
  }

  const customerId = event.customer?.customer_id;
  const paymentId = event.payment_id;
  const productId = (event.product_cart || [])[0]?.product_id;

  if (!customerId || !productId) {
    return res.status(400).json({ error: 'Missing customer or product info' });
  }

  const characters = PRODUCT_CREDITS[productId];
  if (!characters) {
    return res.status(400).json({ error: 'Unknown product' });
  }

  try {
    const wallet = await dodo.customers.wallets.ledgerEntries.create(
      customerId,
      {
        amount: characters,
        currency: 'USD',
        entry_type: 'credit',
        idempotency_key: paymentId,
        reason: `Credit pack purchase: ${characters.toLocaleString()} characters`,
      }
    );

    console.log(`Credited ${characters} chars to ${customerId}. New balance: ${wallet.balance}`);
    res.json({ received: true, credited: characters, balance: wallet.balance });
  } catch (err) {
    console.error('Webhook processing error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
