// api/services/trackingService.js
/**
 * Funnel Tracking Service
 * Tracks user journey through forms for conversion optimization
 */

import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

function uuid() {
  return globalThis.crypto?.randomUUID 
    ? globalThis.crypto.randomUUID() 
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
}

/**
 * Start nieuwe tracking sessie
 */
async function startSession({ sessionId, flowType, metadata }, correlationId) {
  const url = `${supabaseConfig.url}/rest/v1/aanvraag_tracking`;
  
  // Bepaal totaal aantal stappen per flow type
  const totalSteps = {
    'abonnement': 6, // adres, opdracht, dagdelen, persoonsgegevens, betaling, success
    'eenmalig': 5,   // adres, opdracht, persoonsgegevens, betaling, success
    'werken_bij': 4  // persoonsgegevens, motivatie, upload, success
  };
  
  const body = {
    session_id: sessionId,
    flow_type: flowType,
    current_step: 'start', // Eerste stap
    total_steps: totalSteps[flowType] || 5,
    steps_completed: 0,
    status: 'in_progress',
    metadata: metadata || {},
    device_type: metadata?.deviceType || null,
    referrer_url: metadata?.referrerUrl || null
  };
  
  const resp = await httpClient(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  }, correlationId);
  
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to start tracking session: ${text}`);
  }
  
  return resp.json();
}

/**
 * Update huidige stap
 */
async function updateStep({ sessionId, stepName, stepOrder, formData, completed }, correlationId) {
  console.log(`📊 [TrackingService] Updating step: ${stepName} for session ${sessionId} [${correlationId}]`);
  
  // 1. Update hoofdrecord (current_step, steps_completed)
  const trackingUrl = `${supabaseConfig.url}/rest/v1/aanvraag_tracking?session_id=eq.${sessionId}`;
  const trackingBody = {
    current_step: stepName,
    steps_completed: stepOrder,
    updated_at: new Date().toISOString(),
    form_data: formData || {}
  };
  
  const trackingResp = await httpClient(trackingUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(trackingBody)
  }, correlationId);
  
  if (!trackingResp.ok) {
    const text = await trackingResp.text();
    throw new Error(`Failed to update tracking: ${text}`);
  }
  
  // 2. Maak step history record aan
  const stepsUrl = `${supabaseConfig.url}/rest/v1/aanvraag_tracking_steps`;
  const stepsBody = {
    id: uuid(),
    session_id: sessionId,
    step_name: stepName,
    step_order: stepOrder,
    step_data: formData || {},
    completed: completed || false,
    entered_at: new Date().toISOString()
  };
  
  const stepsResp = await httpClient(stepsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(stepsBody)
  }, correlationId);
  
  if (!stepsResp.ok) {
    const text = await stepsResp.text();
    console.warn(`⚠️ [TrackingService] Failed to create step record: ${text}`);
    // Non-fatal, continue
  }
  
  console.log(`✅ [TrackingService] Step updated: ${stepName} [${correlationId}]`);
  return true;
}

/**
 * Update vorige stap met exit tijd
 */
async function exitStep({ sessionId, stepName, timeSpent }, correlationId) {
  const url = `${supabaseConfig.url}/rest/v1/aanvraag_tracking_steps?session_id=eq.${sessionId}&step_name=eq.${stepName}&exited_at=is.null`;
  
  const body = {
    exited_at: new Date().toISOString(),
    time_spent_seconds: timeSpent || 0,
    completed: true
  };
  
  const resp = await httpClient(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(body)
  }, correlationId);
  
  if (!resp.ok) {
    const text = await resp.text();
    console.warn(`⚠️ [TrackingService] Failed to exit step: ${text}`);
  }
  
  return true;
}

/**
 * Koppel user_id zodra bekend (na email invullen)
 */
async function linkUser({ sessionId, userId }, correlationId) {
  console.log(`👤 [TrackingService] Linking user ${userId} to session ${sessionId} [${correlationId}]`);
  
  const url = `${supabaseConfig.url}/rest/v1/aanvraag_tracking?session_id=eq.${sessionId}`;
  const body = { user_id: userId };
  
  const resp = await httpClient(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(body)
  }, correlationId);
  
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to link user: ${text}`);
  }
  
  console.log(`✅ [TrackingService] User linked [${correlationId}]`);
  return true;
}

/**
 * Koppel payment intent
 */
async function linkPaymentIntent({ sessionId, paymentIntentId }, correlationId) {
  console.log(`💳 [TrackingService] Linking payment intent ${paymentIntentId} [${correlationId}]`);
  
  const url = `${supabaseConfig.url}/rest/v1/aanvraag_tracking?session_id=eq.${sessionId}`;
  const body = {
    stripe_payment_intent_id: paymentIntentId,
    status: 'payment_intent_created'
  };
  
  const resp = await httpClient(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(body)
  }, correlationId);
  
  if (!resp.ok) {
    const text = await resp.text();
    console.warn(`⚠️ [TrackingService] Failed to link payment intent: ${text}`);
  }
  
  return true;
}

/**
 * Markeer sessie als voltooid (na succesvolle betaling)
 */
async function completeSession({ sessionId, aanvraagId }, correlationId) {
  console.log(`✅ [TrackingService] Completing session ${sessionId} [${correlationId}]`);
  
  // Bereken totale tijd
  const selectUrl = `${supabaseConfig.url}/rest/v1/aanvraag_tracking?session_id=eq.${sessionId}&select=created_at,total_steps`;
  const selectResp = await httpClient(selectUrl, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`
    }
  }, correlationId);
  
  let timeSpent = null;
  let totalSteps = null;
  
  if (selectResp.ok) {
    const data = await selectResp.json();
    if (data.length > 0) {
      const createdAt = new Date(data[0].created_at);
      const now = new Date();
      timeSpent = Math.floor((now - createdAt) / 1000); // seconden
      totalSteps = data[0].total_steps;
    }
  }
  
  // Update naar completed
  const url = `${supabaseConfig.url}/rest/v1/aanvraag_tracking?session_id=eq.${sessionId}`;
  const body = {
    status: 'completed',
    completed_at: new Date().toISOString(),
    final_aanvraag_id: aanvraagId,
    steps_completed: totalSteps, // Alle stappen voltooid
    time_spent_seconds: timeSpent
  };
  
  const resp = await httpClient(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(body)
  }, correlationId);
  
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to complete session: ${text}`);
  }
  
  console.log(`✅ [TrackingService] Session completed [${correlationId}]`);
  return true;
}

/**
 * Markeer sessie als abandoned (voor cron job)
 */
async function markAbandoned({ sessionId }, correlationId) {
  const url = `${supabaseConfig.url}/rest/v1/aanvraag_tracking?session_id=eq.${sessionId}`;
  const body = {
    status: 'abandoned',
    abandoned_at: new Date().toISOString()
  };
  
  const resp = await httpClient(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(body)
  }, correlationId);
  
  return resp.ok;
}

/**
 * Haal sessie op via sessionId
 */
async function getSession({ sessionId }, correlationId) {
  const url = `${supabaseConfig.url}/rest/v1/aanvraag_tracking?session_id=eq.${sessionId}`;
  
  const resp = await httpClient(url, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`
    }
  }, correlationId);
  
  if (!resp.ok) {
    return null;
  }
  
  const data = await resp.json();
  return data.length > 0 ? data[0] : null;
}

export const trackingService = {
  startSession,
  updateStep,
  exitStep,
  linkUser,
  linkPaymentIntent,
  completeSession,
  markAbandoned,
  getSession
};
