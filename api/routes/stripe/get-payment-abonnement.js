// api/routes/stripe/get-payment-abonnement.js
// Haalt abonnement_id op voor een payment_intent_id uit betalingen tabel

import { supabaseConfig } from '../../config/index.js';
import { httpClient } from '../../utils/apiClient.js';
import { handleErrorResponse } from '../../utils/errorHandler.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const correlationId = req.headers['x-correlation-id'] || 'not-provided';
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ correlationId, message: 'Method not allowed' });
  }

  try {
    // PaymentIntent ID uit query param ?payment_intent_id=pi_...
    let paymentIntentId = null;
    try {
      const urlObj = new URL(req.url, 'http://localhost');
      paymentIntentId = urlObj.searchParams.get('payment_intent_id');
    } catch (_) {}

    if (!paymentIntentId) {
      return res.status(400).json({ 
        correlationId, 
        message: 'Missing payment_intent_id parameter' 
      });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'stripe/get-payment-abonnement',
      action: 'lookup_request',
      paymentIntentId
    }));

    // Zoek betaling in database
    const url = `${supabaseConfig.url}/rest/v1/betalingen?stripe_payment_id=eq.${paymentIntentId}&select=abonnement_id,opdracht_id`;
    
    console.log(JSON.stringify({
      level: 'DEBUG',
      correlationId,
      route: 'stripe/get-payment-abonnement',
      action: 'database_query',
      url
    }));
    
    const response = await httpClient(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    });

    console.log(JSON.stringify({
      level: 'DEBUG',
      correlationId,
      route: 'stripe/get-payment-abonnement',
      action: 'database_response',
      responseType: typeof response,
      isArray: Array.isArray(response),
      length: response?.length,
      response: response
    }));

    if (!response || !Array.isArray(response) || response.length === 0) {
      console.log(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'stripe/get-payment-abonnement',
        action: 'not_found',
        paymentIntentId,
        responseReceived: !!response,
        responseLength: response?.length || 0
      }));
      
      return res.status(404).json({ 
        correlationId, 
        message: 'Betaling nog niet verwerkt. Probeer het over enkele ogenblikken opnieuw.',
        found: false
      });
    }

    const betaling = response[0];
    
    if (!betaling) {
      console.log(JSON.stringify({
        level: 'ERROR',
        correlationId,
        route: 'stripe/get-payment-abonnement',
        action: 'betaling_undefined',
        response
      }));
      
      return res.status(404).json({ 
        correlationId, 
        message: 'Betaling data ongeldig',
        found: false
      });
    }
    
    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'stripe/get-payment-abonnement',
      action: 'found',
      paymentIntentId,
      abonnementId: betaling.abonnement_id,
      opdrachtId: betaling.opdracht_id
    }));

    return res.status(200).json({ 
      correlationId, 
      abonnement_id: betaling.abonnement_id,
      opdracht_id: betaling.opdracht_id,
      found: true
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'stripe/get-payment-abonnement',
      action: 'exception',
      errorMessage: error.message,
      errorStack: error.stack
    }));
    
    return handleErrorResponse(res, error, 500, correlationId);
  }
  }
}
