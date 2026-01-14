/**
 * API Route: Schoonmaker Aanvraag Goedkeuren
 * 
 * POST /api/routes/aanvraag/approve
 * 
 * Flow:
 * 1. Schoonmaker ontvangt aanvraag via dashboard
 * 2. Schoonmaker klikt "Goedkeuren"
 * 3. Deze route wordt aangeroepen
 * 4. Match status wordt 'geaccepteerd'
 * 5. Abonnement krijgt definitieve schoonmaker
 * 6. Aanvraag status wordt 'geaccepteerd'
 * 
 * Request Body (Option 1 - via dashboard):
 * {
 *   "aanvraag_id": "uuid",
 *   "schoonmaker_id": "uuid"
 * }
 * 
 * Request Body (Option 2 - via mail link, veiliger):
 * {
 *   "match_id": "uuid"
 * }
 * 
 * Response Success (200):
 * {
 *   "success": true,
 *   "message": "Aanvraag succesvol goedgekeurd",
 *   "data": {
 *     "aanvraag_id": "uuid",
 *     "abonnement_id": "uuid",
 *     "schoonmaker_id": "uuid",
 *     "match_id": "uuid"
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
  const correlationId = req.headers['x-correlation-id'] || `approve-${Date.now()}`;
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
    console.warn(`[approve] Method ${req.method} not allowed [${correlationId}]`);
    return res.status(405).json({ 
      error: 'Method Not Allowed',
      details: 'Only POST requests are accepted for this endpoint.'
    });
  }

  try {
    console.log(`[approve] ========== START ========== [${correlationId}]`);
    
    // Request body validatie - support both match_id AND aanvraag_id+schoonmaker_id
    const { match_id, aanvraag_id, schoonmaker_id } = req.body;

    // UUID format validatie (basic)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Option 1: match_id (via mail link - preferred, more secure)
    if (match_id) {
      if (!uuidPattern.test(match_id)) {
        console.warn(`[approve] Invalid match_id format [${correlationId}]`, match_id);
        return res.status(400).json({
          error: 'Bad Request',
          details: 'match_id must be a valid UUID'
        });
      }

      console.log(`[approve] Request validated (via match_id) [${correlationId}]`, { match_id });

      // Roep service functie aan met match_id (just pass the string, not an object)
      const result = await aanvraagService.approveByMatchId(match_id, correlationId);

      console.log(`[approve] ========== SUCCESS ========== [${correlationId}]`);

      // Handle both aanvraag and opdracht responses
      const responseData = {
        schoonmaker_id: result.schoonmaker.id,
        match_id: result.match.id,
        status: result.match.status
      };
      
      if (result.aanvraag) {
        responseData.aanvraag_id = result.aanvraag.id;
        responseData.abonnement_id = result.abonnement.id;
      }
      
      if (result.opdracht) {
        responseData.opdracht_id = result.opdracht.id;
      }

      return res.status(200).json({
        success: true,
        message: result.aanvraag ? 'Aanvraag succesvol goedgekeurd' : 'Opdracht succesvol goedgekeurd',
        data: responseData
      });
    }

    // Option 2: aanvraag_id + schoonmaker_id (via dashboard - backward compatible)
    if (!aanvraag_id) {
      console.warn(`[approve] Missing aanvraag_id or match_id [${correlationId}]`);
      return res.status(400).json({
        error: 'Bad Request',
        details: 'Either match_id or both aanvraag_id and schoonmaker_id are required'
      });
    }

    if (!schoonmaker_id) {
      console.warn(`[approve] Missing schoonmaker_id [${correlationId}]`);
      return res.status(400).json({
        error: 'Bad Request',
        details: 'schoonmaker_id is required when using aanvraag_id'
      });
    }

    if (!uuidPattern.test(aanvraag_id)) {
      console.warn(`[approve] Invalid aanvraag_id format [${correlationId}]`, aanvraag_id);
      return res.status(400).json({
        error: 'Bad Request',
        details: 'aanvraag_id must be a valid UUID'
      });
    }

    if (!uuidPattern.test(schoonmaker_id)) {
      console.warn(`[approve] Invalid schoonmaker_id format [${correlationId}]`, schoonmaker_id);
      return res.status(400).json({
        error: 'Bad Request',
        details: 'schoonmaker_id must be a valid UUID'
      });
    }

    console.log(`[approve] Request validated (via aanvraag_id) [${correlationId}]`, {
      aanvraag_id,
      schoonmaker_id
    });

    // Roep service functie aan
    const result = await aanvraagService.approve({
      aanvraagId: aanvraag_id,
      schoonmakerId: schoonmaker_id
    }, correlationId);

    console.log(`[approve] ========== SUCCESS ========== [${correlationId}]`);

    // Success response
    return res.status(200).json({
      success: true,
      message: 'Aanvraag succesvol goedgekeurd',
      data: {
        aanvraag_id: result.aanvraag.id,
        abonnement_id: result.abonnement.id,
        schoonmaker_id: result.schoonmaker.id,
        match_id: result.match.id,
        status: result.match.status
      }
    });

  } catch (error) {
    console.error(`[approve] ========== ERROR ========== [${correlationId}]`);
    console.error(`[approve] Error:`, error.message);
    console.error(`[approve] Stack:`, error.stack);

    // Gebruik error handler voor consistent error format
    return handleErrorResponse(res, error, correlationId);
  }
}
