/**
 * Test Endpoint: Trigger Recurring Billing
 * 
 * Voor development/testing - triggert recurring billing zonder te wachten op cron.
 * ALLEEN beschikbaar in test mode (niet in productie).
 * 
 * Usage:
 * - Alle abonnementen: GET /api/routes/test/trigger-recurring-billing
 * - Specifiek abonnement: GET /api/routes/test/trigger-recurring-billing?abonnement_id=xxx
 */

import { processAllRecurringBillings, processAbonnementRecurringBilling } from '../../services/recurringBillingService.js';
import { supabaseConfig } from '../../config/index.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SECURITY: Only allow in test mode
  if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('test')) {
    return res.status(403).json({ 
      error: 'This endpoint is only available in test mode',
      message: 'Recurring billing test endpoint is disabled in production for security',
    });
  }

  const correlationId = req.headers['x-correlation-id'] || `test_${Date.now()}`;
  const { abonnement_id } = req.query;

  console.log(`🧪 [Test] ========== MANUAL RECURRING BILLING TRIGGER ========== [${correlationId}]`);
  console.log(`🧪 [Test] Abonnement ID: ${abonnement_id || 'ALL'}`);

  try {
    let result;

    if (abonnement_id) {
      // Process specifiek abonnement
      console.log(`🎯 [Test] Processing specific abonnement: ${abonnement_id} [${correlationId}]`);
      
      // Haal abonnement op
      const url = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${abonnement_id}&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Abonnement ophalen mislukt: ${response.status}`);
      }

      const abonnementen = await response.json();
      
      if (abonnementen.length === 0) {
        return res.status(404).json({
          error: 'Abonnement niet gevonden',
          abonnement_id,
        });
      }

      const abonnement = abonnementen[0];
      
      // Check status
      if (abonnement.status !== 'actief') {
        return res.status(400).json({
          error: `Abonnement status is '${abonnement.status}', expected 'actief'`,
          abonnement_id,
          status: abonnement.status,
        });
      }

      result = await processAbonnementRecurringBilling(abonnement, correlationId);

    } else {
      // Process alle abonnementen die klaar zijn
      console.log(`📋 [Test] Processing all abonnementen due for billing [${correlationId}]`);
      result = await processAllRecurringBillings(correlationId);
    }

    console.log(`✅ [Test] Manual trigger completed [${correlationId}]`, result);

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      correlationId,
      mode: 'test',
      triggered_by: 'manual',
      ...result,
    });

  } catch (error) {
    console.error(`❌ [Test] Manual trigger failed [${correlationId}]`, {
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      correlationId,
    });
  }
}
