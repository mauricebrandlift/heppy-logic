// api/routes/dashboard/klant/facturen.js
/**
 * Haal alle facturen op voor ingelogde klant
 * Combineert bestellingen en betalingen met stripe_invoice_id
 * 
 * GET /api/routes/dashboard/klant/facturen
 * 
 * Returns:
 * - facturen: Array van facturen (bestellingen + betalingen)
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

    // Haal bestellingen op met invoice_id
    const bestellingenResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/bestellingen?klant_id=eq.${user.id}&stripe_invoice_id=not.is.null&select=id,bestel_nummer,aangemaakt_op,totaal_cents,stripe_invoice_id,status&order=aangemaakt_op.desc`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }
    );

    const bestellingen = bestellingenResponse.ok ? await bestellingenResponse.json() : [];

    // Haal betalingen op met invoice_id (abonnementen + opdrachten)
    const betalingenResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/betalingen?gebruiker_id=eq.${user.id}&stripe_invoice_id=not.is.null&select=id,aangemaakt_op,amount_cents,stripe_invoice_id,abonnement_id,opdracht_id,status&order=aangemaakt_op.desc`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }
    );

    const betalingen = betalingenResponse.ok ? await betalingenResponse.json() : [];

    // Combineer en normaliseer facturen
    const facturen = [
      // Bestellingen (webshop)
      ...bestellingen.map(b => ({
        id: b.id,
        type: 'bestelling',
        bestel_nummer: b.bestel_nummer,
        aangemaakt_op: b.aangemaakt_op,
        amount_cents: b.totaal_cents,
        stripe_invoice_id: b.stripe_invoice_id,
        status: b.status
      })),
      // Betalingen (abonnementen + opdrachten)
      ...betalingen.map(b => ({
        id: b.id,
        type: 'betaling',
        aangemaakt_op: b.aangemaakt_op,
        amount_cents: b.amount_cents,
        stripe_invoice_id: b.stripe_invoice_id,
        abonnement_id: b.abonnement_id,
        opdracht_id: b.opdracht_id,
        status: b.status
      }))
    ];

    // Sorteer op datum (nieuwste eerst)
    facturen.sort((a, b) => new Date(b.aangemaakt_op) - new Date(a.aangemaakt_op));

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/facturen',
      action: 'fetch_complete',
      userId: user.id,
      bestellingenCount: bestellingen.length,
      betalingenCount: betalingen.length,
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
