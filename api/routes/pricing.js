// api/routes/pricing.js
/**
 * API Route voor het ophalen van prijsconfiguratie.
 * Endpoint: GET /api/pricing
 */
import { supabaseConfig } from '../config/index.js';
import { handleErrorResponse } from '../utils/errorHandler.js';

export default async function handler(req, res) {
  // Stel CORS headers in voor ALLE responses van deze functie
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
    const { url: supabaseUrl, anonKey: supabaseAnonKey } = supabaseConfig;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuratie ontbreekt.');
    }

    // Haal de prijsconfiguratie data op uit Supabase
    const response = await fetch(`${supabaseUrl}/rest/v1/prijs_configuratie`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Fout bij ophalen prijsconfiguratie data',
        status: response.status,
        error: errorText,
      }));
      throw new Error(`Fout bij ophalen prijsconfiguratie: ${response.status}`);
    }

    const pricingData = await response.json();
    console.log(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Prijsconfiguratie succesvol opgehaald',
      itemCount: Array.isArray(pricingData) ? pricingData.length : 0,
    }));

    return res.status(200).json({
      correlationId: correlationId || 'not-provided',
      pricing: pricingData,
    });
  } catch (error) {
    return handleErrorResponse(error, res, correlationId, 'Error fetching pricing configuration');
  }
}
