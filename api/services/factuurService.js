/**
 * Factuur Service
 * 
 * Beheert facturen voor Heppy betalingen.
 * Genereert facturen via Stripe Invoicing API en slaat ze op in database.
 * 
 * Functies:
 * - createFactuurForBetaling() - Maak factuur na succesvolle betaling
 * - generateFactuurNummer() - Genereer uniek factuurnummer (HEPPY-2025-001)
 * - createStripeInvoice() - Maak Stripe Invoice via API
 * - getFactuurById() - Haal factuur op uit database
 * - getFacturenForUser() - Haal alle facturen van een user op
 */

import { stripeConfig, supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

/**
 * Bereken BTW bedrag
 * @param {number} subtotaalCents - Bedrag excl. BTW in centen
 * @param {number} btwPercentage - BTW percentage (bijv. 21)
 * @returns {number} BTW bedrag in centen
 */
function calculateBTW(subtotaalCents, btwPercentage = 21) {
  return Math.round(subtotaalCents * (btwPercentage / 100));
}

/**
 * Genereer uniek factuurnummer
 * Formaat: HEPPY-YYYY-NNN (bijv. HEPPY-2025-001)
 * 
 * @param {string} correlationId
 * @returns {Promise<string>} Factuurnummer
 */
export async function generateFactuurNummer(correlationId) {
  const year = new Date().getFullYear();
  
  // Haal volgende nummer op uit sequence
  const url = `${supabaseConfig.url}/rest/v1/rpc/nextval`;
  
  const response = await httpClient(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
    },
    body: JSON.stringify({ sequence_name: 'factuur_nummer_seq' }),
  }, correlationId);

  if (!response.ok) {
    // Fallback: tel bestaande facturen + 1
    console.warn(`⚠️ [FactuurService] Sequence query mislukt, gebruik fallback [${correlationId}]`);
    const countUrl = `${supabaseConfig.url}/rest/v1/facturen?select=count`;
    const countResponse = await httpClient(countUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      },
    }, correlationId);
    
    if (countResponse.ok) {
      const countData = await countResponse.json();
      const nextNum = (countData[0]?.count || 0) + 1;
      return `HEPPY-${year}-${String(nextNum).padStart(3, '0')}`;
    }
    
    // Laatste fallback: timestamp
    return `HEPPY-${year}-${Date.now()}`;
  }

  const data = await response.json();
  const seqNum = data || 1;
  
  return `HEPPY-${year}-${String(seqNum).padStart(3, '0')}`;
}

/**
 * Maak Stripe Invoice aan
 * 
 * @param {Object} params
 * @param {string} params.customerId - Stripe Customer ID
 * @param {string} params.omschrijving - Factuur omschrijving
 * @param {Array} params.regels - Array van factuurregels
 * @param {number} params.totaalCents - Totaal bedrag incl. BTW in centen
 * @param {string} [params.paymentIntentId] - Stripe PaymentIntent ID (voor directe koppeling)
 * @param {Object} [params.metadata] - Extra metadata
 * @param {string} correlationId
 * @returns {Promise<Object>} Stripe Invoice object
 */
