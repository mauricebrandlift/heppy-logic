// api/checks/addressLookupService.js
/**
 * Service voor het ophalen van adresgegevens van een externe API.
 * Deze service bevat de business logica en wordt aangeroepen door een route handler.
 */
import { postcodeApiConfig } from '../config/index.js';
// import { httpClient } from '../utils/apiClient.js'; // Als je de generieke client wilt gebruiken

// Tijdelijke import voor fetch als node-fetch niet globaal is of voor Node 18+
// import fetch from 'node-fetch'; // Verwijder als httpClient wordt gebruikt of Node >= 18

/**
 * Haalt adresgegevens op van de externe Postcode API.
 *
 * @param {string} postcode De postcode.
 * @param {string} huisnummer Het huisnummer.
 * @param {string} correlationId De correlation ID voor logging en tracing.
 * @returns {Promise<object>} Een object met de adresgegevens { straat, plaats, ... }.
 * @throws {Error} Gooit een error als de API call faalt, geen adres wordt gevonden, of configuratie mist.
 */
export async function getExternalAddressDetails(postcode, huisnummer, correlationId) {
  const { baseUrl, apiKey } = postcodeApiConfig;
  const logMeta = {
    correlationId,
    service: 'addressLookupService.getExternalAddressDetails',
    postcode,
    huisnummer,
  };

  if (!baseUrl || !apiKey) {
    console.error(JSON.stringify({
      ...logMeta,
      level: 'ERROR',
      message: 'Postcode API URL of API Key ontbreekt in de configuratie.',
    }));
    const err = new Error('Server configuratiefout: Postcode API details missen.');
    err.code = 500; // Internal Server Error
    throw err;
  }

  if (!postcode || !huisnummer) {
    console.warn(JSON.stringify({ ...logMeta, level: 'WARN', message: 'Postcode en huisnummer zijn verplicht.' }));
    const err = new Error('Postcode en huisnummer zijn verplicht.');
    err.code = 400; // Bad Request
    throw err;
  }

  // Normaliseer invoer voor v3: postcode zonder spatie, uppercase; huisnummer alleen numeriek gedeelte
  const normalizedPostcode = String(postcode).replace(/\s+/g, '').toUpperCase();
  const numberMatch = String(huisnummer).match(/^(\d+)/);
  const normalizedNumber = numberMatch ? numberMatch[1] : String(huisnummer);

  // v3 endpoint structuur: /lookup/{postcode}/{number}
  const apiUrl = `${baseUrl}/lookup/${normalizedPostcode}/${normalizedNumber}`;

  console.log(JSON.stringify({ ...logMeta, level: 'INFO', message: `Externe API call naar: ${apiUrl}` }));

  try {
    // Gebruik de generieke httpClient als die is opgezet, anders directe fetch:
    // const response = await httpClient(apiUrl, { headers: { 'X-Api-Key': apiKey } }, correlationId);
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'X-Api-Key': apiKey }, // Pas header naam aan indien nodig
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: `Externe API fout: ${response.status} ${response.statusText}`,
        apiResponse: errorText,
      }));
      const err = new Error(`Fout bij externe adres API: ${response.statusText}`);
      err.code = response.status; // Gebruik de status van de externe API
      err.externalResponse = errorText; // Voeg eventueel de response body toe
      throw err;
    }

    const data = await response.json();

    // v3 geeft direct een object terug (geen _embedded)
    if (!data || !data.postcode || !data.number) {
      console.warn(JSON.stringify({ ...logMeta, level: 'WARN', message: 'Geen adres gevonden voor combinatie.', apiResponse: data }));
      const err = new Error('Geen adres gevonden voor de opgegeven postcode en huisnummer.');
      err.code = 404; // Not Found
      throw err;
    }

    const resultaat = {
      straat: data.street,
      plaats: data.city, // city is string in v3
      postcode: data.postcode,
      huisnummer: String(data.number),
      toevoeging: null, // v3 ondersteunt (nog) geen toevoeging in lookup response
      latitude: Array.isArray(data.location?.coordinates) ? data.location.coordinates[1] : undefined,
      longitude: Array.isArray(data.location?.coordinates) ? data.location.coordinates[0] : undefined,
      // municipality: data.municipality, // Optioneel extra velden
      // province: data.province,
    };

    console.log(JSON.stringify({ ...logMeta, level: 'INFO', message: 'Adres succesvol opgehaald.', adres: resultaat }));
    return resultaat;

  } catch (error) {
    // Als het al een error met een code is (bijv. van de !response.ok check), gooi die door.
    // Anders, log en maak een generieke 500 error.
    if (!error.code) {
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Onverwachte fout tijdens ophalen extern adres.',
        error: error.message,
        stack: error.stack,
      }));
      error.code = 500; // Internal Server Error
      error.message = error.message || 'Interne serverfout bij ophalen adres.';
    }
    throw error;
  }
}
