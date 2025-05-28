// api/utils/apiClient.js
/**
 * Generieke HTTP client voor backend-naar-externe API calls.
 * Kan uitgebreid worden met standaard headers, timeouts, retries etc.
 */
import fetch from 'node-fetch'; // Zorg dat node-fetch geïnstalleerd is als je Node.js < 18 gebruikt

/**
 * Voert een fetch request uit.
 * @param {string} url De URL om te fetchen.
 * @param {object} options Fetch opties (method, headers, body, etc.).
 * @param {string} [correlationId] Optionele correlation ID voor logging.
 * @returns {Promise<Response>} De fetch Response object.
 * @throws {Error} Als de fetch call zelf faalt (netwerk error).
 */
export async function httpClient(url, options = {}, correlationId) {
  const logMeta = {
    correlationId,
    utility: 'apiClient.httpClient',
    url,
    method: options.method || 'GET',
  };

  // console.log(JSON.stringify({ ...logMeta, level: 'INFO', message: 'Executing HTTP request' }));

  try {
    const response = await fetch(url, options);
    // console.log(JSON.stringify({ ...logMeta, level: 'INFO', message: `HTTP request completed with status: ${response.status}` }));
    return response;
  } catch (error) {
    console.error(JSON.stringify({
      ...logMeta,
      level: 'ERROR',
      message: 'HTTP request failed',
      error: error.message,
      stack: error.stack,
    }));
    throw error; // Gooi de error door zodat de caller het kan afhandelen
  }
}

// Voorbeeld van een meer specifieke functie die httpClient gebruikt:
// export async function getJson(url, headers = {}, correlationId) {
//   const response = await httpClient(url, { method: 'GET', headers }, correlationId);
//   if (!response.ok) {
//     const errorText = await response.text();
//     throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
//   }
//   return response.json();
// }
