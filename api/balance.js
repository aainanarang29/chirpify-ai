import DodoPayments from 'dodopayments';

const dodo = new DodoPayments({
  environment: process.env.DODO_ENV || 'test_mode',
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const customerId = req.query.customer_id;
  if (!customerId) {
    return res.status(400).json({ error: 'customer_id is required' });
  }

  try {
    const walletData = await dodo.customers.wallets.list(customerId);
    const wallet = walletData.items?.find(w => w.currency === 'USD');

    res.json({
      balance: wallet?.balance || 0,
      customerId,
    });
  } catch (err) {
    console.error('Balance check error:', err.message);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
}
