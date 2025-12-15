// api/routes/address.js
/**
 * API Route voor het ophalen van adresgegevens.
 * Endpoint: GET /api/address
 */
import { getExternalAddressDetails } from '../checks/addressLookupService.js';
import { handleErrorResponse } from '../utils/errorHandler.js'; // Optioneel, als je de helper gebruikt

export default async function handler(req, res) {
  // Stel CORS headers in voor ALLE responses van deze functie, inclusief errors
  res.setHeader('Access-Control-Allow-Origin', '*'); // Of specifieker: 'https://heppy-schoonmaak.webflow.io' of je daadwerkelijke frontend domein
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Correlation-ID, Authorization' // Voeg andere headers toe die je client mogelijk stuurt
  );

  // Belangrijk: Handel de OPTIONS (preflight) request EERST af
  if (req.method === 'OPTIONS') {
    res.status(200).end(); // HTTP 200 OK for preflight
    return;
  }

  // Haal correlationId op als de client deze meestuurt
  const correlationId = req.headers['x-correlation-id']; 
  if (correlationId) {
    // Stuur de correlationId terug in de response header als deze is ontvangen
    res.setHeader('X-Correlation-ID', correlationId);
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    const msg = 'Method Not Allowed. Only GET requests are accepted for this endpoint.';
    // Gebruik de correlationId (kan undefined zijn) in de log en response
    console.warn(JSON.stringify({ correlationId: correlationId || 'not-provided', level: 'WARN', message: msg, method: req.method, url: req.url }));
    return res.status(405).json({ correlationId: correlationId || 'not-provided', message: msg });
  }

  const { postcode, huisnummer } = req.query;
  const logMeta = {
    correlationId: correlationId || 'not-provided', // Gebruik placeholder als niet aanwezig
    route: req.url, // Gebruik req.url voor het daadwerkelijke pad
    method: req.method,
    postcode,
    huisnummer,
  };

  console.log(JSON.stringify({ ...logMeta, level: 'INFO', message: 'Request ontvangen voor adres ophalen.' }));

  if (!postcode || !huisnummer) {
    const msg = 'Query parameters "postcode" en "huisnummer" zijn verplicht.';
    console.warn(JSON.stringify({ ...logMeta, level: 'WARN', message: msg }));
    return res.status(400).json({ correlationId: logMeta.correlationId, message: msg });
  }

  try {
    const addressDetails = await getExternalAddressDetails(postcode, String(huisnummer), logMeta.correlationId); 
    console.log(JSON.stringify({ ...logMeta, level: 'INFO', message: 'Adres succesvol opgehaald en verstuurd.' /*, adres: addressDetails*/ })); // PII in adres niet standaard loggen
    return res.status(200).json(addressDetails);
  } catch (error) {
    // handleErrorResponse met correcte parameter volgorde: (error, res, correlationId)
    return handleErrorResponse(error, res, logMeta.correlationId);
  }
}
