// public/utils/api/sollicitatie.js
/**
 * API functies specifiek voor sollicitatie-gerelateerde calls.
 */
import { apiClient, ApiError } from './client.js';

/**
 * Verstuurt een sollicitatie naar de backend API.
 * Functienaam volgens api-guidelines.md (punt 1).
 *
 * @param {object} sollicitatieData De sollicitatie gegevens.
 * @param {string} sollicitatieData.geslacht Geslacht (man/vrouw/anders).
 * @param {string} sollicitatieData.geboortedatum Geboortedatum (YYYY-MM-DD).
 * @param {string} sollicitatieData.voornaam Voornaam van sollicitant.
 * @param {string} sollicitatieData.achternaam Achternaam van sollicitant.
 * @param {string} sollicitatieData.woonplaats Woonplaats van sollicitant.
 * @param {string} sollicitatieData.telefoon Telefoonnummer van sollicitant.
 * @param {string} sollicitatieData.ervaringmotivatie Ervaring en motivatie tekst.
 * @param {string} sollicitatieData.emailadres E-mailadres voor account.
 * @param {string} sollicitatieData.wachtwoord Gewenst wachtwoord.
 * @param {boolean} sollicitatieData.akkoordVoorwaarden Akkoord met voorwaarden.
 * @returns {Promise<object>} Een object met resultaat van de sollicitatie.
 * @throws {ApiError} Bij een API error (HTTP status >= 400) van de backend.
 * @throws {Error} Bij netwerkfouten, timeout, of validatie fouten.
 */
export async function submitSollicitatie(sollicitatieData) {
  // Client-side validatie
  if (!sollicitatieData || typeof sollicitatieData !== 'object') {
    throw new Error('Sollicitatie gegevens zijn verplicht.');
  }

  // Valideer verplichte velden
  const requiredFields = [
    'geslacht', 'geboortedatum', 'voornaam', 'achternaam', 
    'woonplaats', 'telefoon', 'ervaringmotivatie', 
    'emailadres', 'wachtwoord', 'akkoordVoorwaarden'
  ];

  for (const field of requiredFields) {
    if (!sollicitatieData[field]) {
      throw new Error(`Veld '${field}' is verplicht voor sollicitatie.`);
    }
  }

  // Controleer of akkoord met voorwaarden is gegeven
  if (!sollicitatieData.akkoordVoorwaarden) {
    throw new Error('Je moet akkoord gaan met de voorwaarden om te kunnen solliciteren.');
  }

  const endpoint = '/routes/sollicitatie'; // Het backend endpoint is /api/routes/sollicitatie

  // console.debug(`[submitSollicitatie] Calling API endpoint: ${endpoint}`);

  try {
    // POST request met sollicitatie data
    const response = await apiClient(endpoint, {
      method: 'POST',
      body: JSON.stringify(sollicitatieData)
    });

    // console.debug('[submitSollicitatie] Sollicitatie succesvol verstuurd:', response);

    return response;
  } catch (error) {
    // console.error('[submitSollicitatie] Error tijdens sollicitatie:', error);

    // Als het een ApiError is, gooi hem door (wordt afgehandeld door formHandler)
    if (error instanceof ApiError) {
      throw error;
    }

    // Voor andere fouten, wrap in een generieke Error
    throw new Error('Er is een probleem opgetreden bij het versturen van je sollicitatie. Probeer het later opnieuw.');
  }
}