export async function createStripeInvoice({ customerId, omschrijving, regels, totaalCents, paymentIntentId, metadata }, correlationId) {
  console.log(`📄 [FactuurService] Stripe Invoice aanmaken voor customer ${customerId} [${correlationId}]`);

  // 1. Maak Invoice aan (draft status)
  const createParams = new URLSearchParams();
  createParams.set('customer', customerId);
  createParams.set('auto_advance', 'false'); // Handmatig finaliseren
  createParams.set('collection_method', 'charge_automatically');
  
  if (omschrijving) {
    createParams.set('description', omschrijving);
  }
  
  // Metadata
  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      createParams.set(`metadata[${key}]`, String(value));
    }
  }

  const createResponse = await fetch('https://api.stripe.com/v1/invoices', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeConfig.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: createParams.toString(),
  });

  const invoice = await createResponse.json();

  if (!createResponse.ok) {
    const err = new Error(invoice?.error?.message || 'Stripe Invoice aanmaken mislukt');
    err.code = createResponse.status || 500;
    throw err;
  }

  console.log(`✅ [FactuurService] Invoice aangemaakt: ${invoice.id} [${correlationId}]`);

  // 2. Voeg invoice items toe (factuurregels)
  for (const regel of regels) {
    const itemParams = new URLSearchParams();
    itemParams.set('customer', customerId);
    itemParams.set('invoice', invoice.id);
    itemParams.set('description', regel.omschrijving);
    itemParams.set('currency', 'eur');
    
    // Stripe accepteert OFWEL amount OFWEL quantity+unit_amount (NIET beide!)
    // We gebruiken altijd quantity+unit_amount voor transparantie
    const quantity = regel.aantal || 1;
    const unitAmount = regel.prijs_per_stuk_cents || regel.subtotaal_cents;
    
    itemParams.set('quantity', String(quantity));
    itemParams.set('unit_amount', String(unitAmount));

    const itemResponse = await fetch('https://api.stripe.com/v1/invoiceitems', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeConfig.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: itemParams.toString(),
    });

    if (!itemResponse.ok) {
      const itemError = await itemResponse.json();
      console.error(`❌ [FactuurService] Invoice item toevoegen mislukt [${correlationId}]`, itemError);
      // Niet fataal - invoice kan nog steeds gefinaliseerd worden
    } else {
      const itemResult = await itemResponse.json();
      console.log(`✅ [FactuurService] Invoice item toegevoegd: ${regel.omschrijving} (${quantity}x €${(unitAmount/100).toFixed(2)}) [${correlationId}]`);
    }
  }

  // 3. Finaliseer invoice (maakt het immutable en genereert PDF)
  const finalizeResponse = await fetch(`https://api.stripe.com/v1/invoices/${invoice.id}/finalize`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeConfig.secretKey}`,
    },
  });

  const finalizedInvoice = await finalizeResponse.json();

  if (!finalizeResponse.ok) {
    console.error(`❌ [FactuurService] Invoice finaliseren mislukt [${correlationId}]`);
    // Return draft invoice als fallback
    return invoice;
  }

  console.log(`✅ [FactuurService] Invoice gefinaliseerd: ${finalizedInvoice.invoice_pdf} [${correlationId}]`);

  // 4. Markeer invoice als betaald met bestaande PaymentIntent (voorkomt duplicate payments)
  let paidInvoice = finalizedInvoice;
  if (paymentIntentId) {
    try {
      console.log(`💳 [FactuurService] Markeren invoice als betaald met PaymentIntent ${paymentIntentId} [${correlationId}]`);
      
      const payParams = new URLSearchParams();
      payParams.set('paid_out_of_band', 'true');
      
      const payResponse = await fetch(`https://api.stripe.com/v1/invoices/${finalizedInvoice.id}/pay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeConfig.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payParams.toString(),
      });
      
      if (payResponse.ok) {
        paidInvoice = await payResponse.json();
        console.log(`✅ [FactuurService] Invoice gemarkeerd als betaald, status: ${paidInvoice.status} [${correlationId}]`);
      } else {
        const payError = await payResponse.json();
        console.error(`⚠️ [FactuurService] Invoice pay mislukt: ${payError?.error?.message} [${correlationId}]`);
      }
    } catch (payErr) {
      console.error(`⚠️ [FactuurService] Invoice pay error: ${payErr.message} [${correlationId}]`);
    }
  }

  return paidInvoice;
}

