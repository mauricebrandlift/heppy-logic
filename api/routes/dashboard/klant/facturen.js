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

    // Haal alle facturen op uit facturen tabel (inclusief webshop bestellingen)
    const facturenResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/facturen?gebruiker_id=eq.${user.id}&select=id,factuur_nummer,factuurdatum,totaal_cents,status,pdf_url,stripe_invoice_id,omschrijving,abonnement_id,opdracht_id,bestelling_id,regels,aangemaakt_op&order=aangemaakt_op.desc`,
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

    // Transform data voor frontend compatibiliteit
    const transformedFacturen = facturen.map(factuur => {
      // Parse regels voor periode berekening
      let periode_display = null;
      try {
        const regels = JSON.parse(factuur.regels || '[]');
        if (regels.length > 0 && regels[0].periode) {
          const startDate = new Date(regels[0].periode.start);
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 27); // 4 weken = 28 dagen (start + 27)
          
          periode_display = `${startDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        }
      } catch (e) {
        // Fallback naar factuurdatum maand
        const date = new Date(factuur.factuurdatum);
        periode_display = date.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
      }

      return {
        ...factuur,
        amount_cents: factuur.totaal_cents, // Frontend verwacht amount_cents
        invoice_url: factuur.pdf_url, // Voor fallback direct link (indien beschikbaar)
        periode_display, // Voor weergave in UI
        stripe_invoice_id: factuur.stripe_invoice_id // Voor dynamic Invoice URL fetching
      };
    });

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/facturen',
      action: 'fetch_complete',
      userId: user.id,
      totalFacturen: transformedFacturen.length
    }));

    return res.status(200).json({
      correlationId,
      facturen: transformedFacturen,
      count: transformedFacturen.length
    });

  } catch (error) {
    return handleErrorResponse(error, res, correlationId);
  }
}

// Export with auth middleware wrapper
export default withAuth(facturenHandler, { roles: ['klant'] });
