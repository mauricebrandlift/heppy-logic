/**
 * Simplified Funnel Tracking Utility
 * 
 * Logs one record per step completion to funnel_events table.
 * No session management, no localStorage, just simple event logging.
 * 
 * CRITICAL: This is non-fatal by design. Tracking failures must NEVER break
 * the main user flow (forms, payments, etc.). All errors are caught and logged.
 * 
 * Usage:
 *   import { logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';
 *   await logStepCompleted('abonnement', 'adres', 1, { postcode, plaats });
 */

import { apiClient } from '../api/client.js';

/**
 * Log a funnel step completion
 * 
 * @param {string} flowType - Type of flow (e.g., 'abonnement', 'eenmalig_schoonmaak', 'werken_bij')
 * @param {string} stepName - Name of the step (e.g., 'adres', 'opdracht', 'dagdelen', etc.)
 * @param {number} stepOrder - Order of the step (1, 2, 3, etc.)
 * @param {Object} metadata - Optional metadata to store (form data, IDs, etc.)
 * @returns {Promise<void>}
 */
export async function logStepCompleted(flowType, stepName, stepOrder, metadata = {}) {
  // CRITICAL: Wrap entire function in try-catch to prevent any tracking error
  // from breaking the main user flow (e.g., payment processing)
  try {
    await apiClient('/routes/tracking/log-event', {
      method: 'POST',
      body: JSON.stringify({
        flow_type: flowType,
        step_name: stepName,
        step_order: stepOrder,
        metadata
      })
    });
  } catch (err) {
    // Non-fatal: tracking failures should not break the user flow
    // Just log warning and continue - user experience is more important than tracking
    console.warn(`[Tracking] Non-fatal error logging ${flowType}/${stepName}:`, err.message);
  }
}

/**
 * Safe wrapper for tracking calls - use this in critical flows like payment
 * Adds an extra safety layer by catching even syntax/import errors
 * 
 * @param {Function} trackingFn - The tracking function to call
 * @returns {Promise<void>}
 */
export async function safeTrack(trackingFn) {
  try {
    await trackingFn();
  } catch (err) {
    // Silently fail - tracking is never critical
    console.warn('[Tracking] Safe wrapper caught error:', err.message);
  }
}