/**
 * Maak factuur aan na succesvolle betaling
 * 
 * @param {Object} params
 * @param {string} params.gebruikerId - user_profiles.id
 * @param {string} [params.abonnementId] - abonnementen.id (optioneel)
 * @param {string} [params.opdrachtId] - opdrachten.id (optioneel)
 * @param {string} [params.bestellingId] - bestellingen.id (optioneel, voor webshop)
 * @param {string} [params.betalingId] - betalingen.id (optioneel)
 * @param {number} params.totaalCents - Totaal bedrag incl. BTW
 * @param {string} params.omschrijving - Factuur omschrijving
 * @param {Array} params.regels - Factuurregels
 * @param {string} [params.stripeCustomerId] - Stripe Customer ID (voor Stripe Invoice)
 * @param {string} [params.stripePaymentIntentId] - Stripe PaymentIntent ID
 * @param {Object} [params.metadata] - Extra metadata
 * @param {string} correlationId
 * @returns {Promise<Object>} Factuur object
 */
export async function createFactuurForBetaling({
  gebruikerId,
  abonnementId,
  opdrachtId,
  bestellingId,
  betalingId,
  totaalCents,
  omschrijving,
  regels,
  stripeCustomerId,
  stripePaymentIntentId,
  metadata
}, correlationId) {
  const entityType = bestellingId ? 'bestelling' : (opdrachtId ? 'opdracht' : (abonnementId ? 'abonnement' : 'betaling'));
  const entityId = bestellingId || opdrachtId || abonnementId || betalingId;
  console.log(`💳 [FactuurService] Factuur aanmaken voor ${entityType} ${entityId} [${correlationId}]`);

  // 1. Check of factuur al bestaat voor deze PaymentIntent
  if (stripePaymentIntentId) {
    const checkUrl = `${supabaseConfig.url}/rest/v1/facturen?stripe_payment_intent_id=eq.${stripePaymentIntentId}&select=id,factuur_nummer`;
    const checkResponse = await httpClient(checkUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      },
    }, correlationId);

    if (checkResponse.ok) {
      const existing = await checkResponse.json();
      if (existing && existing.length > 0) {
        console.log(`ℹ️ [FactuurService] Factuur bestaat al voor PaymentIntent ${stripePaymentIntentId}: ${existing[0].id} [${correlationId}]`);
        return existing[0];
      }
    }
  }

  // 2. Genereer factuurnummer (optioneel voor receipts)
  let factuurNummer = null;
  try {
    factuurNummer = await generateFactuurNummer(correlationId);
    console.log(`📋 [FactuurService] Factuurnummer: ${factuurNummer} [${correlationId}]`);
  } catch (error) {
    console.warn(`⚠️ [FactuurService] Factuurnummer genereren mislukt, gebruik null [${correlationId}]:`, error.message);
  }

  // 3. Bereken BTW (aanname: bedrag is incl. BTW)
  const btwPercentage = 21;
  const subtotaalCents = Math.round(totaalCents / (1 + btwPercentage / 100));
  const btwCents = totaalCents - subtotaalCents;

  console.log(`💰 [FactuurService] Bedragen - Subtotaal: €${(subtotaalCents / 100).toFixed(2)}, BTW (${btwPercentage}%): €${(btwCents / 100).toFixed(2)}, Totaal: €${(totaalCents / 100).toFixed(2)} [${correlationId}]`);

  // 4. Maak Stripe Invoice aan voor alle betalingen (one-time en recurring)
  let stripeInvoice = null;
  let pdfUrl = null;

  if (stripeCustomerId) {
    try {
      console.log(`📄 [FactuurService] Stripe Invoice aanmaken voor customer ${stripeCustomerId} [${correlationId}]`);
      
      stripeInvoice = await createStripeInvoice({
        customerId: stripeCustomerId,
        paymentIntentId: stripePaymentIntentId, // Koppel aan bestaande payment
        description: `${regels[0]?.omschrijving || 'Betaling'} - ${factuurNummer || 'Factuur'}`,
        regels: regels,
        metadata: metadata || {}
      }, correlationId);

      if (stripeInvoice?.hosted_invoice_url) {
        pdfUrl = stripeInvoice.hosted_invoice_url;
        console.log(`✅ [FactuurService] Invoice aangemaakt: ${stripeInvoice.id} [${correlationId}]`);
      }
    } catch (error) {
      console.error(`❌ [FactuurService] Invoice aanmaken mislukt (niet fataal): ${error.message} [${correlationId}]`);
      // Continue - we slaan factuur alsnog op in database
    }
  } else {
    console.log(`ℹ️ [FactuurService] Geen Stripe Customer ID - skip Stripe Invoice [${correlationId}]`);
  }

  // 5. Sla factuur op in database
  const factuurId = crypto.randomUUID();
  const factuurdatum = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const factuurData = {
    id: factuurId,
    factuur_nummer: factuurNummer,
    factuurdatum,
    gebruiker_id: gebruikerId,
    abonnement_id: abonnementId || null,
    opdracht_id: opdrachtId || null,
    bestelling_id: bestellingId || null,
    betaling_id: betalingId || null,
    subtotaal_cents: subtotaalCents,
    btw_percentage: btwPercentage,
    btw_cents: btwCents,
    totaal_cents: totaalCents,
    currency: 'eur',
    status: 'betaald', // Direct betaald (want na succesvolle payment)
    betaald_op: new Date().toISOString(),
    stripe_invoice_id: stripeInvoice?.id || null,
    stripe_payment_intent_id: stripePaymentIntentId || null,
    omschrijving,
    regels: JSON.stringify(regels),
    pdf_url: pdfUrl,
  };

  const url = `${supabaseConfig.url}/rest/v1/facturen`;
  const response = await httpClient(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(factuurData),
  }, correlationId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Factuur opslaan in database mislukt: ${errorText}`);
  }

  console.log(`✅ [FactuurService] Factuur opgeslagen in database: ${factuurId} [${correlationId}]`);

  return {
    id: factuurId,
    factuur_nummer: factuurNummer,
    pdf_url: pdfUrl,
    stripe_invoice_id: stripeInvoice?.id || null,
    totaal_cents: totaalCents,
  };
}

/**
 * Haal factuur op uit database
 * 
 * @param {string} factuurId - facturen.id (UUID)
 * @param {string} correlationId
 * @returns {Promise<Object|null>} Factuur object of null
 */
export async function getFactuurById(factuurId, correlationId) {
  const url = `${supabaseConfig.url}/rest/v1/facturen?id=eq.${factuurId}&select=*`;
  
  const response = await httpClient(url, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
    },
  }, correlationId);

  if (!response.ok) {
    throw new Error(`Factuur ophalen mislukt: ${await response.text()}`);
  }

  const data = await response.json();
  return data[0] || null;
}

/**
 * Haal alle facturen van een gebruiker op
 * 
 * @param {string} gebruikerId - user_profiles.id
 * @param {Object} [options] - Query opties
 * @param {number} [options.limit] - Max aantal resultaten
 * @param {number} [options.offset] - Offset voor paginatie
 * @param {string} [options.orderBy] - Sortering (bijv. 'factuurdatum.desc')
 * @param {string} correlationId
 * @returns {Promise<Array>} Array van facturen
 */
export async function getFacturenForUser(gebruikerId, options = {}, correlationId) {
  const { limit = 50, offset = 0, orderBy = 'factuurdatum.desc' } = options;
  
  let url = `${supabaseConfig.url}/rest/v1/facturen?gebruiker_id=eq.${gebruikerId}&select=*&order=${orderBy}`;
  
  if (limit) url += `&limit=${limit}`;
  if (offset) url += `&offset=${offset}`;
  
  const response = await httpClient(url, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
    },
  }, correlationId);

  if (!response.ok) {
    throw new Error(`Facturen ophalen mislukt: ${await response.text()}`);
  }

  return response.json();
}

export const factuurService = {
  createFactuurForBetaling,
  generateFactuurNummer,
  createStripeInvoice,
  getFactuurById,
  getFacturenForUser,
};
