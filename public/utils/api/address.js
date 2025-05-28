// public/utils/api/address.js
/**
 * API functies specifiek voor adres-gerelateerde calls.
 */
import { apiClient, ApiError } from './client.js'; // Importeer de generieke client en ApiError

/**
 * Haalt adresgegevens op van de backend API op basis van postcode en huisnummer.
 * Functienaam volgens api-guidelines.md (punt 1).
 *
 * @param {string} postcode De postcode.
 * @param {string} huisnummer Het huisnummer.
 * @returns {Promise<object>} Een object met de adresgegevens (straat, plaats, etc.).
 * @throws {ApiError} Bij een API error (HTTP status >= 400) van de backend.
 * @throws {Error} Bij netwerkfouten, timeout, of als postcode/huisnummer leeg zijn.
 */
export async function fetchAddressDetails(postcode, huisnummer) {
  // Client-side validatie
  if (!postcode || !huisnummer) {
    // console.warn('[fetchAddressDetails] Postcode en huisnummer zijn verplicht.');
    throw new Error('Postcode en huisnummer zijn verplicht om adresgegevens op te halen.');
  }

  // URL-concat met URLSearchParams (volgens api-guidelines.md punt 2)
  const params = new URLSearchParams({ postcode, huisnummer });
  const endpoint = `/address?${params.toString()}`; // Het backend endpoint is /api/address

  // console.debug(`[fetchAddressDetails] Calling API endpoint: ${endpoint}`);

  try {
    // Gebruik de apiClient voor de daadwerkelijke call
    const addressData = await apiClient(endpoint, { method: 'GET' });
    // console.debug('[fetchAddressDetails] Adresgegevens succesvol ontvangen:', addressData);
    return addressData;
  } catch (error) {
    // De apiClient gooit al een ApiError of een generieke Error.
    // Hier kunnen we eventueel specifiekere logging of error transformatie doen indien nodig.
    // console.error(`[fetchAddressDetails] Fout bij ophalen adres voor ${postcode} ${huisnummer}:`, error);
    throw error; // Gooi de error (ApiError of Error) door naar de caller (het formulier)
  }
}
