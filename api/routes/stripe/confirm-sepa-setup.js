/**
 * API Route: Confirm SEPA Direct Debit Setup
 * 
 * POST /api/routes/stripe/confirm-sepa-setup
 * 
 * Purpose: Finalize SEPA mandate setup after frontend confirmation
 * 
 * Flow:
 * 1. Frontend confirms SetupIntent with IBAN Element
 * 2. Frontend calls this endpoint with setup_intent_id
 * 3. Backend verifies SetupIntent status = 'succeeded'
 * 4. Extract PaymentMethod and Mandate IDs
 * 5. Update abonnement with SEPA details
 * 6. Mark sepa_setup_completed = true
 * 
 * Request Body:
 * {
 *   "setup_intent_id": "seti_xxx",
 *   "abonnement_id": "uuid"
 * }
 * 
 * Response Success (200):
 * {
 *   "success": true,
 *   "abonnement_id": "uuid",
 *   "payment_method_id": "pm_xxx",
 *   "mandate_id": "mandaat_xxx"
 * }
 */

import { supabaseConfig, stripeConfig } from '../../config/index.js';
import { httpClient } from '../../utils/apiClient.js';
import { handleErrorResponse } from '../../utils/errorHandler.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, Authorization');

  const correlationId = req.headers['x-correlation-id'] || `sepa-confirm_${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Alleen POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    console.log(`[confirm-sepa-setup] START [${correlationId}]`);

    const { setup_intent_id, abonnement_id } = req.body;

    // Validatie
    if (!setup_intent_id || !abonnement_id) {
      return res.status(400).json({ 
        error: 'setup_intent_id and abonnement_id are required' 
      });
    }

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(abonnement_id)) {
      return res.status(400).json({ error: 'Invalid abonnement_id format' });
    }

    if (!setup_intent_id.startsWith('seti_')) {
      return res.status(400).json({ error: 'Invalid setup_intent_id format' });
    }

    console.log(`[confirm-sepa-setup] Retrieving SetupIntent ${setup_intent_id} [${correlationId}]`);

    // Haal SetupIntent op bij Stripe
    const setupIntentResp = await fetch(`https://api.stripe.com/v1/setup_intents/${setup_intent_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${stripeConfig.secretKey}`,
      },
    });

    const setupIntent = await setupIntentResp.json();

    if (!setupIntentResp.ok) {
      const errorMessage = setupIntent?.error?.message || 'Unknown Stripe error';
      throw new Error(`SetupIntent retrieval failed: ${errorMessage}`);
    }

    console.log(`[confirm-sepa-setup] SetupIntent status: ${setupIntent.status} [${correlationId}]`);

    // Check status
    if (setupIntent.status !== 'succeeded') {
      return res.status(400).json({
        error: 'SetupIntent not succeeded',
        status: setupIntent.status,
        message: 'SEPA mandate setup is not complete. Please try again.'
      });
    }

    // Valideer metadata
    const metadata = setupIntent.metadata || {};
    if (metadata.abonnement_id !== abonnement_id) {
      return res.status(400).json({
        error: 'Abonnement ID mismatch',
        message: 'SetupIntent does not belong to this abonnement'
      });
    }

    // Extract PaymentMethod en Mandate
    const paymentMethodId = setupIntent.payment_method;
    const mandateId = setupIntent.mandate;

    if (!paymentMethodId) {
      throw new Error('No PaymentMethod found in SetupIntent');
    }

    console.log(`[confirm-sepa-setup] PaymentMethod: ${paymentMethodId}, Mandate: ${mandateId || 'N/A'} [${correlationId}]`);

    // Update abonnement met SEPA details
    const updateUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${abonnement_id}`;
    const updateResp = await httpClient(updateUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        stripe_payment_method_id: paymentMethodId,
        sepa_mandate_id: mandateId,
        sepa_setup_completed: true,
        sepa_setup_client_secret: null // Clear temporary secret
      })
    }, correlationId);

    if (!updateResp.ok) {
      throw new Error(`Failed to update abonnement: ${await updateResp.text()}`);
    }

    console.log(`[confirm-sepa-setup] Abonnement updated with SEPA details [${correlationId}]`);

    // Haal updated abonnement op voor verificatie
    const verifyUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${abonnement_id}&select=id,sepa_setup_completed,stripe_payment_method_id,sepa_mandate_id`;
    const verifyResp = await httpClient(verifyUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    }, correlationId);

    if (verifyResp.ok) {
      const verifyData = await verifyResp.json();
      console.log(`[confirm-sepa-setup] Verification:`, verifyData[0]);
    }

    console.log(`[confirm-sepa-setup] SUCCESS - SEPA setup complete [${correlationId}]`);

    return res.status(200).json({
      success: true,
      abonnement_id,
      payment_method_id: paymentMethodId,
      mandate_id: mandateId,
      message: 'SEPA mandate successfully activated for recurring billing'
    });

  } catch (error) {
    console.error(`[confirm-sepa-setup] ERROR [${correlationId}]`, error.message);
    return handleErrorResponse(res, error, correlationId);
  }
}
