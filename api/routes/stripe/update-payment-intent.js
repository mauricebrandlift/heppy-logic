// api/routes/stripe/update-payment-intent.js
// Update een bestaande Payment Intent metadata

import { stripeConfig } from '../../config/index.js';
import { handleErrorResponse } from '../../utils/errorHandler.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, Authorization');

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
    const { paymentIntentId, metadata } = req.body || {};

    if (!paymentIntentId) {
      return res.status(400).json({ 
        correlationId, 
        message: 'paymentIntentId is required' 
      });
    }

    if (!metadata || typeof metadata !== 'object') {
      return res.status(400).json({ 
        correlationId, 
        message: 'metadata object is required' 
      });
    }

    const { secretKey } = stripeConfig || {};
    if (!secretKey) {
      throw new Error('Stripe secret key not configured');
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'stripe/update-payment-intent',
      action: 'update_metadata',
      paymentIntentId,
      metadataKeys: Object.keys(metadata)
    }));

    // Update payment intent metadata via REST API
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(metadata)) {
      params.set(`metadata[${key}]`, typeof value === 'string' ? value : JSON.stringify(value));
    }

    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const paymentIntent = await response.json();

    if (!response.ok) {
      const errorMsg = paymentIntent?.error?.message || 'Stripe API error';
      throw new Error(errorMsg);
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'stripe/update-payment-intent',
      action: 'update_success',
      paymentIntentId: paymentIntent.id
    }));

    return res.status(200).json({ 
      correlationId,
      success: true,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'stripe/update-payment-intent',
      action: 'update_failure',
      message: error.message
    }));
    return handleErrorResponse(res, error, 500, correlationId);
  }
}
