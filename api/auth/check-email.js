// api/auth/check-email.js
/**
 * Check Email Availability Endpoint
 * Checkt of een email al bestaat in user_profiles
 */

import { supabase } from '../config/index.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const correlationId = req.headers['x-correlation-id'] || `check-email-${Date.now()}`;

  try {
    const { email } = req.query;

    if (!email) {
      console.warn(`[CheckEmail] Missing email parameter [${correlationId}]`);
      return res.status(400).json({ 
        message: 'Email parameter is required',
        correlationId 
      });
    }

    console.log(`[CheckEmail] Checking email: ${email} [${correlationId}]`);

    // Check in user_profiles
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, emailadres')
      .eq('emailadres', email.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      console.error(`[CheckEmail] Database error [${correlationId}]`, error);
      return res.status(500).json({ 
        message: 'Database error',
        correlationId 
      });
    }

    const exists = !!data;
    console.log(`[CheckEmail] Email ${email}: ${exists ? 'EXISTS' : 'available'} [${correlationId}]`);

    return res.status(200).json({
      exists,
      email,
      correlationId
    });

  } catch (error) {
    console.error(`[CheckEmail] Unexpected error [${correlationId}]`, error);
    return res.status(500).json({ 
      message: 'Internal server error',
      correlationId 
    });
  }
}
