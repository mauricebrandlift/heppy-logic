// api/routes/dashboard/klant/bestelling-detail.js
/**
 * Haal bestelling details op voor klant dashboard
 * Alleen eigen bestellingen toegestaan
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { withAuth } from '../../../utils/authMiddleware.js';

async function bestellingDetailHandler(req, res, context) {
  const correlationId = req.headers['x-correlation-id'] || `bestelling-detail-${Date.now()}`;
  const { userId } = context;

  try {
    // Get bestelling ID from query params
    const { id } = req.query;

    if (!id) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/bestelling-detail',
        action: 'missing_id',
        userId
      }));
      return res.status(400).json({
        correlationId,
        error: 'Bestelling ID is verplicht'
      });
    }

    console.log('🔄 [Bestelling Detail] Fetching bestelling...', { id, userId });

    // === FETCH BESTELLING ===
    const bestellingUrl = `${supabaseConfig.url}/rest/v1/bestellingen?id=eq.${id}&klant_id=eq.${userId}&select=*`;
    
    const bestellingResponse = await httpClient(bestellingUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${context.token}`,
      }
    });

    if (!bestellingResponse.ok) {
      throw new Error('Kan bestelling niet ophalen');
    }

    const bestellingen = await bestellingResponse.json();

    if (!bestellingen || bestellingen.length === 0) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/bestelling-detail',
        action: 'bestelling_not_found',
        id,
        userId
      }));
      return res.status(404).json({
        correlationId,
        error: 'Bestelling niet gevonden'
      });
    }

    const bestelling = bestellingen[0];

    // === FETCH BESTELLING ITEMS + PRODUCT DETAILS ===
    const itemsUrl = `${supabaseConfig.url}/rest/v1/bestelling_items?bestelling_id=eq.${bestelling.id}&select=*,producten(afbeelding_url)`;
    
    const itemsResponse = await httpClient(itemsUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${context.token}`,
      }
    });

    let items = [];
    if (itemsResponse.ok) {
      const rawItems = await itemsResponse.json();
      // Map producten.afbeelding_url to product_afbeelding_url
      items = rawItems.map(item => ({
        ...item,
        product_afbeelding_url: item.producten?.afbeelding_url || null,
        producten: undefined // Remove nested object
      }));
    } else {
      console.warn('⚠️ [Bestelling Detail] Kon items niet ophalen');
    }

    console.log(`✅ [Bestelling Detail] Bestelling opgehaald - ${items.length} items`);

    // === RESPONSE ===
    return res.status(200).json({
      correlationId,
      ...bestelling,
      items
    });

  } catch (error) {
    console.error('❌ [Bestelling Detail] Fout:', error);
    return res.status(500).json({
      correlationId,
      error: 'Er ging iets mis bij het ophalen van de bestelling'
    });
  }
}

export default withAuth(bestellingDetailHandler, { roles: ['klant'] });
