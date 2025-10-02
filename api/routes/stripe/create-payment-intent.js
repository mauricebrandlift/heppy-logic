// api/routes/stripe/create-payment-intent.js
// Maakt een Stripe PaymentIntent aan en retourneert de client_secret

import { stripeConfig } from '../../config/index.js';
import { handleErrorResponse } from '../../utils/errorHandler.js';
import { createPaymentIntent } from '../../intents/stripePaymentIntent.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, X-Idempotency-Key, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const correlationId = req.headers['x-correlation-id'] || 'not-provided';
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ correlationId, message: 'Method not allowed' });
  }

  try {
    const { secretKey, currency: defaultCurrency = 'EUR' } = stripeConfig || {};
    const payload = req.body || {};
    const headerIdem = req.headers['x-idempotency-key'];
    if (headerIdem && !payload.idempotencyKey) {
      payload.idempotencyKey = String(headerIdem);
    }

    // Basic payload validation & logging (no secrets)
    const rawAmount = payload.amount;
    if (!rawAmount || !Number.isInteger(rawAmount) || rawAmount <= 0) {
      console.warn(JSON.stringify({ level: 'WARN', correlationId, route: 'stripe/create-payment-intent', msg: 'Invalid amount', rawAmount }));
      return res.status(400).json({ correlationId, message: 'Invalid amount' });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'stripe/create-payment-intent',
      action: 'create_intent_request',
      amount: rawAmount,
      currency: payload.currency || defaultCurrency,
      metadata: payload.metadata || null,
      idempotencyKey: payload.idempotencyKey || headerIdem || null
    }));

    const result = await createPaymentIntent({
      secretKey,
      defaultCurrency,
      payload,
      correlationId,
    });

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'stripe/create-payment-intent',
      action: 'create_intent_success',
      intentId: result.id,
      status: result.status,
      amount: result.amount,
      currency: result.currency
    }));

    return res.status(200).json({ correlationId, ...result });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'stripe/create-payment-intent',
      action: 'create_intent_failure',
      message: error.message,
      code: error.code
    }));
    return handleErrorResponse(res, error, 500, correlationId);
  }
}
