// api/flows/payment/processWebshopPayment.js
/**
 * Verwerkt succesvolle webshop betalingen vanuit Stripe webhook
 * 
 * Flow:
 * 1. Valideer metadata
 * 2. Haal klant op via email
 * 3. Maak bestelling aan
 * 4. Maak bestelling items aan
 * 5. Verstuur bevestigingsmail (toekomstig)
 */

import { supabaseConfig } from '../../config/index.js';
import { httpClient } from '../../utils/apiClient.js';

export async function processWebshopPayment({ paymentIntent, metadata, correlationId, event }) {
  const logMeta = {
    correlationId,
    flow: 'webshop',
    paymentIntentId: paymentIntent.id
  };

  try {
    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: '🛒 Starting webshop order processing',
      email: metadata.email
    }));

    // Parse items from JSON string
    let items;
    try {
      items = JSON.parse(metadata.items);
    } catch (e) {
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Failed to parse items JSON',
        error: e.message
      }));
      return { handled: false, error: 'invalid_items_json' };
    }

    // Stap 1: Haal klant op via email
    const userResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?email=eq.${encodeURIComponent(metadata.email)}&select=id,voornaam,achternaam,email`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }
    );

    if (!userResponse.ok) {
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Failed to fetch user profile'
      }));
      return { handled: false, error: 'user_fetch_failed' };
    }

    const users = await userResponse.json();
    if (!users || users.length === 0) {
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'User not found',
        email: metadata.email
      }));
      return { handled: false, error: 'user_not_found' };
    }

    const user = users[0];
    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'User found',
      userId: user.id
    }));

    // Stap 2: Check of order al bestaat (idempotency)
    const existingOrderResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/bestellingen?stripe_payment_intent_id=eq.${paymentIntent.id}`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }
    );

    if (existingOrderResponse.ok) {
      const existingOrders = await existingOrderResponse.json();
      if (existingOrders && existingOrders.length > 0) {
        console.info(JSON.stringify({
          ...logMeta,
          level: 'INFO',
          message: 'Order already exists (idempotency)',
          orderId: existingOrders[0].id,
          bestelNummer: existingOrders[0].bestel_nummer
        }));
        return { 
          handled: true, 
          orderId: existingOrders[0].id,
          bestelNummer: existingOrders[0].bestel_nummer,
          note: 'Order already existed'
        };
      }
    }

    // Stap 3: Maak bestelling aan
    const bestellingData = {
      klant_id: user.id,
      
      // Totalen in cents
      subtotaal_cents: parseInt(metadata.subtotal_cents),
      verzendkosten_cents: parseInt(metadata.shipping_cents),
      btw_cents: parseInt(metadata.btw_cents),
      totaal_cents: parseInt(metadata.total_cents),
      
      // Betaling
      stripe_payment_intent_id: paymentIntent.id,
      betaal_status: 'paid',
      betaald_op: new Date().toISOString(),
      
      // Status
      status: 'nieuw',
      
      // Bezorgadres (denormalized from metadata)
      bezorg_naam: metadata.bezorg_naam,
      bezorg_straat: metadata.bezorg_straat,
      bezorg_huisnummer: metadata.bezorg_huisnummer,
      bezorg_toevoeging: metadata.bezorg_toevoeging || null,
      bezorg_postcode: metadata.bezorg_postcode,
      bezorg_plaats: metadata.bezorg_plaats
    };

    const bestellingResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/bestellingen`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(bestellingData)
      }
    );

    if (!bestellingResponse.ok) {
      const errorText = await bestellingResponse.text();
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Failed to create order',
        error: errorText
      }));
      return { handled: false, error: 'order_create_failed' };
    }

    const bestellingArray = await bestellingResponse.json();
    const bestelling = bestellingArray[0];

    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: '✅ Order created',
      orderId: bestelling.id,
      bestelNummer: bestelling.bestel_nummer
    }));

    // Stap 4: Maak bestelling items aan
    const itemsData = items.map(item => ({
      bestelling_id: bestelling.id,
      product_id: item.id || null,
      product_naam: item.name,
      prijs_per_stuk_cents: Math.round(item.price * 100),
      aantal: item.quantity,
      btw_percentage: 21,
      subtotaal_cents: Math.round(item.price * item.quantity * 100),
      btw_cents: Math.round((item.price * item.quantity * 0.21 / 1.21) * 100),
      totaal_cents: Math.round(item.price * item.quantity * 100)
    }));

    const itemsResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/bestelling_items`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(itemsData)
      }
    );

    if (!itemsResponse.ok) {
      const errorText = await itemsResponse.text();
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Failed to create order items',
        error: errorText
      }));
      // Order bestaat al, maar items niet - return partial success
      return { 
        handled: true, 
        orderId: bestelling.id,
        bestelNummer: bestelling.bestel_nummer,
        warning: 'items_creation_failed' 
      };
    }

    const createdItems = await itemsResponse.json();

    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: '✅ Order items created',
      itemCount: createdItems.length
    }));

    // TODO: Verstuur bevestigingsmail

    return {
      handled: true,
      orderId: bestelling.id,
      bestelNummer: bestelling.bestel_nummer,
      itemCount: createdItems.length
    };

  } catch (error) {
    console.error(JSON.stringify({
      ...logMeta,
      level: 'ERROR',
      message: 'Unexpected error in webshop payment processing',
      error: error.message,
      stack: error.stack
    }));
    return { handled: false, error: 'unexpected_error', details: error.message };
  }
}
