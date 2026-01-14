// api/routes/dashboard/klant/update-email.js
/**
 * Update klant email adres
 * 
 * PATCH /api/routes/dashboard/klant/update-email
 * 
 * Body:
 * - email: string
 * 
 * Note: Dit update zowel user_profiles als Supabase Auth
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { handleErrorResponse } from '../../../utils/errorHandler.js';
import { verifyAuth } from '../../../checks/authCheck.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const correlationId = req.headers['x-correlation-id'] || `update-email-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH, OPTIONS');
    return res.status(405).json({ correlationId, message: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ correlationId, message: 'Authenticatie vereist' });
    }
    const token = authHeader.split(' ')[1];
    const user = await verifyAuth(token);

    const { email } = req.body;

    // Validatie
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        correlationId,
        message: 'Geldig e-mailadres is verplicht'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Update in user_profiles
    const profileResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${user.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        },
        body: JSON.stringify({ email: cleanEmail })
      }
    );

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        route: 'dashboard/klant/update-email',
        action: 'profile_update_failed',
        error: errorText
      }));
      throw new Error('Kon email niet bijwerken in profiel');
    }

    // Update in Supabase Auth
    const authResponse = await httpClient(
      `${supabaseConfig.url}/auth/v1/admin/users/${user.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        },
        body: JSON.stringify({
          email: cleanEmail,
          email_confirm: false // Vereist email bevestiging
        })
      }
    );

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/update-email',
        action: 'auth_update_failed',
        error: errorText
      }));
      // Continue - profile is updated, auth update is secondary
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/update-email',
      action: 'email_updated',
      userId: user.id
    }));

    return res.status(200).json({
      correlationId,
      message: 'E-mailadres bijgewerkt. Controleer je inbox voor bevestiging.',
      success: true
    });

  } catch (error) {
    return handleErrorResponse(error, res, correlationId);
  }
}
