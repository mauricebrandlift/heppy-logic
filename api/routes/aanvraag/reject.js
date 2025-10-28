/**
 * API Route: Schoonmaker Aanvraag Afkeuren
 * 
 * POST /api/routes/aanvraag/reject
 * 
 * Flow:
 * 1. Schoonmaker ontvangt aanvraag via dashboard
 * 2. Schoonmaker klikt "Afkeuren" (optioneel: reden invullen)
 * 3. Deze route wordt aangeroepen
 * 4. Match status wordt 'geweigerd'
 * 5. Automatisch nieuwe schoonmaker zoeken
 * 6. Nieuwe match aanmaken (status='open')
 * 7. Notificatie naar nieuwe schoonmaker (later)
 * 
 * Request Body:
 * {
 *   "aanvraag_id": "uuid",
 *   "schoonmaker_id": "uuid",
 *   "reden": "Optionele afwijzingsreden"
 * }
 * 
 * Response Success (200):
 * {
 *   "success": true,
 *   "message": "Aanvraag afgewezen, nieuwe schoonmaker gevonden",
 *   "data": {
 *     "aanvraag_id": "uuid",
 *     "rejected_match_id": "uuid",
 *     "new_match": {
 *       "match_id": "uuid",
 *       "schoonmaker_id": "uuid",
 *       "schoonmaker_naam": "Naam"
 *     }
 *   }
 * }
 * 
 * Response No Match Found (200):
 * {
 *   "success": true,
 *   "message": "Aanvraag afgewezen, geen nieuwe schoonmaker beschikbaar",
 *   "data": {
 *     "aanvraag_id": "uuid",
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

import { aanvraagService } from '../../services/aanvraagService.js';
import { handleErrorResponse } from '../../utils/errorHandler.js';

export default async function handler(req, res) {
  // CORS headers voor alle responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, Authorization');

  // Correlation ID voor tracing
  const correlationId = req.headers['x-correlation-id'] || `reject-${Date.now()}`;
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
    console.warn(`[reject] Method ${req.method} not allowed [${correlationId}]`);
    return res.status(405).json({ 
      error: 'Method Not Allowed',
      details: 'Only POST requests are accepted for this endpoint.'
    });
  }

  try {
    console.log(`[reject] ========== START ========== [${correlationId}]`);
    
    // Request body validatie
    const { aanvraag_id, schoonmaker_id, reden } = req.body;

    if (!aanvraag_id) {
      console.warn(`[reject] Missing aanvraag_id [${correlationId}]`);
      return res.status(400).json({
        error: 'Bad Request',
        details: 'aanvraag_id is required'
      });
    }

    if (!schoonmaker_id) {
      console.warn(`[reject] Missing schoonmaker_id [${correlationId}]`);
      return res.status(400).json({
        error: 'Bad Request',
        details: 'schoonmaker_id is required'
      });
    }

    // UUID format validatie (basic)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(aanvraag_id)) {
      console.warn(`[reject] Invalid aanvraag_id format [${correlationId}]`, aanvraag_id);
      return res.status(400).json({
        error: 'Bad Request',
        details: 'aanvraag_id must be a valid UUID'
      });
    }

    if (!uuidPattern.test(schoonmaker_id)) {
      console.warn(`[reject] Invalid schoonmaker_id format [${correlationId}]`, schoonmaker_id);
      return res.status(400).json({
        error: 'Bad Request',
        details: 'schoonmaker_id must be a valid UUID'
      });
    }

    console.log(`[reject] Request validated [${correlationId}]`, {
      aanvraag_id,
      schoonmaker_id,
      reden: reden || '(geen reden opgegeven)'
    });

    // Roep service functie aan
    const result = await aanvraagService.reject({
      aanvraagId: aanvraag_id,
      schoonmakerId: schoonmaker_id,
      reden: reden || null
    }, correlationId);

    console.log(`[reject] ========== SUCCESS ========== [${correlationId}]`);

    // Check of er een nieuwe match is gevonden
    if (result.newMatch) {
      // Success: nieuwe schoonmaker gevonden
      return res.status(200).json({
        success: true,
        message: 'Aanvraag afgewezen, nieuwe schoonmaker gevonden',
        data: {
          aanvraag_id: result.aanvraag.id,
          rejected_match_id: result.rejectedMatch.id,
          new_match: {
            match_id: result.newMatch.id,
            schoonmaker_id: result.newMatch.schoonmaker_id,
            schoonmaker_naam: result.newMatch.schoonmaker_naam || null
          }
        }
      });
    } else {
      // Success maar geen nieuwe match: admin moet handmatig toewijzen
      return res.status(200).json({
        success: true,
        message: 'Aanvraag afgewezen, geen nieuwe schoonmaker beschikbaar',
        data: {
          aanvraag_id: result.aanvraag.id,
          rejected_match_id: result.rejectedMatch.id,
          new_match: null,
          requires_admin_action: true
        }
      });
    }

  } catch (error) {
    console.error(`[reject] ========== ERROR ========== [${correlationId}]`);
    console.error(`[reject] Error:`, error.message);
    console.error(`[reject] Stack:`, error.stack);

    // Gebruik error handler voor consistent error format
    return handleErrorResponse(res, error, correlationId);
  }
}
