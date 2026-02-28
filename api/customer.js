import DodoPayments from 'dodopayments';

const dodo = new DodoPayments({
  environment: process.env.DODO_ENV || 'test_mode',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const customer = await dodo.customers.create({
      email: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@chirpify.ai`,
      name: 'Chirpify User',
    });

    const wallet = await dodo.customers.wallets.ledgerEntries.create(
      customer.customer_id,
      {
        amount: 500,
        currency: 'USD',
        entry_type: 'credit',
        idempotency_key: `welcome_${customer.customer_id}`,
        reason: 'Welcome bonus: 500 free characters',
      }
    );

    res.json({
      customerId: customer.customer_id,
      balance: wallet.balance,
    });
  } catch (err) {
    console.error('Customer creation error:', err.message);
    res.status(500).json({ error: 'Failed to create customer' });
  }
}
