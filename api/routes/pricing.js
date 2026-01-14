// api/routes/pricing.js 
/**
 * API Route voor het ophalen van prijsconfiguratie.
 * Endpoint: GET /api/pricing
 */
import { fetchPricingConfiguration, formatPricingConfiguration } from '../services/configService.js';
import { handleErrorResponse } from '../utils/errorHandler.js';

export default async function handler(req, res) {// Stel CORS headers in voor ALLE responses van deze functie
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Correlation-ID, Authorization'
  );
  // Handel de OPTIONS (preflight) request af
  if (req.method === 'OPTIONS') {
    res.status(200).end();
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

  const logMeta = {
    correlationId: correlationId || 'not-provided',
    route: req.url,
    method: req.method,
  };

  console.log(JSON.stringify({ ...logMeta, level: 'INFO', message: 'Request ontvangen voor prijsconfiguratie.' }));
  try {
    // Optionele flow filter uit query (Vercel edge / node: req.query of URL parsing)
    let flowFilter = null;
    try {
      const urlObj = new URL(req.url, 'http://localhost');
      flowFilter = urlObj.searchParams.get('flow');
    } catch (_) {}

    // Gebruik de configService om prijsconfiguratie op te halen (filter op flow indien opgegeven)
    const pricingData = await fetchPricingConfiguration(correlationId, flowFilter || undefined);
    
    // Optioneel: data formatteren (wanneer gewenst)
    // const formattedData = formatPricingConfiguration(pricingData);
    
    console.log(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Prijsconfiguratie succesvol opgehaald via configService',
      itemCount: Array.isArray(pricingData) ? pricingData.length : 0,
    }));

    // Stuur de ongeformatteerde data terug voor compatibiliteit met bestaande frontend
    return res.status(200).json({
      correlationId: correlationId || 'not-provided',
      flow: flowFilter || null,
      pricing: pricingData,
    });
  } catch (error) {
    return handleErrorResponse(res, error, correlationId);
  }
}
