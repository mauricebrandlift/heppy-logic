/**
 * Domain-specific API for address-related endpoints.
 * Retrieves coverage status and full address information including coordinates.
 *
 * @module public/utils/api/checks/address
 * @version 1.1.1
 */

import { post } from '../client.js';

/**
 * Retrieves coverage and complete address details from the backend.
 * @param {{ postcode: string, huisnummer: string, toevoeging?: string }} data
 * @returns {Promise<{ isCovered: boolean, street?: string, city?: string, latitude?: number, longitude?: number }>} Backend response with coverage status and address data.
 * @throws {Error} On network or HTTP errors
 */
export async function getAddressInfo(data) {
  return post('/checks/addressCheck', data);
}
