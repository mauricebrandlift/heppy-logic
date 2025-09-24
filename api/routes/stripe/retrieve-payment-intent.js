// api/routes/stripe/retrieve-payment-intent.js
// Haalt een Stripe PaymentIntent op voor status/debugging

import { stripeConfig } from '../../config/index.js';
import { handleErrorResponse } from '../../utils/errorHandler.js';
import { retrievePaymentIntent } from '../../intents/stripePaymentIntent.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const correlationId = req.headers['x-correlation-id'] || 'not-provided';
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ correlationId, message: 'Method not allowed' });
  }

  try {
    const { secretKey } = stripeConfig || {};

    // PaymentIntent ID uit query param ?id=pi_...
    let id = null;
    try {
      const urlObj = new URL(req.url, 'http://localhost');
      id = urlObj.searchParams.get('id');
    } catch (_) {}

    const result = await retrievePaymentIntent({ secretKey, id, correlationId });
    return res.status(200).json({ correlationId, ...result });
  } catch (error) {
    return handleErrorResponse(res, error, 500, correlationId);
  }
}
