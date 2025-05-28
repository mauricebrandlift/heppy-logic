// public/utils/api/client.js
/**
 * Generieke client-side fetch wrapper voor API calls.
 * Behandelt basis URL, standaard headers, en error handling.
 */
import { API_CONFIG } from '../../config/apiConfig.js'; // Importeer de configuratie

const BASE_API_PATH = '/api'; // Basispad voor alle backend API-calls

/**
 * Custom Error class voor API fouten aan de client-zijde.
 * Volgens api-guidelines.md (punt 4).
 */
export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // HTTP status code
    this.data = data;     // Optionele data, bijv. de JSON error body van de server
  }
}

/**
 * Voert een API call uit naar de backend.
 *
 * @param {string} endpoint Het API endpoint (bijv. '/address').
 * @param {object} [options={}] Fetch opties (method, body, headers, etc.).
 * @param {number} [timeout=5000] Timeout in milliseconds (volgens api-guidelines.md punt 3).
 * @returns {Promise<any>} De JSON response data van de API.
 * @throws {ApiError} Bij een API error (HTTP status >= 400).
 * @throws {Error} Bij netwerkfouten of timeout.
 */
export async function apiClient(endpoint, options = {}, timeout = 5000) {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`; // Gebruik de volledige BASE_URL
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const defaultHeaders = {
    'Content-Type': 'application/json',
    // 'X-Correlation-ID': generateFrontendCorrelationId(), // Optioneel: genereer en stuur mee
    ...options.headers,
  };

  // Voor GET requests, body is niet toegestaan.
  const fetchOptions = {
    ...options,
    headers: defaultHeaders,
    signal: controller.signal,
  };
  if (options.method === 'GET' || !options.method) {
    delete fetchOptions.body;
  }


  // Logging (volgens api-guidelines.md punt 6 - logDebug)
  // console.debug('API Request:', { url, options: fetchOptions });

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId); // Clear timeout als de request succesvol was (of faalde met een response)

    const responseData = await response.json().catch(() => {
      // Als parsen van JSON faalt, maar status is ok, kan dit een issue zijn.
      // Als status niet ok is, is de body mogelijk geen JSON.
      return { message: response.statusText }; // Fallback
    });

    if (!response.ok) {
      // console.error('API Error Response:', { status: response.status, url, responseData });
      throw new ApiError(response.status, responseData.message || `API Fout: ${response.status}`, responseData);
    }

    // console.debug('API Success Response:', { status: response.status, url, responseData });
    return responseData;
  } catch (error) {
    clearTimeout(timeoutId); // Zorg dat timeout ook gecleared wordt bij een error
    if (error instanceof ApiError) {
      throw error; // Gooi ApiError direct door
    }
    if (error.name === 'AbortError') {
      // console.error('API Request Timeout:', { url });
      throw new Error(`Request naar ${url} timed out na ${timeout / 1000}s.`);
    }
    // console.error('Network/Fetch Error:', { url, error });
    throw new Error(error.message || 'Netwerkfout of onverwachte fout bij API call.');
  }
}
