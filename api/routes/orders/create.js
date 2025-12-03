// api/routes/orders/create.js
/**
 * API Route voor het aanmaken van webshop bestellingen
 * Endpoint: POST /api/routes/orders/create
 * 
 * Functionaliteit:
 * 1. Valideer payment intent bij Stripe
 * 2. Maak bestelling aan in database
 * 3. Maak bestelling items aan
 * 4. Update product stock (optioneel)
 * 5. Verstuur bevestigingsmail (toekomstig)
 */
import { supabaseConfig } from '../../config/index.js';
import { httpClient } from '../../utils/apiClient.js';
import { withAuth } from '../../utils/authMiddleware.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, Authorization');

  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const correlationId = req.headers['x-correlation-id'];
  if (correlationId) {
    res.setHeader('X-Correlation-ID', correlationId);
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      correlationId: correlationId || 'not-provided',
      error: 'Method Not Allowed'
    });
  }

  const logMeta = {
    correlationId: correlationId || 'not-provided',
    endpoint: '/api/routes/orders/create',
    userId: req.user?.id
  };

  try {
    const { paymentIntentId, items, totals, deliveryAddress } = req.body;

    // Validatie
    if (!paymentIntentId || !items || !totals || !deliveryAddress) {
      console.warn(JSON.stringify({
        ...logMeta,
        level: 'WARN',
        message: 'Ontbrekende verplichte velden'
      }));
      return res.status(400).json({
        correlationId: logMeta.correlationId,
        error: 'Ontbrekende verplichte velden',
        code: 'MISSING_FIELDS'
      });
    }

    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Order aanmaken gestart',
      paymentIntentId,
      itemCount: items.length
    }));

    // Stap 1: Verifieer payment intent bij Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      console.warn(JSON.stringify({
        ...logMeta,
        level: 'WARN',
        message: 'Payment intent niet succesvol',
        status: paymentIntent.status
      }));
      return res.status(400).json({
        correlationId: logMeta.correlationId,
        error: 'Betaling is niet succesvol afgerond',
        code: 'PAYMENT_NOT_SUCCEEDED'
      });
    }

    // Stap 2: Maak bestelling aan in database
    const bestellingData = {
      klant_id: req.user.id,
      
      // Totalen in cents
      subtotaal_cents: Math.round(totals.subtotal * 100),
      verzendkosten_cents: Math.round(totals.shipping * 100),
      btw_cents: Math.round((totals.total * 0.21 / 1.21) * 100), // 21% BTW uit totaal
      totaal_cents: Math.round(totals.total * 100),
      
      // Betaling
      stripe_payment_intent_id: paymentIntentId,
      betaal_status: 'paid',
      betaald_op: new Date().toISOString(),
      
      // Status
      status: 'nieuw',
      
      // Bezorgadres (denormalized)
      bezorg_naam: deliveryAddress.name,
      bezorg_straat: deliveryAddress.straatnaam,
      bezorg_huisnummer: deliveryAddress.huisnummer,
      bezorg_toevoeging: deliveryAddress.toevoeging || null,
      bezorg_postcode: deliveryAddress.postcode,
      bezorg_plaats: deliveryAddress.plaats
    };

    const bestellingResponse = await httpClient(`${supabaseConfig.url}/rest/v1/bestellingen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(bestellingData)
    });

    if (!bestellingResponse.ok) {
      const errorData = await bestellingResponse.json();
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Fout bij aanmaken bestelling',
        error: errorData
      }));
      return res.status(500).json({
        correlationId: logMeta.correlationId,
        error: 'Kon bestelling niet aanmaken',
        code: 'ORDER_CREATE_FAILED'
      });
    }

    const bestellingDataResponse = await bestellingResponse.json();
    const bestelling = bestellingDataResponse[0];

    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Bestelling aangemaakt',
      bestellingId: bestelling.id,
      bestelNummer: bestelling.bestel_nummer
    }));

    // Stap 3: Maak bestelling items aan
    const itemsData = items.map(item => ({
      bestelling_id: bestelling.id,
      product_id: item.id || null, // Webflow heeft mogelijk geen product_id
      product_naam: item.name,
      prijs_per_stuk_cents: Math.round(item.price * 100),
      aantal: item.quantity,
      btw_percentage: 21,
      subtotaal_cents: Math.round((item.price * item.quantity) * 100),
      btw_cents: Math.round((item.price * item.quantity * 0.21 / 1.21) * 100),
      totaal_cents: Math.round((item.price * item.quantity) * 100)
    }));

    const itemsResponse = await httpClient(`${supabaseConfig.url}/rest/v1/bestelling_items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(itemsData)
    });

    if (!itemsResponse.ok) {
      const errorData = await itemsResponse.json();
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Fout bij aanmaken bestelling items',
        error: errorData
      }));
      // Bestelling is al aangemaakt - log error maar ga door
    }

    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Order succesvol afgerond',
      bestellingId: bestelling.id,
      bestelNummer: bestelling.bestel_nummer
    }));

    return res.status(201).json({
      correlationId: logMeta.correlationId,
      success: true,
      order: {
        id: bestelling.id,
        bestelNummer: bestelling.bestel_nummer,
        totaal: totals.total,
        status: bestelling.status
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      ...logMeta,
      level: 'ERROR',
      message: 'Onverwachte fout bij order aanmaken',
      error: error.message,
      stack: error.stack
    }));

    return res.status(500).json({
      correlationId: logMeta.correlationId,
      error: 'Er is een onverwachte fout opgetreden',
      code: 'INTERNAL_ERROR'
    });
  }
}

// Wrap met auth middleware
export default withAuth(handler);
