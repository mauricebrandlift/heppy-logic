/**
 * Business logic for address coverage and information retrieval.
 * Queries the Supabase REST API to determine if an address is covered
 * and returns full details (street, city, latitude, longitude).
 *
 * @module api/checks/addressCheck
 * @version 1.0.0
 */

import { CONFIG } from '../config/index.js';

/**
 * Checks address coverage and retrieves address details.
 *
 * @param {{ postcode: string, huisnummer: string, toevoeging?: string }} data
 * @returns {Promise<{ isCovered: boolean, street?: string, city?: string, latitude?: number, longitude?: number }>} Coverage status and address info
 * @throws {Error & { code: number }} On validation or REST errors
 */
export async function addressCheck(data) {
  const { postcode, huisnummer, toevoeging } = data || {};
  if (!postcode || !huisnummer) {
    const err = new Error('postcode en huisnummer zijn verplicht');
    err.code = 400;
    throw err;
  }

  const { supabaseUrl, supabaseKey, addressTable } = CONFIG;
  const params = new URLSearchParams();
  params.set('postcode', `eq.${encodeURIComponent(postcode)}`);
  params.set('huisnummer', `eq.${encodeURIComponent(huisnummer)}`);
  if (toevoeging) params.set('toevoeging', `eq.${encodeURIComponent(toevoeging)}`);
  const selectFields = ['street','city','latitude','longitude'].join(',');
  const url = `${supabaseUrl}/rest/v1/${addressTable}?select=${selectFields}&${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(text || response.statusText);
    err.code = response.status;
    throw err;
  }

  const records = await response.json();
  const record = Array.isArray(records) && records.length > 0 ? records[0] : null;

  return {
    isCovered: !!record,
    street: record?.street,
    city: record?.city,
    latitude: record?.latitude,
    longitude: record?.longitude
  };
}
