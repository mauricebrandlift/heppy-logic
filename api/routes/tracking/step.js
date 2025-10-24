// api/routes/tracking/step.js
/**
 * PATCH /api/routes/tracking/step
 * Update tracking met step informatie
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
    console.log(`📝 [Tracking API] Updating step [${correlationId}]`);
    
    const { sessionId, stepName, stepOrder, formData, previousStep, timeSpent, completed } = req.body;
    
    if (!sessionId || !stepName || stepOrder === undefined) {
      return res.status(400).json({ 
        error: 'sessionId, stepName, and stepOrder are required' 
      });
    }
    
    const result = await trackingService.updateStep({ 
      sessionId, 
      stepName, 
      stepOrder, 
      formData,
      previousStep,
      timeSpent,
      completed: completed !== false // Default true
    }, correlationId);
    
    console.log(`✅ [Tracking API] Step updated: ${stepName} (${stepOrder}) [${correlationId}]`);
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error(`❌ [Tracking API] Update step failed [${correlationId}]`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
