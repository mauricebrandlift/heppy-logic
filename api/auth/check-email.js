// api/auth/check-email.js
/**
 * Check Email Availability Endpoint
 * Checkt of een email al bestaat in auth.users OF user_profiles
 */

import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';
import { findAuthUserByEmail } from '../services/authService.js';

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
    
    // Check 1: Auth users (via Service Role Key)
    console.log(`🔍 [CheckEmail] Checking auth.users... [${correlationId}]`);
    try {
      const authUser = await findAuthUserByEmail(normalizedEmail, correlationId);
      if (authUser) {
        console.log(`⚠️ EXISTS [CheckEmail] Email found in auth.users: ${authUser.id} [${correlationId}]`);
        return res.status(200).json({
          exists: true,
          source: 'auth.users',
          email: normalizedEmail,
          correlationId
        });
      }
    } catch (authError) {
      console.error(`⚠️ [CheckEmail] Auth check failed, continuing to user_profiles [${correlationId}]`, authError.message);
      // Continue to user_profiles check
    }
    
    // Check 2: User profiles (fallback)
    console.log(`🔍 [CheckEmail] Checking user_profiles table... [${correlationId}]`);
    const url = `${supabaseConfig.url}/rest/v1/user_profiles?emailadres=eq.${encodeURIComponent(normalizedEmail)}&select=id,emailadres`;
    const resp = await httpClient(url, { 
      headers:{ 
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}` 
      } 
    }, correlationId);

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error(`❌ [CheckEmail] Database error [${correlationId}]`, {
        status: resp.status,
        error: errorText
      });
      return res.status(500).json({ 
        message: 'Database error',
        error: errorText,
        correlationId 
      });
    }

    const data = await resp.json();
    console.log(`📊 [CheckEmail] Query result [${correlationId}]:`, {
      found: data.length > 0,
      count: data.length
    });

    const exists = data.length > 0;
    const resultMessage = exists ? '⚠️ EXISTS (email in use)' : '✅ AVAILABLE';
    console.log(`${resultMessage} [CheckEmail] Email "${normalizedEmail}": ${exists} [${correlationId}]`);

    return res.status(200).json({
      exists,
      source: exists ? 'user_profiles' : null,
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
