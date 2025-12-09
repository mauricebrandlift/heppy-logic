// api/routes/dashboard/klant/update-telefoon.js
/**
 * Update klant telefoonnummer
 * 
 * PATCH /api/routes/dashboard/klant/update-telefoon
 * 
 * Body:
 * - telefoon: string
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

  const correlationId = req.headers['x-correlation-id'] || `update-telefoon-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH, OPTIONS');
    return res.status(405).json({ correlationId, message: 'Method not allowed' });
  }

  try {
    const user = await verifyAuthToken(req, res);
    if (!user) return;

    const { telefoon } = req.body;

    // Validatie
    if (!telefoon || telefoon.length < 10) {
      return res.status(400).json({
        correlationId,
        message: 'Geldig telefoonnummer is verplicht'
      });
    }

    // Update profiel
    const response = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${user.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        },
        body: JSON.stringify({
          telefoon: telefoon.trim()
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        route: 'dashboard/klant/update-telefoon',
        action: 'update_failed',
        error: errorText
      }));
      throw new Error('Kon telefoonnummer niet bijwerken');
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/update-telefoon',
      action: 'telefoon_updated',
      userId: user.id
    }));

    return res.status(200).json({
      correlationId,
      message: 'Telefoonnummer bijgewerkt',
      success: true
    });

  } catch (error) {
    return handleErrorResponse(error, res, correlationId);
  }
}
