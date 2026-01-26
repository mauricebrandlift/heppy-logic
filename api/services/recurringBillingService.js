/**
 * Recurring Billing Service
 * 
 * Automatisch incasseren van abonnementen op basis van next_billing_date.
 * Wordt aangeroepen door cron job (dagelijks) of manual test endpoint.
 * 
 * Flow:
 * 1. Check abonnementen waar next_billing_date <= today
 * 2. Maak PaymentIntent met opgeslagen payment method
 * 3. Confirm PaymentIntent direct (off_session)
 * 4. Bij success: genereer factuur, update next_billing_date
 * 5. Bij failure: log error, markeer abonnement, email naar admin
 */

import { supabaseConfig, stripeConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';
import { createFactuurForBetaling } from './factuurService.js';
import { sendEmail } from './emailService.js';

/**
 * Haal abonnementen op die vandaag gefactureerd moeten worden
 * Requirements: status = 'actief', next_billing_date <= today, SEPA setup completed
 */
async function getAbonnementenDueForBilling(correlationId) {
  console.log(`📅 [RecurringBilling] Ophalen abonnementen met next_billing_date <= today EN sepa_setup_completed = true [${correlationId}]`);
  
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const url = `${supabaseConfig.url}/rest/v1/abonnementen?next_billing_date=lte.${today}&status=eq.actief&sepa_setup_completed=eq.true&select=*`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Abonnementen ophalen mislukt: ${response.status}`);
  }

  const abonnementen = await response.json();
  console.log(`✅ [RecurringBilling] ${abonnementen.length} abonnement(en) gevonden voor billing (met SEPA setup) [${correlationId}]`);
  
  return abonnementen;
}

/**
 * Haal user gegevens op voor een abonnement
 */
async function getUserForAbonnement(gebruikerId, correlationId) {
  const url = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${gebruikerId}&select=*`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`User ophalen mislukt: ${response.status}`);
  }

  const users = await response.json();
  return users[0] || null;
}

/**
 * Maak en confirm PaymentIntent voor recurring billing
 */
async function createRecurringPaymentIntent({
  amount,
  customerId,
  paymentMethodId,
  metadata,
}, correlationId) {
  console.log(`💳 [RecurringBilling] Creating PaymentIntent voor €${(amount/100).toFixed(2)} [${correlationId}]`);
  
  // PaymentMethod is al attached via SEPA SetupIntent - geen extra attach nodig
  console.log(`ℹ️ [RecurringBilling] Using SEPA PaymentMethod ${paymentMethodId} (already attached via mandate) [${correlationId}]`);
  
  // Maak PaymentIntent
  const params = new URLSearchParams();
  params.set('amount', String(amount));
  params.set('currency', 'eur');
  params.set('customer', customerId);
  params.set('payment_method', paymentMethodId);
  params.set('off_session', 'true'); // Belangrijk: off-session payment
  params.set('confirm', 'true'); // Direct confirmen
  
  // Metadata
  for (const [key, value] of Object.entries(metadata)) {
    params.set(`metadata[${key}]`, String(value));
  }

  const response = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeConfig.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const paymentIntent = await response.json();

  if (!response.ok) {
    const errorMessage = paymentIntent?.error?.message || 'Unknown error';
    throw new Error(`PaymentIntent creation failed: ${errorMessage}`);
  }

  console.log(`✅ [RecurringBilling] PaymentIntent created and confirmed: ${paymentIntent.id} [${correlationId}]`);
  
  return paymentIntent;
}

/**
 * Sla betaling op in database
 */
