// api/routes/tracking/start.js
/**
 * POST /api/routes/tracking/start
 * Start nieuwe tracking sessie
 */

import { trackingService } from '../../services/trackingService.js';

function generateCorrelationId() {
  return `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  
  try {
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
    
    return res.status(201).json(result);
    
  } catch (error) {
    console.error(`❌ [Tracking API] Start session failed [${correlationId}]`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
