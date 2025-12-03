// api/routes/stripe/create-payment-intent.js
// Maakt een Stripe PaymentIntent aan en retourneert de client_secret

import { stripeConfig } from '../../config/index.js';
import { handleErrorResponse } from '../../utils/errorHandler.js';
import { createPaymentIntent } from '../../intents/stripePaymentIntent.js';
import { fetchPricingConfiguration, formatPricingConfiguration } from '../../services/configService.js';
import { calculateAbonnementPricing } from '../../services/pricingCalculator.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, X-Idempotency-Key, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const correlationId = req.headers['x-correlation-id'] || 'not-provided';
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ correlationId, message: 'Method not allowed' });
  }

  try {
    const { secretKey, currency: defaultCurrency = 'EUR' } = stripeConfig || {};
    const payload = req.body || {};
    const headerIdem = req.headers['x-idempotency-key'];
    if (headerIdem && !payload.idempotencyKey) {
      payload.idempotencyKey = String(headerIdem);
    }

    let finalAmount = null;
    const originalAmount = payload.amount;
    let pricingDetails = null;
    let flowContextDescription = payload.description;
    let metadata = payload.metadata || {};
    
    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'stripe/create-payment-intent',
      action: 'received_metadata',
      flow: payload.flowContext?.flow,
      metadataKeys: Object.keys(metadata),
      metadataSize: JSON.stringify(metadata).length
    }));

    if (payload.flowContext?.flow === 'abonnement') {
      const pricingRows = await fetchPricingConfiguration(correlationId, 'abonnement');
      if (!Array.isArray(pricingRows) || pricingRows.length === 0) {
        const err = new Error('Geen prijsconfiguratie gevonden voor abonnement.');
        err.code = 500;
        throw err;
      }

      const pricingConfig = formatPricingConfiguration(pricingRows);
      pricingDetails = calculateAbonnementPricing(payload.flowContext, pricingConfig);

      finalAmount = pricingDetails.bundleAmountCents;
      flowContextDescription = `Heppy abonnement (${pricingDetails.sessionsPerCycle}x / 4w)`;

      metadata = {
        ...metadata,
        calc_source: 'server-validated',
        calc_requested_hours: pricingDetails.requestedHours.toFixed(2),
        calc_min_hours: pricingDetails.minHours.toFixed(2),
        calc_price_per_session: pricingDetails.pricePerSession.toFixed(2),
        calc_sessions_per_cycle: pricingDetails.sessionsPerCycle,
        calc_price_per_hour: pricingDetails.pricePerHour.toFixed(2),
      };
    } else if (payload.flowContext?.flow === 'dieptereiniging') {
      // Dieptereiniging: one-time payment, bereken uren × pricePerHour
      const pricingRows = await fetchPricingConfiguration(correlationId, 'dieptereiniging');
      if (!Array.isArray(pricingRows) || pricingRows.length === 0) {
        const err = new Error('Geen prijsconfiguratie gevonden voor dieptereiniging.');
        err.code = 500;
        throw err;
      }

      const pricingConfig = formatPricingConfiguration(pricingRows);
      
      // Extract uren from flowContext
      const uren = Number(payload.flowContext.dr_uren);
      if (!uren || isNaN(uren) || uren <= 0) {
        const err = new Error('Ongeldige uren voor dieptereiniging.');
        err.code = 400;
        throw err;
      }

      // Get pricePerHour from pricing config
      const pricePerHour = pricingConfig.pricePerHour || 24.95;
      const totalAmountEur = uren * pricePerHour;
      finalAmount = Math.round(totalAmountEur * 100); // Convert to cents

      flowContextDescription = `Heppy dieptereiniging (${uren}u)`;

      pricingDetails = {
        uren: uren,
        pricePerHour: pricePerHour,
        totalAmountEur: totalAmountEur,
        totalAmountCents: finalAmount
      };

      metadata = {
        ...metadata,
        calc_source: 'server-validated',
        calc_uren: uren.toString(),
        calc_price_per_hour: pricePerHour.toFixed(2),
        calc_total_amount_eur: totalAmountEur.toFixed(2),
      };
    } else if (payload.flowContext?.flow === 'webshop') {
      // Webshop: validate and process cart items
      const cartMetadata = payload.metadata || {};
      
      console.log(JSON.stringify({
        level: 'INFO',
        correlationId,
        route: 'stripe/create-payment-intent',
        action: 'webshop_metadata_received',
        metadataKeys: Object.keys(cartMetadata),
        hasItems: !!cartMetadata.items,
        itemsType: typeof cartMetadata.items,
        itemsLength: cartMetadata.items ? cartMetadata.items.length : 0
      }));
      
      // Validate required webshop metadata
      if (!cartMetadata.items) {
        const err = new Error('Cart items metadata is required for webshop flow');
        err.code = 400;
        throw err;
      }
      
      if (!cartMetadata.email) {
        const err = new Error('Customer email is required for webshop flow');
        err.code = 400;
        throw err;
      }
      
      // Parse and validate items
      let parsedItems;
      try {
        parsedItems = JSON.parse(cartMetadata.items);
      } catch (e) {
        const err = new Error('Invalid items JSON in metadata');
        err.code = 400;
        throw err;
      }
      
      if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
        const err = new Error('Cart must contain at least one item');
        err.code = 400;
        throw err;
      }
      
      // Check Stripe metadata size limits (500 chars per value)
      const itemsJsonLength = cartMetadata.items.length;
      console.log(JSON.stringify({
        level: 'INFO',
        correlationId,
        route: 'stripe/create-payment-intent',
        action: 'metadata_size_check',
        itemsJsonLength,
        itemCount: parsedItems.length
      }));
      
      if (itemsJsonLength > 500) {
        console.warn(JSON.stringify({
          level: 'WARN',
          correlationId,
          route: 'stripe/create-payment-intent',
          msg: 'Items JSON exceeds Stripe metadata limit (500 chars), will be truncated',
          actualLength: itemsJsonLength
        }));
      }
      
      // Verify amount matches cart total
      const cartTotalCents = parseInt(cartMetadata.total_cents || '0', 10);
      if (cartTotalCents !== originalAmount) {
        console.warn(JSON.stringify({
          level: 'WARN',
          correlationId,
          route: 'stripe/create-payment-intent',
          msg: 'Cart total mismatch',
          cartTotal: cartTotalCents,
          requestedAmount: originalAmount
        }));
      }
      
      finalAmount = originalAmount;
      flowContextDescription = `Webshop bestelling (${parsedItems.length} product${parsedItems.length > 1 ? 'en' : ''}) items:${cartMetadata.items}`;
      
      // Keep metadata WITHOUT items (stored in description instead)
      metadata = {
        flow: cartMetadata.flow,
        email: cartMetadata.email,
        subtotal_cents: cartMetadata.subtotal_cents,
        shipping_cents: cartMetadata.shipping_cents,
        btw_cents: cartMetadata.btw_cents,
        total_cents: cartMetadata.total_cents,
        calc_source: 'server-validated',
        calc_item_count: parsedItems.length.toString()
      };
      
      console.log(JSON.stringify({
        level: 'INFO',
        correlationId,
        route: 'stripe/create-payment-intent',
        action: 'webshop_validated',
        itemCount: parsedItems.length,
        totalCents: finalAmount
      }));
    }

    if (!finalAmount) {
      if (!originalAmount || !Number.isInteger(originalAmount) || originalAmount <= 0) {
        console.warn(JSON.stringify({ level: 'WARN', correlationId, route: 'stripe/create-payment-intent', msg: 'Invalid amount', rawAmount: originalAmount }));
        return res.status(400).json({ correlationId, message: 'Invalid amount' });
      }
      finalAmount = originalAmount;
    }

    payload.amount = finalAmount;
    payload.metadata = metadata;
    if (!payload.currency) {
      payload.currency = defaultCurrency;
    }
    payload.description = flowContextDescription || payload.description || undefined;

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'stripe/create-payment-intent',
      action: 'create_intent_request',
      amount: finalAmount,
      currency: payload.currency || defaultCurrency,
      metadata: payload.metadata || null,
      idempotencyKey: payload.idempotencyKey || headerIdem || null
    }));

    const result = await createPaymentIntent({
      secretKey,
      defaultCurrency,
      payload,
      correlationId,
    });

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'stripe/create-payment-intent',
      action: 'create_intent_success',
      intentId: result.id,
      status: result.status,
      amount: result.amount,
      currency: result.currency,
      pricingDetails,
    }));

    const responsePayload = { correlationId, ...result };
    if (pricingDetails) {
      responsePayload.pricingDetails = pricingDetails;
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'stripe/create-payment-intent',
      action: 'create_intent_failure',
      message: error.message,
      code: error.code
    }));
    return handleErrorResponse(res, error, 500, correlationId);
  }
}
