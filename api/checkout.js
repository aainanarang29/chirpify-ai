import DodoPayments from 'dodopayments';

const client = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY,
  environment: process.env.DODO_ENV === 'live' ? 'live_mode' : 'test_mode',
});

// Credit pack products (create these in your Dodo Payments dashboard)
const PRODUCTS = {
  starter: { id: process.env.DODO_PRODUCT_STARTER, credits: 10, name: '10 Chirps' },
  pro: { id: process.env.DODO_PRODUCT_PRO, credits: 50, name: '50 Chirps' },
  unlimited: { id: process.env.DODO_PRODUCT_UNLIMITED, credits: 200, name: '200 Chirps' },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pack, email } = req.body;

  if (!pack || !PRODUCTS[pack]) {
    return res.status(400).json({ error: 'Invalid pack selected' });
  }

  const product = PRODUCTS[pack];

  try {
    const checkoutSession = await client.payments.create({
      billing: { city: "", country: "US", state: "", street: "", zipcode: "" },
      customer: { email: email || 'customer@example.com' },
      product_cart: [{ product_id: product.id, quantity: 1 }],
      return_url: `${process.env.SITE_URL || 'https://chirpify-ai.vercel.app'}?success=true&credits=${product.credits}`,
    });

    res.json({
      checkoutUrl: checkoutSession.payment_link,
      credits: product.credits,
    });
  } catch (err) {
    console.error('Dodo Payments error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
