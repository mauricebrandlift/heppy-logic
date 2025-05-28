import { apiClient, ApiError } from './client.js';

/**
 * Haalt de dekkingsstatus op van de backend API op basis van plaatsnaam.
 *
 * @param {string} plaats De plaatsnaam.
 * @returns {Promise<{gedekt: boolean}>} Een object dat aangeeft of de plaats gedekt is.
 * @throws {ApiError} Bij een API error (HTTP status >= 400) van de backend.
 * @throws {Error} Bij netwerkfouten, timeout, of als plaats leeg is.
 */
export async function fetchCoverageStatus(plaats) {
  // Client-side validatie
  if (!plaats || typeof plaats !== 'string' || plaats.trim() === '') {
    // console.warn('[fetchCoverageStatus] Plaats is verplicht.');
    throw new Error('Plaats is verplicht om dekkingsstatus op te halen.');
  }

  const params = new URLSearchParams({ plaats: plaats.trim() });
  // API_CONFIG.BASE_URL is 'https://.../api'
  // De backend route is 'api/routes/coverage.js', gemapt naar '/api/routes/coverage'
  // De apiClient voegt BASE_URL ('.../api') en endpoint samen.
  // Dus endpoint moet '/routes/coverage' zijn.
  const endpoint = `/routes/coverage?${params.toString()}`;

  // console.debug(`[fetchCoverageStatus] Calling API endpoint: ${endpoint}`);

  try {
    // Gebruik de apiClient voor de daadwerkelijke call
    const coverageData = await apiClient(endpoint, { method: 'GET' });
    // console.debug('[fetchCoverageStatus] Dekkingsstatus succesvol ontvangen:', coverageData);
    return coverageData; // Verwacht { gedekt: boolean }
  } catch (error) {
    // De apiClient gooit al een ApiError of een generieke Error.
    // console.error(`[fetchCoverageStatus] Fout bij ophalen dekkingsstatus voor ${plaats}:`, error);
    throw error; // Gooi de error (ApiError of Error) door naar de caller
  }
}
