const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY;
const DODO_BASE_URL = process.env.DODO_ENV === 'live'
  ? 'https://live.dodopayments.com'
  : 'https://test.dodopayments.com';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const customerId = req.query.customer_id;
  if (!customerId) {
    return res.status(400).json({ error: 'customer_id is required' });
  }

  try {
    const response = await fetch(`${DODO_BASE_URL}/customers/${customerId}/wallets`, {
      headers: { 'Authorization': `Bearer ${DODO_API_KEY}` },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch balance');

    const wallet = data.items?.find(w => w.currency === 'USD');

    res.json({
      balance: wallet?.balance || 0,
      customerId,
    });
  } catch (err) {
    console.error('Balance check error:', err.message);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
}
