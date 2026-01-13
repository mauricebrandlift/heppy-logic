// public/utils/api/match.js
/**
 * API client functies voor match operaties (schoonmaker approve/decline)
 */

import { apiClient } from './client.js';

/**
 * Haal match details op
 * @param {string} matchId - UUID van de match
 * @returns {Promise<object>} Match details met aanvraag/opdracht en klant info
 */
export async function fetchMatchDetails(matchId) {
  return apiClient(`/routes/match/details?match_id=${matchId}`, {
    method: 'GET'
  });
}

/**
 * Accepteer een match (schoonmaker keurt aanvraag/opdracht goed)
 * @param {string} matchId - UUID van de match
 * @returns {Promise<object>} Result van approval
 */
export async function approveMatch(matchId) {
  return apiClient('/routes/aanvraag/approve', {
    method: 'POST',
    body: { match_id: matchId }
  });
}

/**
 * Weiger een match (schoonmaker keurt aanvraag/opdracht af)
 * @param {string} matchId - UUID van de match
 * @param {string} reden - Reden voor afwijzing
 * @returns {Promise<object>} Result van rejection met mogelijke nieuwe match
 */
export async function rejectMatch(matchId, reden) {
  return apiClient('/routes/aanvraag/reject', {
    method: 'POST',
    body: { match_id: matchId, reden }
  });
}
