// public/utils/api/cleaners.js
/**
 * API functies specifiek voor het ophalen van schoonmakers
 */
import { apiClient } from './client.js';

/**
 * Haalt beschikbare schoonmakers op op basis van plaats, uren en optionele dagdelen.
 *
 * @param {Object} params - Parameters voor de zoekopdracht
 * @param {string} params.plaats - De plaats waar de schoonmakers moeten werken
 * @param {number} params.uren - Het aantal gewenste uren voor de schoonmaak
 * @param {Object|null} [params.dagdelen=null] - Optionele dagdelen structuur in formaat: { 'maandag': ['ochtend', 'middag'], 'dinsdag': ['avond'] }
 * @returns {Promise<Array>} Een array met beschikbare schoonmakers inclusief hun beschikbaarheid
 * @throws {ApiError} Bij een API error (HTTP status >= 400)
 * @throws {Error} Bij netwerkfouten, timeout, of als verplichte parameters ontbreken
 */
export async function fetchAvailableCleaners({ plaats, uren, dagdelen = null }) {
  // Client-side validatie
  if (!plaats || typeof plaats !== 'string' || plaats.trim() === '') {
    throw new Error('Plaats is verplicht om beschikbare schoonmakers op te halen.');
  }

  if (uren === undefined || uren === null || isNaN(Number(uren))) {
    throw new Error('Aantal uren moet een geldig getal zijn.');
  }

  // Maak de request body
  const requestBody = {
    plaats: plaats.trim(),
    uren: Number(uren),
    dagdelen: dagdelen || null, // Als null, worden alle schoonmakers in de plaats opgehaald
  };

  // Log de request details
  console.log('[api/cleaners] Ophalen beschikbare schoonmakers:', requestBody);

  try {
    // Call de API (POST omdat we een JSON body sturen)
    const cleaners = await apiClient('/routes/cleaners', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    console.log(`[api/cleaners] ${cleaners.length || 0} schoonmakers opgehaald`);
    return cleaners;
  } catch (error) {
    console.error('[api/cleaners] Fout bij ophalen schoonmakers:', error);
    throw error;
  }
}
