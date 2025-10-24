/**
 * Simplified Funnel Event Logger
 * 
 * POST /api/routes/tracking/log-event
 * 
 * Logs one record per step completion to funnel_events table.
 * No session management, just simple INSERT operations.
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { flow_type, step_name, step_order, metadata = {} } = req.body;

    // Validate required fields
    if (!flow_type || !step_name || step_order === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: flow_type, step_name, step_order' 
      });
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Insert event record
    const { error } = await supabase
      .from('funnel_events')
      .insert({
        flow_type,
        step_name,
        step_order,
        is_completion: metadata.is_completion || false,
        payment_intent_id: metadata.payment_intent_id || null,
        metadata: metadata || {}
      });

    if (error) {
      console.error('Failed to insert funnel event:', error);
      return res.status(500).json({ 
        error: 'Failed to log event',
        details: error.message 
      });
    }

    return res.status(201).json({ ok: true });

  } catch (err) {
    console.error('Tracking endpoint error:', err);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: err.message 
    });
  }
}
