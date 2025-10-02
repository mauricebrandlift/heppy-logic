// api/routes/stripe/public-config.js
// Publieke Stripe-config voor de client (veilig: geen secret)

import { stripeConfig } from '../../config/index.js';

export default async function handler(req, res) {
  // CORS headers voor veiligheid
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');

  const correlationId = req.headers['x-correlation-id'] || 'not-provided';
  if (correlationId) res.setHeader('X-Correlation-ID', correlationId);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    console.warn(JSON.stringify({ level: 'WARN', correlationId, route: 'stripe/public-config', method: req.method, msg: 'Method not allowed' }));
    res.status(405).json({ error: 'Method not allowed', correlationId });
    return;
  }

  const { publicKey, currency = 'EUR', country = 'NL' } = stripeConfig || {};

  if (!publicKey) {
    console.error(JSON.stringify({ level: 'ERROR', correlationId, route: 'stripe/public-config', msg: 'Missing publishable key' }));
    res.status(500).json({ error: 'Stripe publishable key not configured', correlationId });
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  console.log(JSON.stringify({ level: 'INFO', correlationId, route: 'stripe/public-config', msg: 'Config served', currency, country }));
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
    correlationId,
  });
}