async function createBetalingRecord({
  stripePaymentIntentId,
  gebruikerId,
  abonnementId,
  amount,
  status,
}, correlationId) {
  console.log(`💾 [RecurringBilling] Saving betaling record [${correlationId}]`);
  
  const url = `${supabaseConfig.url}/rest/v1/betalingen`;
  
  const data = {
    stripe_betaling_id: stripePaymentIntentId,
    gebruiker_id: gebruikerId,
    abonnement_id: abonnementId,
    amount_cents: amount,
    status: status,
    betaalmethode: 'recurring_card',
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Betaling opslaan mislukt: ${response.status} - ${errorText}`);
  }

  const betalingen = await response.json();
  console.log(`✅ [RecurringBilling] Betaling saved: ${betalingen[0].id} [${correlationId}]`);
  
  return betalingen[0];
}

/**
 * Update next_billing_date naar +28 dagen
 */
async function updateNextBillingDate(abonnementId, correlationId) {
  console.log(`📅 [RecurringBilling] Updating next_billing_date [${correlationId}]`);
  
  // Bereken nieuwe datum: +28 dagen
  const newDate = new Date();
  newDate.setDate(newDate.getDate() + 28);
  const nextBillingDate = newDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const url = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${abonnementId}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ next_billing_date: nextBillingDate }),
  });

  if (!response.ok) {
    throw new Error(`Next billing date update failed: ${response.status}`);
  }

  console.log(`✅ [RecurringBilling] Next billing date updated to ${nextBillingDate} [${correlationId}]`);
  
  return nextBillingDate;
}

/**
 * Markeer abonnement als failed (na payment failure)
 */
async function markAbonnementAsFailed(abonnementId, errorMessage, correlationId) {
  console.log(`⚠️ [RecurringBilling] Marking abonnement as payment_failed [${correlationId}]`);
  
  const url = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${abonnementId}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      status: 'payment_failed',
      // Optioneel: metadata kolom toevoegen voor error details
    }),
  });

  if (!response.ok) {
    console.error(`❌ [RecurringBilling] Failed to update abonnement status [${correlationId}]`);
  }
}

/**
 * Process één abonnement voor recurring billing
 */
export async function processAbonnementRecurringBilling(abonnement, correlationId) {
  console.log(`\n🔄 [RecurringBilling] ========== Processing Abonnement ${abonnement.id} ========== [${correlationId}]`);
  
  try {
    // 1. Validatie
    if (!abonnement.stripe_payment_method_id) {
      throw new Error('Geen payment method opgeslagen voor dit abonnement');
    }

    // 2. Haal user op
    const user = await getUserForAbonnement(abonnement.gebruiker_id, correlationId);
    if (!user) {
      throw new Error(`User niet gevonden: ${abonnement.gebruiker_id}`);
    }

    if (!user.stripe_customer_id) {
      throw new Error('Geen Stripe Customer ID voor deze user');
    }

    console.log(`👤 [RecurringBilling] User: ${user.email} (${user.id}) [${correlationId}]`);

    // 3. Bereken bedrag (uit abonnement kolommen)
    const sessionsPerCycle = abonnement.sessions_per_4w || 4;
    const prijsPerSessie = abonnement.prijs_per_sessie_cents || 0;
    const totalAmount = abonnement.bundle_amount_cents || (sessionsPerCycle * prijsPerSessie);

    if (totalAmount < 50) {
      throw new Error(`Bedrag (${totalAmount} cents) is te laag voor Stripe (minimum 50 cents)`);
    }

    console.log(`💰 [RecurringBilling] Bedrag: ${sessionsPerCycle} sessies × €${(prijsPerSessie/100).toFixed(2)} = €${(totalAmount/100).toFixed(2)} [${correlationId}]`);

    // 4. Maak PaymentIntent (direct confirmed)
    const paymentIntent = await createRecurringPaymentIntent({
      amount: totalAmount,
      customerId: user.stripe_customer_id,
      paymentMethodId: abonnement.stripe_payment_method_id,
      metadata: {
        abonnement_id: abonnement.id,
        gebruiker_id: user.id,
        email: user.email,
        flow: 'recurring_billing',
        sessions_per_4w: sessionsPerCycle,
        type: 'abonnement_renewal',
      },
    }, correlationId);

    // 5. Check payment status
    // SEPA betalingen zijn NIET instant - status kan 'processing' zijn
    // Cards: instant succeeded
    // SEPA: processing → succeeded (1-3 dagen)
    const validStatuses = ['succeeded', 'processing'];
    
    if (!validStatuses.includes(paymentIntent.status)) {
      throw new Error(`PaymentIntent status is ${paymentIntent.status}, expected 'succeeded' or 'processing'`);
    }

    const isProcessing = paymentIntent.status === 'processing';
    console.log(`✅ [RecurringBilling] Payment ${isProcessing ? 'processing (SEPA)' : 'succeeded'}: ${paymentIntent.id} [${correlationId}]`);

    // 6. Sla betaling op
    // Status: 'betaald' als succeeded, 'processing' als SEPA processing
    const betaling = await createBetalingRecord({
      stripePaymentIntentId: paymentIntent.id,
      gebruikerId: user.id,
      abonnementId: abonnement.id,
      amount: totalAmount,
      status: isProcessing ? 'processing' : 'betaald',
    }, correlationId);

    // 7. Genereer factuur
    console.log(`📄 [RecurringBilling] Generating invoice [${correlationId}]`);
    
    const factuur = await createFactuurForBetaling({
      gebruikerId: user.id,
      abonnementId: abonnement.id,
      betalingId: betaling.id,
      totaalCents: totalAmount,
      omschrijving: `Heppy schoonmaak abonnement - ${sessionsPerCycle}x per 4 weken (verlenging)`,
      regels: [
        {
          omschrijving: `Schoonmaakdiensten abonnement verlenging (${sessionsPerCycle} sessies)`,
          aantal: sessionsPerCycle,
          prijs_per_stuk_cents: prijsPerSessie,
          subtotaal_cents: totalAmount,
        }
      ],
      stripeCustomerId: user.stripe_customer_id,
      stripePaymentIntentId: paymentIntent.id,
      metadata: {
        flow: 'recurring_billing',
        type: 'abonnement_renewal',
      }
    }, correlationId);

    console.log(`✅ [RecurringBilling] Invoice generated: ${factuur.factuur_nummer} [${correlationId}]`);

    // 8. Update next_billing_date
    const nextBillingDate = await updateNextBillingDate(abonnement.id, correlationId);

    // 9. Verstuur bevestiging email naar klant
    try {
      await sendEmail({
        to: user.email,
        subject: '✅ Betaling Verwerkt - Heppy Schoonmaak',
        html: `
          <h2>Beste ${user.voornaam},</h2>
          <p>Je abonnementsbetaling is succesvol verwerkt.</p>
          <p><strong>Bedrag:</strong> €${(totalAmount/100).toFixed(2)}</p>
          <p><strong>Factuur:</strong> ${factuur.factuur_nummer}</p>
          <p><strong>Volgende betaling:</strong> ${nextBillingDate}</p>
          ${factuur.pdf_url ? `<p><a href="${factuur.pdf_url}">Download factuur (PDF)</a></p>` : ''}
          <p>Bedankt voor je vertrouwen in Heppy!</p>
        `,
      }, correlationId);
      
      console.log(`📧 [RecurringBilling] Email sent to ${user.email} [${correlationId}]`);
    } catch (emailError) {
      console.error(`⚠️ [RecurringBilling] Email verzenden mislukt (niet fataal) [${correlationId}]`, emailError.message);
    }

    console.log(`🎉 [RecurringBilling] ========== SUCCESS: ${abonnement.id} ========== [${correlationId}]\n`);

    return {
      success: true,
      abonnementId: abonnement.id,
      paymentIntentId: paymentIntent.id,
      factuurNummer: factuur.factuur_nummer,
      nextBillingDate,
    };

  } catch (error) {
    console.error(`❌ [RecurringBilling] FAILED: ${abonnement.id} [${correlationId}]`, {
      error: error.message,
      stack: error.stack,
    });

    // Markeer abonnement als failed
    await markAbonnementAsFailed(abonnement.id, error.message, correlationId);

    // Verstuur admin notification
    try {
      await sendEmail({
        to: 'notifications@heppy-schoonmaak.nl',
        subject: '⚠️ Recurring Billing Failed',
        html: `
          <h2>Recurring Billing Failure</h2>
          <p><strong>Abonnement ID:</strong> ${abonnement.id}</p>
          <p><strong>User ID:</strong> ${abonnement.gebruiker_id}</p>
          <p><strong>Error:</strong> ${error.message}</p>
          <p>Actie vereist: Neem contact op met klant.</p>
        `,
      }, correlationId);
    } catch (emailError) {
      console.error(`❌ [RecurringBilling] Admin email failed [${correlationId}]`, emailError.message);
    }

    return {
      success: false,
      abonnementId: abonnement.id,
      error: error.message,
    };
  }
}

/**
 * Main functie: process alle abonnementen die vandaag gefactureerd moeten worden
 */
export async function processAllRecurringBillings(correlationId = `recurring_${Date.now()}`) {
  console.log(`\n🚀 [RecurringBilling] ========== START RECURRING BILLING RUN ========== [${correlationId}]`);
  
  try {
    // Haal abonnementen op
    const abonnementen = await getAbonnementenDueForBilling(correlationId);

    if (abonnementen.length === 0) {
      console.log(`ℹ️ [RecurringBilling] Geen abonnementen om te verwerken [${correlationId}]`);
      return {
        success: true,
        processed: 0,
        results: [],
      };
    }

    // Process elk abonnement
    const results = [];
    for (const abonnement of abonnementen) {
      const result = await processAbonnementRecurringBilling(abonnement, correlationId);
      results.push(result);
      
      // Kleine delay tussen payments (rate limiting)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`\n✅ [RecurringBilling] ========== RUN COMPLETE ========== [${correlationId}]`);
    console.log(`📊 [RecurringBilling] Total: ${results.length}, Success: ${successCount}, Failed: ${failureCount}`);

    return {
      success: true,
      processed: results.length,
      successCount,
      failureCount,
      results,
    };

  } catch (error) {
    console.error(`❌ [RecurringBilling] ========== RUN FAILED ========== [${correlationId}]`, {
      error: error.message,
      stack: error.stack,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}
