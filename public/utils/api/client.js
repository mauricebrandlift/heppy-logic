/**
 * HTTP-client voor frontend naar backend API.
 * Bevat generieke methods voor GET, POST, PUT en DELETE requests.
 *
 * @module public/utils/api/client
 * @version 1.0.0
 */

/**
 * Voert een HTTP-request uit naar het backend endpoint.
 * @param {string} path - Relatief pad (bijv. '/address')
 * @param {object} [options] - Fetch-opties (method, headers, body)
 * @returns {Promise<any>} De geparseerde JSON-response
 * @throws {Error} Bij netwerk- of HTTP-fouten
 */
async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const contentType = response.headers.get('Content-Type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    const message = payload?.message || response.statusText;
    throw new Error(message);
  }

  return payload;
}

/**
 * Haalt data op met een GET-request.
 * @param {string} path
 * @returns {Promise<any>}
 */
export async function get(path) {
  return request(path, { method: 'GET' });
}

/**
 * Stuurt data met een POST-request.
 * @param {string} path
 * @param {object} body - Request-body
 * @returns {Promise<any>}
 */
export async function post(path, body) {
  return request(path, { method: 'POST', body: JSON.stringify(body) });
}

/**
 * Update data met een PUT-request.
 * @param {string} path
 * @param {object} body
 * @returns {Promise<any>}
 */
export async function put(path, body) {
  return request(path, { method: 'PUT', body: JSON.stringify(body) });
}

/**
 * Verwijdert data met een DELETE-request.
 * @param {string} path
 * @returns {Promise<any>}
 */
export async function remove(path) {
  return request(path, { method: 'DELETE' });
}
