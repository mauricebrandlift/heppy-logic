// api/routes/stripe/public-config.js
// Publieke Stripe-config voor de client (veilig: geen secret)

import { stripeConfig } from '../../config/index.js';

export default async function handler(req, res) {
  // CORS headers voor veiligheid
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { publicKey, currency = 'EUR', country = 'NL' } = stripeConfig || {};

  if (!publicKey) {
    res.status(500).json({ error: 'Stripe publishable key not configured' });
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  res.status(200).json({
    publishableKey: publicKey,
    currency,
    country,
    features: {
      paymentElement: true,
      ideal: true,
      sepaDebit: true,
      saveForFuture: true,
    },
  });
}
