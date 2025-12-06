// api/routes/stripe/create-invoice.js
// Maakt een Stripe Invoice aan voor webshop bestellingen
// Retourneert hosted_invoice_url voor betaling

import { stripeConfig, supabaseConfig } from '../../config/index.js';
import { withAuth } from '../../utils/authMiddleware.js';
import { createAndFinalizeInvoice } from '../../services/invoiceService.js';
import { validateAndCalculateWebshopPricing } from '../../services/webshopPricingService.js';

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

  const correlationId = req.headers['x-correlation-id'] || `create-invoice_${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      correlationId,
      error: 'Method Not Allowed'
    });
  }

  const logMeta = {
    correlationId,
    endpoint: '/api/routes/stripe/create-invoice',
    userId: req.user?.id
  };

  try {
    const { cartItems, deliveryAddress } = req.body;

    // Validatie
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      console.warn(JSON.stringify({
        ...logMeta,
        level: 'WARN',
        message: 'Geen cart items ontvangen'
      }));
      return res.status(400).json({
        correlationId,
        error: 'Cart items zijn verplicht',
        code: 'MISSING_CART_ITEMS'
      });
    }

    if (!deliveryAddress || !deliveryAddress.name || !deliveryAddress.postcode) {
      console.warn(JSON.stringify({
        ...logMeta,
        level: 'WARN',
        message: 'Onvolledig bezorgadres'
      }));
      return res.status(400).json({
        correlationId,
        error: 'Volledig bezorgadres is verplicht',
        code: 'MISSING_DELIVERY_ADDRESS'
      });
    }

    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Invoice aanmaken gestart',
      itemCount: cartItems.length
    }));

    // Valideer en bereken prijzen
    const validatedPricing = await validateAndCalculateWebshopPricing(cartItems, correlationId);

    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Pricing gevalideerd',
      subtotal: validatedPricing.subtotalCents,
      shipping: validatedPricing.shippingCents,
      total: validatedPricing.totalCents
    }));

    // Haal user profile op voor Stripe Customer ID
    const userProfileUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${req.user.id}&select=stripe_customer_id,email,voornaam,achternaam,telefoon`;
    
    const userResponse = await fetch(userProfileUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!userResponse.ok) {
      throw new Error('User profile ophalen mislukt');
    }

    const userProfiles = await userResponse.json();
    const userProfile = userProfiles[0];

    if (!userProfile) {
      throw new Error('User profile niet gevonden');
    }

    // Check of user een Stripe Customer ID heeft
    let stripeCustomerId = userProfile.stripe_customer_id;

    if (!stripeCustomerId) {
      console.log(`👤 [CreateInvoice] User heeft nog geen Stripe Customer, aanmaken... [${correlationId}]`);
      
      // Maak Stripe Customer aan
      const customerParams = new URLSearchParams();
      customerParams.set('email', userProfile.email);
      customerParams.set('name', `${userProfile.voornaam || ''} ${userProfile.achternaam || ''}`.trim());
      
      if (userProfile.telefoon) {
        customerParams.set('phone', userProfile.telefoon);
      }

      const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeConfig.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: customerParams.toString(),
      });

      const customer = await customerResponse.json();

      if (!customerResponse.ok) {
        console.error(`❌ [CreateInvoice] Stripe Customer aanmaken mislukt [${correlationId}]`, customer);
        throw new Error(`Stripe Customer aanmaken mislukt: ${customer?.error?.message}`);
      }

      stripeCustomerId = customer.id;

      // Update user_profiles met nieuwe customer ID
      const updateUserUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${req.user.id}`;
      
      await fetch(updateUserUrl, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stripe_customer_id: stripeCustomerId }),
      });

      console.log(`✅ [CreateInvoice] Stripe Customer aangemaakt: ${stripeCustomerId} [${correlationId}]`);
    }

    // Maak bestelling aan in database (status: pending, wacht op betaling)
    console.log(`📦 [CreateInvoice] Bestelling aanmaken... [${correlationId}]`);
    
    const bestellingData = {
      klant_id: req.user.id,
      
      // Totalen in cents
      subtotaal_cents: validatedPricing.subtotalCents,
      verzendkosten_cents: validatedPricing.shippingCents,
      btw_cents: validatedPricing.btwCents,
      totaal_cents: validatedPricing.totalCents,
      
      // Betaling (pending - nog niet betaald)
      betaal_status: 'pending',
      
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

    const bestellingUrl = `${supabaseConfig.url}/rest/v1/bestellingen`;
    
    const bestellingResponse = await fetch(bestellingUrl, {
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
      throw new Error('Kon bestelling niet aanmaken');
    }

    const bestellingDataResponse = await bestellingResponse.json();
    const bestelling = bestellingDataResponse[0];

    console.log(`✅ [CreateInvoice] Bestelling aangemaakt: ${bestelling.id} [${correlationId}]`);

    // Maak bestelling items aan
    const itemsData = validatedPricing.validatedItems.map(item => ({
      bestelling_id: bestelling.id,
      product_id: item.id || null,
      product_naam: item.name,
      prijs_per_stuk_cents: item.validatedPriceCents,
      aantal: item.quantity,
      btw_percentage: 21,
      subtotaal_cents: item.subtotalCents,
      btw_cents: Math.round(item.subtotalCents * 0.21 / 1.21),
      totaal_cents: item.subtotalCents
    }));

    const itemsUrl = `${supabaseConfig.url}/rest/v1/bestelling_items`;
    
    await fetch(itemsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(itemsData)
    });

    // Maak line items voor Stripe Invoice
    const lineItems = validatedPricing.validatedItems.map(item => ({
      description: item.name,
      quantity: item.quantity,
      unit_amount: item.validatedPriceCents, // Incl. BTW
    }));

    // Voeg verzendkosten toe als aparte line item
    if (validatedPricing.shippingCents > 0) {
      lineItems.push({
        description: 'Verzendkosten',
        quantity: 1,
        unit_amount: validatedPricing.shippingCents,
      });
    }

    // Maak Stripe Invoice aan
    console.log(`💳 [CreateInvoice] Stripe Invoice aanmaken... [${correlationId}]`);
    
    const invoice = await createAndFinalizeInvoice({
      customerId: stripeCustomerId,
      customerEmail: userProfile.email,
      lineItems,
      metadata: {
        flow: 'webshop',
        entity_id: bestelling.id,
        customer_email: userProfile.email,
        item_count: String(cartItems.length),
        delivery_city: deliveryAddress.plaats,
      },
      description: `Webshop bestelling - ${cartItems.length} product${cartItems.length > 1 ? 'en' : ''}`,
      daysUntilDue: 7,
    }, correlationId);

    console.log(`✅ [CreateInvoice] Invoice aangemaakt: ${invoice.id} [${correlationId}]`);

    // Return invoice URL voor redirect
    return res.status(200).json({
      correlationId,
      success: true,
      invoice: {
        id: invoice.id,
        hosted_invoice_url: invoice.hosted_invoice_url,
        amount_due: invoice.amount_due,
      },
      bestelling: {
        id: bestelling.id,
        bestel_nummer: bestelling.bestel_nummer,
      },
    });

  } catch (error) {
    console.error(JSON.stringify({
      ...logMeta,
      level: 'ERROR',
      message: 'Invoice aanmaken mislukt',
      error: error.message,
      stack: error.stack,
    }));

    return res.status(500).json({
      correlationId,
      error: error.message || 'Er is iets misgegaan bij het aanmaken van de invoice',
      code: error.code || 'INVOICE_CREATE_FAILED'
    });
  }
}

export default withAuth(handler, { roles: ['klant'] });
