// api/routes/dashboard/klant/update-wachtwoord.js
/**
 * Update klant wachtwoord
 * 
 * PATCH /api/routes/dashboard/klant/update-wachtwoord
 * 
 * Body:
 * - huidigWachtwoord: string
 * - nieuwWachtwoord: string
 * 
 * Note: Gebruikt Supabase Auth Admin API
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { handleErrorResponse } from '../../../utils/errorHandler.js';
import { verifyAuthToken } from '../../../utils/authMiddleware.js';

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
    const user = await verifyAuthToken(req, res);
    if (!user) return;

    const { huidigWachtwoord, nieuwWachtwoord } = req.body;

    // Validatie
    if (!huidigWachtwoord || !nieuwWachtwoord) {
      return res.status(400).json({
        correlationId,
        message: 'Huidig en nieuw wachtwoord zijn verplicht'
      });
    }

    if (nieuwWachtwoord.length < 8) {
      return res.status(400).json({
        correlationId,
        message: 'Nieuw wachtwoord moet minimaal 8 tekens zijn'
      });
    }

    // Eerst verificatie van huidig wachtwoord via Supabase Auth
    const verifyResponse = await httpClient(
      `${supabaseConfig.url}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey
        },
        body: JSON.stringify({
          email: user.email,
          password: huidigWachtwoord
        })
      }
    );

    if (!verifyResponse.ok) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/update-wachtwoord',
        action: 'current_password_invalid',
        userId: user.id
      }));
      
      return res.status(401).json({
        correlationId,
        message: 'Huidig wachtwoord is onjuist'
      });
    }

    // Update wachtwoord via Admin API
    const updateResponse = await httpClient(
      `${supabaseConfig.url}/auth/v1/admin/users/${user.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        },
        body: JSON.stringify({
          password: nieuwWachtwoord
        })
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        route: 'dashboard/klant/update-wachtwoord',
        action: 'password_update_failed',
        error: errorText
      }));
      throw new Error('Kon wachtwoord niet bijwerken');
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/update-wachtwoord',
      action: 'password_updated',
      userId: user.id
    }));

    return res.status(200).json({
      correlationId,
      message: 'Wachtwoord succesvol gewijzigd',
      success: true
    });

  } catch (error) {
    return handleErrorResponse(error, res, correlationId);
  }
}
