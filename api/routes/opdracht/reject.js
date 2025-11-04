/**
 * API Route: Schoonmaker Opdracht Afkeuren (Dieptereiniging)
 * 
 * POST /api/routes/opdracht/reject
 * 
 * Flow:
 * 1. Schoonmaker ontvangt opdracht via dashboard/email
 * 2. Schoonmaker klikt "Afkeuren" (optioneel: reden invullen)
 * 3. Deze route wordt aangeroepen
 * 4. Match status wordt 'geweigerd'
 * 5. Opdracht status wordt 'afgewezen'
 * 6. Admin ontvangt notificatie (handmatige actie vereist)
 * 
 * Note: Auto-matching voor dieptereiniging is nog niet geïmplementeerd.
 * Admin moet handmatig een nieuwe schoonmaker toewijzen.
 * 
 * Request Body:
 * {
 *   "opdracht_id": "uuid",
 *   "schoonmaker_id": "uuid",
 *   "reden": "Optionele afwijzingsreden"
 * }
 * 
 * Response Success (200):
 * {
 *   "success": true,
 *   "message": "Opdracht afgewezen, admin ontvangt notificatie",
 *   "data": {
 *     "opdracht_id": "uuid",
 *     "rejected_match_id": "uuid",
 *     "new_match": null,
 *     "requires_admin_action": true
 *   }
 * }
 * 
 * Response Error (404/409/500):
 * {
 *   "error": "Error message",
 *   "details": { ... }
 * }
 */

import { opdrachtService } from '../../services/opdrachtService.js';
import { handleErrorResponse } from '../../utils/errorHandler.js';

export default async function handler(req, res) {
  // CORS headers voor alle responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, Authorization');

  // Correlation ID voor tracing
  const correlationId = req.headers['x-correlation-id'] || `opdracht-reject-${Date.now()}`;
  if (correlationId) {
    res.setHeader('X-Correlation-ID', correlationId);
  }

  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Alleen POST toestaan
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    console.warn(`[opdracht/reject] Method ${req.method} not allowed [${correlationId}]`);
    return res.status(405).json({ 
      error: 'Method Not Allowed',
      details: 'Only POST requests are accepted for this endpoint.'
    });
  }

  try {
    console.log(`[opdracht/reject] ========== START ========== [${correlationId}]`);
    
    // Request body validatie
    const { opdracht_id, schoonmaker_id, reden } = req.body;

    if (!opdracht_id) {
      console.warn(`[opdracht/reject] Missing opdracht_id [${correlationId}]`);
      return res.status(400).json({
        error: 'Bad Request',
        details: 'opdracht_id is required'
      });
    }

    if (!schoonmaker_id) {
      console.warn(`[opdracht/reject] Missing schoonmaker_id [${correlationId}]`);
      return res.status(400).json({
        error: 'Bad Request',
        details: 'schoonmaker_id is required'
      });
    }

    // UUID format validatie (basic)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(opdracht_id)) {
      console.warn(`[opdracht/reject] Invalid opdracht_id format [${correlationId}]`, opdracht_id);
      return res.status(400).json({
        error: 'Bad Request',
        details: 'opdracht_id must be a valid UUID'
      });
    }

    if (!uuidPattern.test(schoonmaker_id)) {
      console.warn(`[opdracht/reject] Invalid schoonmaker_id format [${correlationId}]`, schoonmaker_id);
      return res.status(400).json({
        error: 'Bad Request',
        details: 'schoonmaker_id must be a valid UUID'
      });
    }

    console.log(`[opdracht/reject] Request validated [${correlationId}]`, {
      opdracht_id,
      schoonmaker_id,
      reden: reden || '(geen reden opgegeven)'
    });

    // Roep service functie aan
    const result = await opdrachtService.reject({
      opdrachtId: opdracht_id,
      schoonmakerId: schoonmaker_id,
      reden: reden || null
    }, correlationId);

    console.log(`[opdracht/reject] ========== SUCCESS ========== [${correlationId}]`);

    // Response: altijd geen nieuwe match voor dieptereiniging (admin actie vereist)
    return res.status(200).json({
      success: true,
      message: 'Opdracht afgewezen, admin ontvangt notificatie',
      data: {
        opdracht_id: result.opdracht.id,
        rejected_match_id: result.rejectedMatch.id,
        new_match: null,
        requires_admin_action: true,
        type: result.opdracht.type
      }
    });

  } catch (error) {
    console.error(`[opdracht/reject] ========== ERROR ========== [${correlationId}]`);
    console.error(`[opdracht/reject] Error:`, error.message);
    console.error(`[opdracht/reject] Stack:`, error.stack);

    // Gebruik error handler voor consistent error format
    return handleErrorResponse(res, error, correlationId);
  }
}
