/**
 * Simplified Funnel Tracking Utility
 * 
 * Logs one record per step completion to funnel_events table.
 * No session management, no localStorage, just simple event logging.
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
    console.warn('Funnel tracking failed:', err.message);
  }
}
