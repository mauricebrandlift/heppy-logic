/**
 * Simplified Funnel Event Logger
 * 
 * POST /api/routes/tracking/log-event
 * 
 * Logs one record per step completion to funnel_events table.
 * No session management, just simple INSERT operations.
 */

import { supabaseConfig } from '../../config/index.js';
import { httpClient } from '../../utils/apiClient.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Echo correlation ID if provided
  const correlationId = req.headers['x-correlation-id'];
  if (correlationId) {
    res.setHeader('X-Correlation-ID', correlationId);
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { flow_type, step_name, step_order, metadata = {} } = req.body;

    // Validate required fields
    if (!flow_type || !step_name || step_order === undefined) {
      console.warn('[log-event] Missing required fields', { flow_type, step_name, step_order });
      return res.status(400).json({ 
        error: 'Missing required fields: flow_type, step_name, step_order' 
      });
    }

    // Prepare insert body
    const body = {
      flow_type,
      step_name,
      step_order,
      is_completion: metadata.is_completion || false,
      payment_intent_id: metadata.payment_intent_id || null,
      metadata: metadata || {}
    };

    // Insert via Supabase REST API
    const url = `${supabaseConfig.url}/rest/v1/funnel_events`;
    const response = await httpClient(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(body)
    }, correlationId);

    console.log(`[log-event] [${correlationId || 'no-id'}] Event logged: ${flow_type}/${step_name} (step ${step_order})`);

    return res.status(201).json({ ok: true });

  } catch (err) {
    console.error('[log-event] Error:', err);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: err.message 
    });
  }
}
