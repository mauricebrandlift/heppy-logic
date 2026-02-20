// api/routes/dashboard/schoonmaker/update-wachtwoord.js
/**
 * Update schoonmaker wachtwoord
 * 
 * PATCH /api/routes/dashboard/schoonmaker/update-wachtwoord
 * 
 * Body:
 * - huidig_wachtwoord: string
 * - nieuw_wachtwoord: string
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

  const correlationId = req.headers['x-correlation-id'] || `update-wachtwoord-${Date.now()}`;
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

    const { huidig_wachtwoord, nieuw_wachtwoord } = req.body;

    // Validatie
    if (!huidig_wachtwoord || !nieuw_wachtwoord) {
      return res.status(400).json({
        correlationId,
        message: 'Huidig en nieuw wachtwoord zijn verplicht'
      });
    }

    if (nieuw_wachtwoord.length < 8) {
      return res.status(400).json({
        correlationId,
        message: 'Nieuw wachtwoord moet minimaal 8 karakters bevatten'
      });
    }

    // Verify huidiige wachtwoord via Supabase Auth refresh
    const verifyResponse = await httpClient(
      `${supabaseConfig.url}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apikey': supabaseConfig.anonKey
        },
        body: `email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(huidig_wachtwoord)}`
      }
    );

    if (!verifyResponse.ok) {
      return res.status(401).json({
        correlationId,
        message: 'Huidig wachtwoord is onjuist'
      });
    }

    // Update wachtwoord
    const updateResponse = await httpClient(
      `${supabaseConfig.url}/auth/v1/admin/users/${user.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        },
        body: JSON.stringify({ password: nieuw_wachtwoord })
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        route: 'dashboard/schoonmaker/update-wachtwoord',
        action: 'password_update_failed',
        error: errorText
      }));
      throw new Error('Kon wachtwoord niet bijwerken');
    }

    console.log('✅ [Update Wachtwoord] Wachtwoord bijgewerkt voor user:', user.id);

    return res.status(200).json({
      success: true,
      message: 'Wachtwoord succesvol gewijzigd'
    });

  } catch (error) {
    console.error('❌ [Update Wachtwoord] Error:', error);
    return handleErrorResponse(error, res, correlationId);
  }
}
