/**
 * API Route: Get Match Details
 * 
 * GET /api/routes/match/details?match_id=xxx
 * 
 * Returns full match details with aanvraag/opdracht and klant info
 * Used by frontend schoonmaakActiePage.js to display match information
 * 
 * Response Success (200):
 * {
 *   "success": true,
 *   "data": {
 *     "match_id": "uuid",
 *     "status": "open|geaccepteerd|geweigerd",
 *     "type": "aanvraag|opdracht",
 *     "created_at": "timestamp",
 *     "schoonmaker": {
 *       "id": "uuid",
 *       "voornaam": "Jan",
 *       "achternaam": "de Vries"
 *     },
 *     "aanvraag": { ... } | "opdracht": { ... },
 *     "klant": {
 *       "voornaam": "...",
 *       "achternaam": "...",
 *       "email": "..."
 *     }
 *   }
 * }
 */

import { matchService } from '../../services/matchService.js';
import { handleErrorResponse } from '../../utils/errorHandler.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, Authorization');

  // Correlation ID
  const correlationId = req.headers['x-correlation-id'] || `match-details-${Date.now()}`;
  if (correlationId) {
    res.setHeader('X-Correlation-ID', correlationId);
  }

  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only GET allowed
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    console.warn(`[match/details] Method ${req.method} not allowed [${correlationId}]`);
    return res.status(405).json({ 
      error: 'Method Not Allowed',
      details: 'Only GET requests are accepted for this endpoint.'
    });
  }

  try {
    console.log(`[match/details] ========== START ========== [${correlationId}]`);
    
    // Get match_id from query params
    const { match_id } = req.query;

    if (!match_id) {
      console.warn(`[match/details] Missing match_id [${correlationId}]`);
      return res.status(400).json({
        error: 'Bad Request',
        details: 'match_id query parameter is required'
      });
    }

    // UUID validation
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(match_id)) {
      console.warn(`[match/details] Invalid match_id format [${correlationId}]`, match_id);
      return res.status(400).json({
        error: 'Bad Request',
        details: 'match_id must be a valid UUID'
      });
    }

    console.log(`[match/details] Fetching match details [${correlationId}]`, { match_id });

    // Fetch match details via matchService
    const matchDetails = await matchService.getMatchDetails(match_id, correlationId);

    console.log(`[match/details] ========== SUCCESS ========== [${correlationId}]`);

    return res.status(200).json({
      success: true,
      data: matchDetails
    });

  } catch (error) {
    console.error(`[match/details] ========== ERROR ========== [${correlationId}]`, {
      message: error.message,
      stack: error.stack
    });

    return handleErrorResponse(res, error, correlationId);
  }
}
