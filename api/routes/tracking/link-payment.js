// api/routes/tracking/link-payment.js
/**
 * PATCH /api/routes/tracking/link-payment
 * Link payment intent aan tracking sessie
 */

import { trackingService } from '../../services/trackingService.js';

function generateCorrelationId() {
  return `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  
  try {
    console.log(`💳 [Tracking API] Linking payment [${correlationId}]`);
    
    const { sessionId, paymentIntentId } = req.body;
    
    if (!sessionId || !paymentIntentId) {
      return res.status(400).json({ 
        error: 'sessionId and paymentIntentId are required' 
      });
    }
    
    const result = await trackingService.linkPaymentIntent({ 
      sessionId, 
      paymentIntentId 
    }, correlationId);
    
    console.log(`✅ [Tracking API] Payment linked: ${paymentIntentId} [${correlationId}]`);
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error(`❌ [Tracking API] Link payment failed [${correlationId}]`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
