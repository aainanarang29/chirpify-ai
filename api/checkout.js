// Character credit packs for Chirpify AI
const PRODUCTS = {
  starter: {
    id: 'pdt_0NZCiIwZqFmmRpNK6z00J',
    characters: 10000,
    price: 5,
    name: 'Starter Pack'
  },
  pro: {
    id: 'pdt_0NZCiKxzvABY1VnpQrCS5',
    characters: 50000,
    price: 10,
    name: 'Pro Pack'
  },
  power: {
    id: 'pdt_0NZCiMdfSCB8t18kVCowo',
    characters: 200000,
    price: 25,
    name: 'Power Pack'
  },
};

const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY || 'Slm9C1tmQSfrEo-k.kmerxfRVwnZkp7tN250jUaDczJiYHP_smXlL3B_RO8II2Nce';
const DODO_BASE_URL = process.env.DODO_ENV === 'live'
  ? 'https://live.dodopayments.com'
  : 'https://test.dodopayments.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pack } = req.body;

  if (!pack || !PRODUCTS[pack]) {
    return res.status(400).json({ error: 'Invalid pack selected' });
  }

  const product = PRODUCTS[pack];
  const returnUrl = process.env.SITE_URL || 'https://chirpify-ai.vercel.app';

  try {
    const response = await fetch(`${DODO_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        billing: {
          city: '',
          country: 'US',
          state: '',
          street: '',
          zipcode: '',
        },
        customer: {
          email: 'customer@chirpify.ai',
          name: 'Chirpify User',
        },
        product_cart: [
          { product_id: product.id, quantity: 1 }
        ],
        return_url: `${returnUrl}?success=true&characters=${product.characters}`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Dodo Payments error:', data);
      throw new Error(data.message || 'Payment creation failed');
    }

    res.json({
      checkoutUrl: data.payment_link,
      characters: product.characters,
      productName: product.name,
    });
  } catch (err) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
