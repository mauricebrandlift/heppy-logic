// api/routes/orders/by-invoice.js
/**
 * API Route voor het ophalen van bestelling via Stripe Invoice ID
 * Endpoint: GET /api/routes/orders/by-invoice?invoice_id=inv_xxx
 */

import { supabaseConfig } from '../../config/index.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID');

  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const correlationId = req.headers['x-correlation-id'] || 'not-provided';
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      correlationId,
      error: 'Method Not Allowed'
    });
  }

  const logMeta = {
    correlationId,
    endpoint: '/api/routes/orders/by-invoice'
  };

  try {
    const { invoice_id } = req.query;

    if (!invoice_id) {
      console.warn(JSON.stringify({
        ...logMeta,
        level: 'WARN',
        message: 'Missing invoice_id parameter'
      }));
      return res.status(400).json({
        correlationId,
        error: 'invoice_id parameter is verplicht',
        code: 'MISSING_INVOICE_ID'
      });
    }

    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Fetching order by invoice',
      invoiceId: invoice_id
    }));

    // Fetch bestelling from database
    const url = `${supabaseConfig.url}/rest/v1/bestellingen?stripe_invoice_id=eq.${invoice_id}&select=*`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Supabase query failed',
        error: errorData
      }));
      return res.status(500).json({
        correlationId,
        error: 'Database query mislukt',
        code: 'DB_ERROR'
      });
    }

    const bestellingen = await response.json();

    if (bestellingen.length === 0) {
      console.warn(JSON.stringify({
        ...logMeta,
        level: 'WARN',
        message: 'Bestelling not found',
        invoiceId: invoice_id
      }));
      return res.status(404).json({
        correlationId,
        error: 'Bestelling niet gevonden',
        code: 'ORDER_NOT_FOUND'
      });
    }

    const bestelling = bestellingen[0];

    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Bestelling found',
      bestellingId: bestelling.id,
      status: bestelling.status
    }));

    return res.status(200).json(bestelling);

  } catch (error) {
    console.error(JSON.stringify({
      ...logMeta,
      level: 'ERROR',
      message: 'Unexpected error',
      error: error.message,
      stack: error.stack
    }));

    return res.status(500).json({
      correlationId,
      error: error.message || 'Er is een fout opgetreden',
      code: 'INTERNAL_ERROR'
    });
  }
}
