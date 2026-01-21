/**
 * API Route: Setup SEPA Direct Debit Mandate
 * 
 * POST /api/routes/stripe/setup-sepa-mandate
 * 
 * Purpose: Create Stripe SetupIntent for SEPA mandate after initial iDEAL payment
 * 
 * Flow:
 * 1. Client completes iDEAL payment for first abonnement period
 * 2. Success page calls this endpoint
 * 3. Backend creates SetupIntent for SEPA
 * 4. Return client_secret to frontend
 * 5. Frontend shows IBAN Element for mandate authorization
 * 6. After confirmation, frontend calls confirm-sepa-setup
 * 
 * Request Body:
 * {
 *   "abonnement_id": "uuid",
 *   "user_id": "uuid" (optional, for extra validation)
 * }
 * 
 * Response Success (200):
 * {
 *   "success": true,
 *   "client_secret": "seti_xxx_secret_yyy",
 *   "abonnement_id": "uuid"
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

  const correlationId = req.headers['x-correlation-id'] || `sepa-setup_${Date.now()}`;
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
    console.log(`[setup-sepa-mandate] START [${correlationId}]`);

    const { abonnement_id, user_id } = req.body;
    
    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'stripe/setup-sepa-mandate',
      action: 'request_received',
      abonnement_id,
      user_id: user_id || 'not_provided'
    }));

    // Validatie
    if (!abonnement_id) {
      return res.status(400).json({ error: 'abonnement_id is required' });
    }

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(abonnement_id)) {
      return res.status(400).json({ error: 'Invalid abonnement_id format' });
    }

    console.log(`[setup-sepa-mandate] Fetching abonnement [${correlationId}]`, { abonnement_id });

    // Haal abonnement + user op
    const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${abonnement_id}&select=*,users:gebruiker_id(id,email,stripe_customer_id)`;
    const abonnementResp = await httpClient(abonnementUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    }, correlationId);

    if (!abonnementResp.ok) {
      throw new Error(`Failed to fetch abonnement: ${await abonnementResp.text()}`);
    }

    const abonnementen = await abonnementResp.json();
    if (!abonnementen || abonnementen.length === 0) {
      return res.status(404).json({ error: 'Abonnement not found' });
    }

    const abonnement = abonnementen[0];
    const user = abonnement.users;

    if (!user) {
      throw new Error('User not found for abonnement');
    }

    // Extra validatie: user_id match (indien meegegeven)
    if (user_id && user.id !== user_id) {
      return res.status(403).json({ error: 'Unauthorized: user mismatch' });
    }

    // Check: is SEPA setup al voltooid?
    if (abonnement.sepa_setup_completed) {
      console.log(`[setup-sepa-mandate] SEPA already completed [${correlationId}]`);
      return res.status(200).json({
        success: true,
        already_completed: true,
        abonnement_id: abonnement.id
      });
    }

    // Check: heeft user een Stripe Customer ID?
    if (!user.stripe_customer_id) {
      throw new Error('User has no Stripe Customer ID - cannot setup SEPA mandate');
    }

    console.log(`[setup-sepa-mandate] Creating SetupIntent for Customer ${user.stripe_customer_id} [${correlationId}]`);

    // Maak Stripe SetupIntent
    const params = new URLSearchParams();
    params.set('payment_method_types[]', 'sepa_debit');
    params.set('customer', user.stripe_customer_id);
    params.set('metadata[abonnement_id]', abonnement.id);
    params.set('metadata[user_id]', user.id);
    params.set('metadata[email]', user.email);
    params.set('metadata[flow]', 'sepa_mandate_setup');

    const setupIntentResp = await fetch('https://api.stripe.com/v1/setup_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeConfig.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!setupIntentResp.ok) {
      const errorText = await setupIntentResp.text();
      console.error(`[setup-sepa-mandate] Stripe SetupIntent creation failed: ${errorText} [${correlationId}]`);
      throw new Error(`Stripe SetupIntent creation failed: ${setupIntentResp.status}`);
    }

    const setupIntent = await setupIntentResp.json();
    
    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'stripe/setup-sepa-mandate',
      action: 'setup_intent_created',
      setupIntentId: setupIntent.id,
      status: setupIntent.status,
      customer: user.stripe_customer_id
    }));

    if (!setupIntent.client_secret) {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const setupIntent = await setupIntentResp.json();

    if (!setupIntentResp.ok) {
      const errorMessage = setupIntent?.error?.message || 'Unknown Stripe error';
      throw new Error(`SetupIntent creation failed: ${errorMessage}`);
    }

    console.log(`[setup-sepa-mandate] SetupIntent created: ${setupIntent.id} [${correlationId}]`);

    // Sla client_secret op in abonnement (tijdelijk, voor verificatie)
    const updateUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${abonnement.id}`;
    const updateResp = await httpClient(updateUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        sepa_setup_client_secret: setupIntent.client_secret
      })
    }, correlationId);

    if (!updateResp.ok) {
      console.warn(`[setup-sepa-mandate] Failed to save client_secret (non-critical) [${correlationId}]`);
    }

    console.log(`[setup-sepa-mandate] SUCCESS [${correlationId}]`);

    return res.status(200).json({
      success: true,
      client_secret: setupIntent.client_secret,
      abonnement_id: abonnement.id
    });

  } catch (error) {
    console.error(`[setup-sepa-mandate] ERROR [${correlationId}]`, error.message);
    return handleErrorResponse(res, error, correlationId);
  }
}
