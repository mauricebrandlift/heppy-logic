// public/utils/api/cleaners.js
/**
 * API functies specifiek voor het ophalen van schoonmakers
 */
import { apiClient } from './client.js';

/**
 * Haalt beschikbare schoonmakers op op basis van plaats, uren en optionele dagdelen.
 * Voor abonnementen: gebruikt dagdelen en recurring beschikbaarheid
 * Voor dieptereiniging: gebruikt specifieke datum en tijdvenster (08:00-10:00)
 *
 * @param {Object} params - Parameters voor de zoekopdracht
 * @param {string} params.plaats - De plaats waar de schoonmakers moeten werken
 * @param {number} params.uren - Het aantal gewenste uren voor de schoonmaak
 * @param {Object|null} [params.dagdelen=null] - Optionele dagdelen structuur voor abonnementen: { 'maandag': ['ochtend', 'middag'], 'dinsdag': ['avond'] }
 * @param {string} [params.type='abonnement'] - Type schoonmaak: 'abonnement' of 'dieptereiniging'
 * @param {string} [params.datum=null] - Specifieke datum (YYYY-MM-DD) voor dieptereiniging
 * @param {string} [params.minUren=null] - Alternatieve parameter naam voor uren (backwards compatibility)
 * @returns {Promise<Object>} Response object met cleaners array en metadata
 * @throws {ApiError} Bij een API error (HTTP status >= 400)
 * @throws {Error} Bij netwerkfouten, timeout, of als verplichte parameters ontbreken
 */
export async function fetchAvailableCleaners({ plaats, uren, dagdelen = null, type = 'abonnement', datum = null, minUren = null }) {
  // Client-side validatie
  if (!plaats || typeof plaats !== 'string' || plaats.trim() === '') {
    throw new Error('Plaats is verplicht om beschikbare schoonmakers op te halen.');
  }

  // Gebruik minUren als uren niet is gegeven (backwards compatibility)
  const urenValue = uren !== undefined ? uren : minUren;

  if (urenValue === undefined || urenValue === null || isNaN(Number(urenValue))) {
    throw new Error('Aantal uren moet een geldig getal zijn.');
  }

  // Route naar juiste endpoint op basis van type
  if (type === 'dieptereiniging') {
    // Dieptereiniging: GET request met query params
    if (!datum) {
      throw new Error('Datum is verplicht voor dieptereiniging schoonmakers.');
    }

    const queryParams = new URLSearchParams({
      plaats: plaats.trim(),
      datum: datum,
      minUren: String(urenValue)
    });

    console.log('[api/cleaners] Ophalen dieptereiniging schoonmakers:', { plaats, datum, minUren: urenValue });

    try {
      const response = await apiClient(`/routes/cleaners-dieptereiniging?${queryParams.toString()}`, {
        method: 'GET',
      });

      console.log(`[api/cleaners] ${response.cleaners?.length || 0} dieptereiniging schoonmakers opgehaald`);
      return response;
    } catch (error) {
      console.error('[api/cleaners] Fout bij ophalen dieptereiniging schoonmakers:', error);
      throw error;
    }
  } else {
    // Abonnement: POST request met JSON body
    const requestBody = {
      plaats: plaats.trim(),
      uren: Number(urenValue),
      dagdelen: dagdelen || null, // Als null, worden alle schoonmakers in de plaats opgehaald
    };

    console.log('[api/cleaners] Ophalen abonnement schoonmakers:', requestBody);

    try {
      const cleaners = await apiClient('/routes/cleaners', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      console.log(`[api/cleaners] ${cleaners.length || 0} abonnement schoonmakers opgehaald`);
      return { cleaners }; // Wrap in object for consistency
    } catch (error) {
      console.error('[api/cleaners] Fout bij ophalen abonnement schoonmakers:', error);
      throw error;
    }
  }
}
