import DodoPayments from 'dodopayments';

const PRODUCTS = {
  starter: { id: 'pdt_0NZCiIwZqFmmRpNK6z00J', characters: 10000, price: 5, name: 'Starter Pack' },
  pro:     { id: 'pdt_0NZCiKxzvABY1VnpQrCS5', characters: 50000, price: 10, name: 'Pro Pack' },
  power:   { id: 'pdt_0NZCiMdfSCB8t18kVCowo', characters: 200000, price: 25, name: 'Power Pack' },
};

const dodo = new DodoPayments({
  environment: process.env.DODO_ENV || 'test_mode',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pack, customerId } = req.body;

  if (!pack || !PRODUCTS[pack]) {
    return res.status(400).json({ error: 'Invalid pack selected' });
  }

  if (!customerId) {
    return res.status(400).json({ error: 'customerId is required' });
  }

  const product = PRODUCTS[pack];
  const returnUrl = process.env.SITE_URL || 'https://chirpify-ai.vercel.app';

  try {
    const payment = await dodo.payments.create({
      payment_link: true,
      billing: { country: 'US' },
      customer: { customer_id: customerId },
      product_cart: [{ product_id: product.id, quantity: 1 }],
      return_url: `${returnUrl}?success=true`,
    });

    res.json({
      checkoutUrl: payment.payment_link,
      characters: product.characters,
      productName: product.name,
    });
  } catch (err) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
