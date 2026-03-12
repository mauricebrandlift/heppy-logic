// api/routes/dashboard/schoonmaker/bank-account.js
/**
 * Bankrekening beheer voor schoonmakers via Stripe Connect
 * 
 * GET  /api/routes/dashboard/schoonmaker/bank-account
 *   → Haal huidige bankrekening info op (laatste 4 cijfers IBAN + naam)
 * 
 * POST /api/routes/dashboard/schoonmaker/bank-account
 *   → Update bankrekening (nieuw IBAN + rekeninghouder)
 *   Body: { iban: string, rekeninghouder: string }
 * 
 * Beide endpoints vereisen authenticatie (Bearer token)
 * IBAN wordt NIET opgeslagen in onze database — gaat direct naar Stripe
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { handleErrorResponse } from '../../../utils/errorHandler.js';
import { verifyAuth } from '../../../checks/authCheck.js';
import { logAudit } from '../../../services/auditService.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const correlationId = req.headers['x-correlation-id'] || `bank-account-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ correlationId, message: 'Method not allowed' });
  }

  try {
    // Authenticatie
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ correlationId, message: 'Authenticatie vereist' });
    }
    const token = authHeader.split(' ')[1];
    const user = await verifyAuth(token);

    // Haal Stripe Connect account ID op uit user profile
    const stripeAccountId = user.profile?.stripe_customer_id;
    if (!stripeAccountId) {
      return res.status(400).json({
        correlationId,
        code: 'NO_STRIPE_ACCOUNT',
        message: 'Schoonmaker heeft geen Stripe account gekoppeld'
      });
    }

    // ========================================================================
    // GET — Huidige bankrekening info ophalen
    // ========================================================================
    if (req.method === 'GET') {
      return await handleGetBankAccount(req, res, stripeAccountId, correlationId);
    }

    // ========================================================================
    // POST — Bankrekening bijwerken
    // ========================================================================
    if (req.method === 'POST') {
      return await handleUpdateBankAccount(req, res, user, stripeAccountId, correlationId);
    }

  } catch (error) {
    console.error(`❌ [Bank Account] Error [${correlationId}]:`, error);
    return handleErrorResponse(error, res, correlationId);
  }
}

// ============================================================================
// GET: Haal huidige bankrekening info op van Stripe
// ============================================================================
async function handleGetBankAccount(req, res, stripeAccountId, correlationId) {
  console.log(`🔍 [Bank Account] Ophalen bankrekening voor Stripe account: ${stripeAccountId} [${correlationId}]`);

  // Haal external accounts (bank accounts) op van Stripe Connect account
  const response = await httpClient(
    `https://api.stripe.com/v1/accounts/${stripeAccountId}/external_accounts?object=bank_account&limit=1`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'dashboard/schoonmaker/bank-account',
      action: 'get_bank_account_failed',
      error: errorText
    }));
    throw new Error('Kon bankrekening informatie niet ophalen van Stripe');
  }

  const data = await response.json();
  const bankAccounts = data.data || [];

  if (bankAccounts.length === 0) {
    return res.status(200).json({
      hasBankAccount: false,
      last4: null,
      rekeninghouder: null
    });
  }

  const bankAccount = bankAccounts[0];

  console.log(`✅ [Bank Account] Bankrekening info opgehaald [${correlationId}]`);

  return res.status(200).json({
    hasBankAccount: true,
    last4: bankAccount.last4 || null,
    rekeninghouder: bankAccount.account_holder_name || null,
    bankNaam: bankAccount.bank_name || null,
    land: bankAccount.country || null
  });
}

// ============================================================================
// POST: Update bankrekening op Stripe Connect account
// ============================================================================
async function handleUpdateBankAccount(req, res, user, stripeAccountId, correlationId) {
  const { iban, rekeninghouder } = req.body;

  // Validatie
  if (!iban || !rekeninghouder) {
    return res.status(400).json({
      correlationId,
      message: 'IBAN en naam rekeninghouder zijn verplicht'
    });
  }

  // IBAN format check (server-side)
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(cleanIban)) {
    return res.status(400).json({
      correlationId,
      code: 'INVALID_IBAN',
      message: 'Het opgegeven IBAN is ongeldig'
    });
  }

  // Rekeninghouder naam validatie
  const cleanNaam = rekeninghouder.trim();
  if (cleanNaam.length < 2) {
    return res.status(400).json({
      correlationId,
      message: 'Naam rekeninghouder moet minimaal 2 karakters bevatten'
    });
  }

  console.log(`🔄 [Bank Account] Bankrekening bijwerken voor Stripe account: ${stripeAccountId} [${correlationId}]`);

  // Haal huidige bankrekening op voor audit log
  let oldBankInfo = null;
  try {
    const currentResponse = await httpClient(
      `https://api.stripe.com/v1/accounts/${stripeAccountId}/external_accounts?object=bank_account&limit=1`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
        }
      }
    );
    if (currentResponse.ok) {
      const currentData = await currentResponse.json();
      if (currentData.data && currentData.data.length > 0) {
        oldBankInfo = {
          last4: currentData.data[0].last4,
          rekeninghouder: currentData.data[0].account_holder_name,
          bankNaam: currentData.data[0].bank_name
        };
      }
    }
  } catch (e) {
    console.warn(`⚠️ [Bank Account] Kon huidige bankrekening niet ophalen voor audit: ${e.message}`);
  }

  // Bepaal het land uit het IBAN (eerste 2 letters)
  const country = cleanIban.substring(0, 2);

  // Voeg nieuwe bankrekening toe aan Stripe Connect account
  // Stripe zal automatisch de nieuwe als default instellen
  const params = new URLSearchParams();
  params.set('external_account[object]', 'bank_account');
  params.set('external_account[country]', country);
  params.set('external_account[currency]', 'eur');
  params.set('external_account[account_number]', cleanIban);
  params.set('external_account[account_holder_name]', cleanNaam);
  params.set('external_account[account_holder_type]', 'individual');

  const response = await httpClient(
    `https://api.stripe.com/v1/accounts/${stripeAccountId}/external_accounts`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'dashboard/schoonmaker/bank-account',
      action: 'update_bank_account_failed',
      stripeAccountId,
      error: errorText
    }));

    // Parse Stripe error voor betere foutmelding
    try {
      const stripeError = JSON.parse(errorText);
      if (stripeError.error?.type === 'invalid_request_error') {
        return res.status(400).json({
          correlationId,
          code: 'INVALID_IBAN',
          message: 'Het opgegeven IBAN is ongeldig. Controleer het nummer.'
        });
      }
    } catch (e) {
      // Niet-parseable error, gebruik generieke melding
    }

    return res.status(500).json({
      correlationId,
      code: 'STRIPE_ERROR',
      message: 'Er ging iets mis bij het bijwerken van je bankrekening'
    });
  }

  const newBankAccount = await response.json();

  console.log(JSON.stringify({
    level: 'INFO',
    correlationId,
    route: 'dashboard/schoonmaker/bank-account',
    action: 'bank_account_updated',
    userId: user.id,
    newLast4: newBankAccount.last4
  }));

  // Audit log opslaan (zonder volledige IBAN - alleen laatste 4 cijfers)
  const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection?.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;

  await logAudit({
    userId: user.id,
    action: 'update_bankrekening',
    entityType: 'stripe_external_account',
    entityId: stripeAccountId,
    oldValues: oldBankInfo,
    newValues: {
      last4: newBankAccount.last4,
      rekeninghouder: cleanNaam,
      bankNaam: newBankAccount.bank_name || null
    },
    ipAddress,
    userAgent
  });

  return res.status(200).json({
    success: true,
    message: 'Bankrekening succesvol bijgewerkt',
    last4: newBankAccount.last4,
    rekeninghouder: newBankAccount.account_holder_name,
    bankNaam: newBankAccount.bank_name || null
  });
}
