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
