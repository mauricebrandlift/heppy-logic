import { getCoverageStatus } from '../checks/coverageLookupService.js';
import { handleErrorResponse } from '../utils/errorHandler.js';

export default async function handler(req, res) {
  // Stel CORS headers in
  res.setHeader('Access-Control-Allow-Origin', '*'); // Of specifieker: 'https://heppy-schoonmaak.webflow.io'
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Correlation-ID, Authorization' // Match address.js by including Authorization
  );

  // Handel OPTIONS (preflight) request af
  if (req.method === 'OPTIONS') {
    res.status(200).end(); // Use 200 OK for the preflight response
    return;
  }

  const correlationId = req.headers['x-correlation-id'];
  if (correlationId) {
    res.setHeader('X-Correlation-ID', correlationId);
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    const msg = 'Method Not Allowed. Only GET requests are accepted for this endpoint.';
    console.warn(JSON.stringify({ correlationId: correlationId || 'not-provided', level: 'WARN', message: msg, method: req.method, url: req.url }));
    return res.status(405).json({ correlationId: correlationId || 'not-provided', message: msg });
  }

  const { plaats } = req.query;
  const logMeta = {
    correlationId: correlationId || 'not-provided',
    route: req.url,
    method: req.method,
    plaats,
  };

  console.log(JSON.stringify({ ...logMeta, level: 'INFO', message: 'Request ontvangen voor dekkingscontrole.' }));

  if (!plaats || typeof plaats !== 'string' || plaats.trim() === '') {
    const msg = 'Query parameter "plaats" is verplicht en moet een non-lege string zijn.';
    console.warn(JSON.stringify({ ...logMeta, level: 'WARN', message: msg }));
    return res.status(400).json({ correlationId: logMeta.correlationId, message: msg });
  }

  try {
    const coverageDetails = await getCoverageStatus(plaats.trim(), logMeta.correlationId);
    console.log(JSON.stringify({ ...logMeta, level: 'INFO', message: 'Dekkingsstatus succesvol opgehaald en verstuurd.', coverage: coverageDetails }));
    return res.status(200).json(coverageDetails); // Verwacht { gedekt: boolean }
  } catch (error) {
    handleErrorResponse(res, error, undefined, logMeta.correlationId);
  }
}
