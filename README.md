# Chirpify AI

Text-to-speech app with credit-based billing. Built with ElevenLabs + Dodo Payments.

**[Live demo](https://chirpify-ai.vercel.app/)**

## What it does

- Type text, pick a voice, generate speech
- 500 free characters on first visit
- Buy more with three credit packs ($5 / $10 / $25)
- Payments and wallet tracking powered by Dodo Payments
- Deployed on Vercel

## Quick start

```bash
git clone https://github.com/aainanarang29/chirpify-ai
cd chirpify-ai
npm i
```

Create a `.env` file:

```
DODO_PAYMENTS_API_KEY=sk_test_your_key
DODO_ENV=test_mode
DODO_PAYMENTS_WEBHOOK_KEY=whsec_your_secret
ELEVENLABS_KEY=xi_your_key
SITE_URL=http://localhost:3000
```

Run it:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Deploy

```bash
npm install -g vercel
vercel --prod
```

## Create products

Create three products in your [Dodo Dashboard](https://dashboard.dodopayments.com) or use cURL:

```bash
# Starter Pack - $5
curl -X POST "https://test.dodopayments.com/products" \
  -H "Authorization: Bearer YOUR_DODO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Starter Pack","description":"10,000 characters","price":{"currency":"USD","discount":0,"price":500,"purchasing_power_parity":false,"type":"one_time_price"},"tax_category":"digital_products"}'

# Pro Pack - $10
curl -X POST "https://test.dodopayments.com/products" \
  -H "Authorization: Bearer YOUR_DODO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Pro Pack","description":"50,000 characters","price":{"currency":"USD","discount":0,"price":1000,"purchasing_power_parity":false,"type":"one_time_price"},"tax_category":"digital_products"}'

# Power Pack - $25
curl -X POST "https://test.dodopayments.com/products" \
  -H "Authorization: Bearer YOUR_DODO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Power Pack","description":"200,000 characters","price":{"currency":"USD","discount":0,"price":2500,"purchasing_power_parity":false,"type":"one_time_price"},"tax_category":"digital_products"}'
```

Update the product IDs in `api/checkout.js` and `api/webhook.js`.

## Full cookbook

Step-by-step guide with architecture diagrams and code walkthrough: [Chirpify Cookbook](https://aainanarang2911gmailcom.mintlify.app/chirpify-cookbook)
