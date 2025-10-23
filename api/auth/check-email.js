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

    console.log(`📧 [CheckEmail] ========== REQUEST ========== [${correlationId}]`);
    console.log(`📧 [CheckEmail] Query params:`, req.query);
    console.log(`📧 [CheckEmail] Email value:`, email);

    if (!email) {
      console.warn(`❌ [CheckEmail] Missing email parameter [${correlationId}]`);
      return res.status(400).json({ 
        message: 'Email parameter is required',
        correlationId 
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`🔍 [CheckEmail] Normalized email: "${normalizedEmail}" [${correlationId}]`);
    console.log(`🔍 [CheckEmail] Querying user_profiles table... [${correlationId}]`);

    // Check in user_profiles
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, emailadres')
      .eq('emailadres', normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error(`❌ [CheckEmail] Database error [${correlationId}]`, {
        error: error.message,
        code: error.code,
        details: error.details
      });
      return res.status(500).json({ 
        message: 'Database error',
        error: error.message,
        correlationId 
      });
    }

    console.log(`📊 [CheckEmail] Query result [${correlationId}]:`, {
      found: !!data,
      userId: data?.id || null,
      emailInDb: data?.emailadres || null
    });

    const exists = !!data;
    const resultMessage = exists ? '⚠️ EXISTS (email in use)' : '✅ AVAILABLE';
    console.log(`${resultMessage} [CheckEmail] Email "${normalizedEmail}": ${exists} [${correlationId}]`);

    return res.status(200).json({
      exists,
      email: normalizedEmail,
      correlationId
    });

  } catch (error) {
    console.error(`🔥 [CheckEmail] ========== UNEXPECTED ERROR ========== [${correlationId}]`);
    console.error(`🔥 [CheckEmail] Error message:`, error.message);
    console.error(`🔥 [CheckEmail] Stack:`, error.stack);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error.message,
      correlationId 
    });
  }
}
