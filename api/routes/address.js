// api/routes/address.js
/**
 * API Route voor het ophalen van adresgegevens.
 * Endpoint: GET /api/address
 */
import { getExternalAddressDetails } from '../checks/addressLookupService.js';
import { handleErrorResponse } from '../utils/errorHandler.js'; // Optioneel, als je de helper gebruikt
import { v4 as uuidv4 } from 'uuid'; // Voor correlationId

export default async function handler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('X-Correlation-ID', correlationId);

  // Basis CORS (Vercel handelt dit meestal al goed af via vercel.json)
  res.setHeader('Access-Control-Allow-Origin', '*'); // Of specifieker domein
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    const msg = 'Method Not Allowed. Only GET requests are accepted for this endpoint.';
    console.warn(JSON.stringify({ correlationId, level: 'WARN', message: msg, method: req.method, url: req.url }));
    return res.status(405).json({ correlationId, message: msg });
  }

  const { postcode, huisnummer } = req.query;
  const logMeta = {
    correlationId,
    route: '/api/address',
    method: 'GET',
    postcode,
    huisnummer,
  };

  console.log(JSON.stringify({ ...logMeta, level: 'INFO', message: 'Request ontvangen voor adres ophalen.' }));

  if (!postcode || !huisnummer) {
    const msg = 'Query parameters "postcode" en "huisnummer" zijn verplicht.';
    console.warn(JSON.stringify({ ...logMeta, level: 'WARN', message: msg }));
    return res.status(400).json({ correlationId, message: msg });
  }

  try {
    const addressDetails = await getExternalAddressDetails(postcode, String(huisnummer), correlationId); // Zorg dat huisnummer een string is
    console.log(JSON.stringify({ ...logMeta, level: 'INFO', message: 'Adres succesvol opgehaald en verstuurd.', adres: addressDetails }));
    return res.status(200).json(addressDetails);
  } catch (error) {
    // Gebruik de handleErrorResponse util als die bestaat, anders handmatige afhandeling
    if (handleErrorResponse) {
       handleErrorResponse(res, error, undefined, correlationId);
    } else {
      const statusCode = typeof error.code === 'number' ? error.code : 500;
      const message = error.message || 'Interne serverfout bij het ophalen van adresgegevens.';
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: `Fout bij adres ophalen: ${message}`,
        statusCode,
        errorDetails: { name: error.name, message: error.message, code: error.code /*, stack: error.stack*/ },
      }));
      return res.status(statusCode).json({ correlationId, message });
    }
  }
}
