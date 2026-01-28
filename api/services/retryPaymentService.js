// retryPaymentService: Handle failed payment retries voor recurring billing
// Retry schema: +1, +2, +4 dagen (max 3 pogingen)
// Na 3 failures: zet abonnement op pauze

import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';
import { emailService } from './emailService.js';
import { notificeerBetalingMislukt } from './notificatieService.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Calculate next retry date based on retry count
 * Retry 1: +1 dag
 * Retry 2: +2 dagen totaal (nog 1 dag extra)
 * Retry 3: +4 dagen totaal (nog 2 dagen extra)
 */
function calculateNextRetryDate(retryCount) {
  const daysToAdd = retryCount === 0 ? 1 : retryCount === 1 ? 2 : 4;
  
  const retryDate = new Date();
  retryDate.setDate(retryDate.getDate() + daysToAdd);
  
  return retryDate.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Update abonnement met retry info
 */
async function updateRetryInfo(abonnementId, retryCount, failureReason, correlationId) {
  const nextRetryDate = retryCount < 3 ? calculateNextRetryDate(retryCount) : null;
  const today = new Date().toISOString().split('T')[0];
  
  console.log(`🔄 [RetryPayment] Updating retry info: count=${retryCount}, next=${nextRetryDate} [${correlationId}]`);
  
  const url = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${abonnementId}`;
  
  const body = {
    payment_retry_count: retryCount,
    last_payment_failure_date: today,
    next_retry_date: nextRetryDate,
    payment_failure_reason: failureReason
  };
  
  const response = await httpClient(url, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  }, correlationId);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update retry info: ${text}`);
  }

  console.log(`✅ [RetryPayment] Retry info updated [${correlationId}]`);
  
  return { retryCount, nextRetryDate };
}

/**
 * Pause abonnement na 3 failures
 */
async function pauseAbonnement(abonnementId, correlationId) {
  console.log(`⏸️ [RetryPayment] Pausing abonnement after 3 failed retries [${correlationId}]`);
  
  const url = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${abonnementId}`;
  
  const response = await httpClient(url, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      status: 'gepauzeerd',
      payment_retry_count: 3,
      next_retry_date: null
    })
  }, correlationId);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to pause abonnement: ${text}`);
  }

  console.log(`✅ [RetryPayment] Abonnement paused [${correlationId}]`);
}

/**
 * Send failure notification emails
 */
async function sendFailureEmails(abonnement, retryCount, nextRetryDate, correlationId) {
  const { gebruiker_id } = abonnement;
  
  // Get user email
  const userUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${gebruiker_id}&select=email,voornaam`;
  const userResp = await httpClient(userUrl, {
    method: 'GET',
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
    }
  }, correlationId);

  if (!userResp.ok) {
    console.error(`❌ [RetryPayment] Failed to fetch user for email [${correlationId}]`);
    return;
  }

  const users = await userResp.json();
  if (!users || users.length === 0) {
    console.error(`❌ [RetryPayment] No user found [${correlationId}]`);
    return;
  }

  const user = users[0];
  
  // Send customer email based on retry count
  if (retryCount === 1) {
    // First failure - check saldo
    await emailService.sendPaymentFailedRetry1(user.email, {
      voornaam: user.voornaam,
      nextRetryDate,
      abonnementId: abonnement.id
    }, correlationId);
  } else if (retryCount === 2) {
    // Second failure - update IBAN
    await emailService.sendPaymentFailedRetry2(user.email, {
      voornaam: user.voornaam,
      nextRetryDate,
      abonnementId: abonnement.id
    }, correlationId);
  } else if (retryCount === 3) {
    // Third failure - abonnement paused
    await emailService.sendAbonnementPaused(user.email, {
      voornaam: user.voornaam,
      abonnementId: abonnement.id
    }, correlationId);
  }
  
  // Always send admin notification
  await emailService.sendPaymentFailedAdmin({
    abonnementId: abonnement.id,
    gebruikerId: gebruiker_id,
    retryCount,
    nextRetryDate,
    failureReason: abonnement.payment_failure_reason
  }, correlationId);
  
  console.log(`📧 [RetryPayment] Failure emails sent (retry ${retryCount}) [${correlationId}]`);
  
  // 🔔 NOTIFICATIE: Betaling mislukt
  console.log(`🔔 [RetryPayment] Creating notificatie for payment failure`);
  try {
    // Haal admin ID op
    const adminUrl = `${supabaseConfig.url}/rest/v1/user_profiles?rol=eq.admin&select=id&limit=1`;
    const adminResp = await httpClient(adminUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
      }
    }, correlationId);
    
    if (adminResp.ok) {
      const admins = await adminResp.json();
      const adminId = admins[0]?.id;
      
      if (adminId) {
        await notificeerBetalingMislukt({
          klantId: gebruiker_id,
          adminId,
          abonnementId: abonnement.id,
          retryCount,
          nextRetryDate: retryCount < 3 ? nextRetryDate : null
        });
        console.log(`✅ [RetryPayment] Notificatie aangemaakt`);
      }
    }
  } catch (notifError) {
    console.error(`⚠️ [RetryPayment] Notificatie failed (niet-blokkerende fout):`, notifError.message);
  }
}

/**
 * Handle payment failure from Stripe webhook
 * - Increment retry count
 * - Schedule next retry (or pause if count = 3)
 * - Send notification emails
 */
export const retryPaymentService = {
  async handlePaymentFailure(paymentIntentId, abonnementId, failureReason, correlationId) {
    console.log(`❌ [RetryPayment] Processing payment failure: ${paymentIntentId} [${correlationId}]`);
    
    // Get current abonnement data
    const url = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${abonnementId}&select=*`;
    const resp = await httpClient(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      }
    }, correlationId);

    if (!resp.ok) {
      throw new Error(`Failed to fetch abonnement: ${await resp.text()}`);
    }

    const abonnementen = await resp.json();
    if (!abonnementen || abonnementen.length === 0) {
      throw new Error(`Abonnement not found: ${abonnementId}`);
    }

    const abonnement = abonnementen[0];
    const currentRetryCount = abonnement.payment_retry_count || 0;
    const newRetryCount = currentRetryCount + 1;
    
    console.log(`🔄 [RetryPayment] Current retry count: ${currentRetryCount}, new: ${newRetryCount} [${correlationId}]`);
    
    // Update retry info
    const { nextRetryDate } = await updateRetryInfo(abonnementId, newRetryCount, failureReason, correlationId);
    
    // If 3 failures, pause abonnement
    if (newRetryCount >= 3) {
      await pauseAbonnement(abonnementId, correlationId);
    }
    
    // Send notification emails
    await sendFailureEmails(
      { ...abonnement, payment_failure_reason: failureReason }, 
      newRetryCount, 
      nextRetryDate, 
      correlationId
    );
    
    console.log(`✅ [RetryPayment] Payment failure handled successfully [${correlationId}]`);
    
    return { 
      retryCount: newRetryCount, 
      nextRetryDate,
      paused: newRetryCount >= 3
    };
  }
};
