// api/routes/tracking.js
/**
 * Funnel Tracking API Routes
 * Endpoints voor het tracken van user journey door formulieren
 */

import { trackingService } from '../services/trackingService.js';

function generateCorrelationId() {
  return `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID');
}

export default async function handler(req, res) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  
  try {
    // POST /api/tracking/start - Start nieuwe sessie
    if (req.method === 'POST' && req.url === '/api/tracking/start') {
      console.log(`🎯 [Tracking API] Starting new session [${correlationId}]`);
      
      const { sessionId, flowType, metadata } = req.body;
      
      if (!sessionId || !flowType) {
        return res.status(400).json({ 
          error: 'sessionId and flowType are required' 
        });
      }
      
      const result = await trackingService.startSession({ 
        sessionId, 
        flowType, 
        metadata 
      }, correlationId);
      
      console.log(`✅ [Tracking API] Session started: ${sessionId} [${correlationId}]`);
      return res.status(200).json(result);
    }
    
    // PATCH /api/tracking/step - Update stap
    if (req.method === 'PATCH' && req.url === '/api/tracking/step') {
      console.log(`📊 [Tracking API] Updating step [${correlationId}]`);
      
      const { sessionId, stepName, stepOrder, formData, completed, previousStep, timeSpent } = req.body;
      
      if (!sessionId || !stepName) {
        return res.status(400).json({ 
          error: 'sessionId and stepName are required' 
        });
      }
      
      // Exit vorige stap als opgegeven
      if (previousStep) {
        await trackingService.exitStep({ 
          sessionId, 
          stepName: previousStep, 
          timeSpent 
        }, correlationId);
      }
      
      // Update nieuwe stap
      await trackingService.updateStep({ 
        sessionId, 
        stepName, 
        stepOrder, 
        formData, 
        completed 
      }, correlationId);
      
      console.log(`✅ [Tracking API] Step updated: ${stepName} [${correlationId}]`);
      return res.status(200).json({ success: true });
    }
    
    // PATCH /api/tracking/link-user - Koppel user
    if (req.method === 'PATCH' && req.url === '/api/tracking/link-user') {
      console.log(`👤 [Tracking API] Linking user [${correlationId}]`);
      
      const { sessionId, userId } = req.body;
      
      if (!sessionId || !userId) {
        return res.status(400).json({ 
          error: 'sessionId and userId are required' 
        });
      }
      
      await trackingService.linkUser({ sessionId, userId }, correlationId);
      
      return res.status(200).json({ success: true });
    }
    
    // PATCH /api/tracking/link-payment - Koppel payment intent
    if (req.method === 'PATCH' && req.url === '/api/tracking/link-payment') {
      console.log(`💳 [Tracking API] Linking payment intent [${correlationId}]`);
      
      const { sessionId, paymentIntentId } = req.body;
      
      if (!sessionId || !paymentIntentId) {
        return res.status(400).json({ 
          error: 'sessionId and paymentIntentId are required' 
        });
      }
      
      await trackingService.linkPaymentIntent({ 
        sessionId, 
        paymentIntentId 
      }, correlationId);
      
      return res.status(200).json({ success: true });
    }
    
    // PATCH /api/tracking/complete - Voltooi sessie
    if (req.method === 'PATCH' && req.url === '/api/tracking/complete') {
      console.log(`✅ [Tracking API] Completing session [${correlationId}]`);
      
      const { sessionId, aanvraagId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ 
          error: 'sessionId is required' 
        });
      }
      
      await trackingService.completeSession({ 
        sessionId, 
        aanvraagId 
      }, correlationId);
      
      return res.status(200).json({ success: true });
    }
    
    // GET /api/tracking/session/:sessionId - Haal sessie op
    if (req.method === 'GET' && req.url.startsWith('/api/tracking/session/')) {
      const sessionId = req.url.split('/').pop();
      
      console.log(`🔍 [Tracking API] Getting session ${sessionId} [${correlationId}]`);
      
      const session = await trackingService.getSession({ sessionId }, correlationId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      return res.status(200).json(session);
    }
    
    // Unknown route
    return res.status(404).json({ error: 'Route not found' });
    
  } catch (error) {
    console.error(`❌ [Tracking API] Error [${correlationId}]`, {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
