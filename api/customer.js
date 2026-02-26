const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY;
const DODO_BASE_URL = process.env.DODO_ENV === 'live'
  ? 'https://live.dodopayments.com'
  : 'https://test.dodopayments.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create a Dodo customer
    const customerRes = await fetch(`${DODO_BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@chirpify.ai`,
        name: 'Chirpify User',
      }),
    });

    const customer = await customerRes.json();
    if (!customerRes.ok) throw new Error(customer.message || 'Customer creation failed');

    // Credit 500 free characters as a welcome bonus
    const walletRes = await fetch(
      `${DODO_BASE_URL}/customers/${customer.customer_id}/wallets/ledger-entries`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DODO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 500,
          currency: 'USD',
          entry_type: 'credit',
          idempotency_key: `welcome_${customer.customer_id}`,
          reason: 'Welcome bonus: 500 free characters',
        }),
      }
    );

    const wallet = await walletRes.json();
    if (!walletRes.ok) throw new Error(wallet.message || 'Wallet credit failed');

    res.json({
      customerId: customer.customer_id,
      balance: wallet.balance,
    });
  } catch (err) {
    console.error('Customer creation error:', err.message);
    res.status(500).json({ error: 'Failed to create customer' });
  }
}
