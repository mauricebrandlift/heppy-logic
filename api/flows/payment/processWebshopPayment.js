// api/flows/payment/processWebshopPayment.js
/**
 * Verwerkt succesvolle webshop betalingen vanuit Stripe webhook
 * 
 * Flow:
 * 1. Valideer metadata
 * 2. Haal klant op via email
 * 3. Maak bestelling aan
 * 4. Maak bestelling items aan
 * 5. Verstuur bevestigingsmail (klant + admin)
 */

import { supabaseConfig, emailConfig } from '../../config/index.js';
import { httpClient } from '../../utils/apiClient.js';
import { sendEmail } from '../../services/emailService.js';
import { webshopBestellingKlant, nieuweWebshopBestellingAdmin } from '../../templates/emails/index.js';

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
      email: metadata.email,
      metadata: metadata // Log hele metadata object
    }));

    // Parse items from JSON string
    let items;
    try {
      items = JSON.parse(metadata.items);
    } catch (e) {
      // Fallback: if items not in metadata, try to parse from description
      console.warn(JSON.stringify({
        ...logMeta,
        level: 'WARN',
        message: 'Items not found in metadata, checking description field',
        error: e.message
      }));
      
      // If items also not available, we cannot process the order
      if (!paymentIntent.description || !paymentIntent.description.includes('items:')) {
        console.error(JSON.stringify({
          ...logMeta,
          level: 'ERROR',
          message: 'Failed to parse items JSON',
          error: e.message,
          rawItems: metadata.items,
          allMetadata: metadata,
          description: paymentIntent.description
        }));
        return { handled: false, error: 'invalid_items_json' };
      }
      
      // Try to extract items from description (fallback)
      try {
        const itemsMatch = paymentIntent.description.match(/items:(.+)$/);
        if (itemsMatch) {
          items = JSON.parse(itemsMatch[1]);
        } else {
          throw new Error('Items not found in description');
        }
      } catch (descError) {
        console.error(JSON.stringify({
          ...logMeta,
          level: 'ERROR',
          message: 'Failed to parse items from description',
          error: descError.message
        }));
        return { handled: false, error: 'invalid_items_json' };
      }
    }

    // Stap 1: Haal klant op via email (met adres)
    const userResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?email=eq.${encodeURIComponent(metadata.email)}&select=id,voornaam,achternaam,email,adres_id,adres:adressen(*)`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }
    );

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Failed to fetch user profile',
        status: userResponse.status,
        error: errorText
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
      userId: user.id,
      hasAddress: !!user.adres
    }));

    // Check for alternate delivery address in metadata
    let deliveryAddress;
    if (metadata.alternate_address) {
      try {
        deliveryAddress = JSON.parse(metadata.alternate_address);
        console.info(JSON.stringify({
          ...logMeta,
          level: 'INFO',
          message: 'Using alternate delivery address from metadata'
        }));
      } catch (e) {
        console.warn(JSON.stringify({
          ...logMeta,
          level: 'WARN',
          message: 'Failed to parse alternate_address, falling back to user profile address',
          error: e.message
        }));
        deliveryAddress = null;
      }
    }
    
    // Fallback to user profile address if no alternate address
    if (!deliveryAddress) {
      deliveryAddress = {
        naam: `${user.voornaam} ${user.achternaam}`,
        straat: user.adres?.straat || '',
        huisnummer: user.adres?.huisnummer || '',
        toevoeging: user.adres?.toevoeging || '',
        postcode: user.adres?.postcode || '',
        plaats: user.adres?.plaats || ''
      };
    }

    // Stap 2: Genereer bestelnummer
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit random
    const bestelNummer = `WS-${dateStr}-${randomNum}`;

    // Stap 3: Check of order al bestaat (idempotency)
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
    // Calculate totals from payment intent amount (metadata may be incomplete due to Stripe limits)
    const totalAmount = paymentIntent.amount; // Already in cents
    const shippingCents = parseInt(metadata.shipping_cents) || 595; // Default €5.95
    const subtotalCents = totalAmount - shippingCents;
    const btwCents = Math.round((totalAmount * 21) / 121); // 21% BTW
    
    const bestellingData = {
      klant_id: user.id,
      bestel_nummer: bestelNummer,
      
      // Totalen in cents (calculated from payment intent amount)
      subtotaal_cents: subtotalCents,
      verzendkosten_cents: shippingCents,
      btw_cents: btwCents,
      totaal_cents: totalAmount,
      
      // Betaling
      stripe_payment_intent_id: paymentIntent.id,
      betaal_status: 'paid',
      betaald_op: new Date().toISOString(),
      
      // Status
      status: 'nieuw',
      
      // Bezorgadres (from alternate address if provided, else user profile)
      bezorg_naam: deliveryAddress.naam,
      bezorg_straat: deliveryAddress.straat,
      bezorg_huisnummer: deliveryAddress.huisnummer,
      bezorg_toevoeging: deliveryAddress.toevoeging || null,
      bezorg_postcode: deliveryAddress.postcode,
      bezorg_plaats: deliveryAddress.plaats
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

    // Stap 4: Lookup product UUIDs from Stripe Price IDs
    const stripePriceIds = items.map(item => item.id).filter(Boolean);
    let productMap = {};
    
    if (stripePriceIds.length > 0) {
      const productsResponse = await httpClient(
        `${supabaseConfig.url}/rest/v1/producten?stripe_price_id=in.(${stripePriceIds.join(',')})&select=id,stripe_price_id`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
          }
        }
      );

      if (productsResponse.ok) {
        const products = await productsResponse.json();
        productMap = products.reduce((map, product) => {
          map[product.stripe_price_id] = product.id;
          return map;
        }, {});
      }
    }

    // Stap 5: Maak bestelling items aan
    const itemsData = items.map(item => ({
      bestelling_id: bestelling.id,
      product_id: productMap[item.id] || null,  // Use mapped UUID or null
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

    // Stap 6: Verstuur bevestigingsmail naar klant
    try {
      const klantEmailHtml = webshopBestellingKlant({
        klantNaam: `${user.voornaam} ${user.achternaam}`,
        bestelNummer: bestelling.bestel_nummer,
        items: createdItems,
        subtotaalCents: bestelling.subtotaal_cents,
        verzendkostenCents: bestelling.verzendkosten_cents,
        btwCents: bestelling.btw_cents,
        totaalCents: bestelling.totaal_cents,
        bezorgNaam: bestelling.bezorg_naam,
        bezorgStraat: bestelling.bezorg_straat,
        bezorgHuisnummer: bestelling.bezorg_huisnummer,
        bezorgToevoeging: bestelling.bezorg_toevoeging,
        bezorgPostcode: bestelling.bezorg_postcode,
        bezorgPlaats: bestelling.bezorg_plaats,
        bestellingDatum: bestelling.aangemaakt_op
      });

      await sendEmail({
        to: user.email,
        subject: `Orderbevestiging ${bestelling.bestel_nummer} - Heppy`,
        html: klantEmailHtml
      }, correlationId);

      console.info(JSON.stringify({
        ...logMeta,
        level: 'INFO',
        message: '✅ Confirmation email sent to customer',
        to: user.email
      }));

    } catch (emailError) {
      // Log maar gooi geen error - bestelling is al aangemaakt
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Failed to send customer confirmation email',
        error: emailError.message,
        to: user.email
      }));
    }

    // Stap 7: Verstuur notificatie naar admin
    try {
      const adminEmailHtml = nieuweWebshopBestellingAdmin({
        klantNaam: `${user.voornaam} ${user.achternaam}`,
        klantEmail: user.email,
        bestelNummer: bestelling.bestel_nummer,
        items: createdItems,
        subtotaalCents: bestelling.subtotaal_cents,
        verzendkostenCents: bestelling.verzendkosten_cents,
        btwCents: bestelling.btw_cents,
        totaalCents: bestelling.totaal_cents,
        bezorgNaam: bestelling.bezorg_naam,
        bezorgStraat: bestelling.bezorg_straat,
        bezorgHuisnummer: bestelling.bezorg_huisnummer,
        bezorgToevoeging: bestelling.bezorg_toevoeging,
        bezorgPostcode: bestelling.bezorg_postcode,
        bezorgPlaats: bestelling.bezorg_plaats,
        bestellingDatum: bestelling.aangemaakt_op,
        bestellingId: bestelling.id
      });

      await sendEmail({
        to: emailConfig.notificationsEmail,
        subject: `🛒 Nieuwe Webshop Bestelling: ${bestelling.bestel_nummer}`,
        html: adminEmailHtml
      }, correlationId);

      console.info(JSON.stringify({
        ...logMeta,
        level: 'INFO',
        message: '✅ Admin notification email sent',
        to: emailConfig.notificationsEmail
      }));

    } catch (emailError) {
      // Log maar gooi geen error - bestelling is al aangemaakt
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Failed to send admin notification email',
        error: emailError.message,
        to: emailConfig.notificationsEmail
      }));
    }

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
