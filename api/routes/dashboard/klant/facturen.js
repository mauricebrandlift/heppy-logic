// api/routes/dashboard/klant/facturen.js
/**
 * Haal alle facturen op voor ingelogde klant
 * Leest direct uit facturen tabel (bevat Invoices én Receipts)
 * 
 * GET /api/routes/dashboard/klant/facturen
 * 
 * Returns:
 * - facturen: Array van facturen met pdf_url (Receipt of Invoice link)
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { handleErrorResponse } from '../../../utils/errorHandler.js';
import { withAuth } from '../../../utils/authMiddleware.js';

async function facturenHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `facturen-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    const user = req.user; // User is already verified by withAuth middleware

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/facturen',
      action: 'fetch_start',
      userId: user.id
    }));

    // Haal alle facturen op uit facturen tabel
    const facturenResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/facturen?gebruiker_id=eq.${user.id}&select=id,factuur_nummer,factuurdatum,totaal_cents,status,pdf_url,omschrijving,abonnement_id,opdracht_id,aangemaakt_op&order=aangemaakt_op.desc`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      },
      correlationId
    );

    if (!facturenResponse.ok) {
      throw new Error(`Failed to fetch facturen: ${facturenResponse.status}`);
    }

    const facturen = await facturenResponse.json();

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/facturen',
      action: 'fetch_complete',
      userId: user.id,
      totalFacturen: facturen.length
    }));

    return res.status(200).json({
      correlationId,
      facturen,
      count: facturen.length
    });

  } catch (error) {
    return handleErrorResponse(error, res, correlationId);
  }
}

// Export with auth middleware wrapper
export default withAuth(facturenHandler, { roles: ['klant'] });
