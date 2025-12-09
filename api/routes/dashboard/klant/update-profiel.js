// api/routes/dashboard/klant/update-profiel.js
/**
 * Update klant profiel (voornaam + achternaam)
 * 
 * PATCH /api/routes/dashboard/klant/update-profiel
 * 
 * Body:
 * - voornaam: string
 * - achternaam: string
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

  const correlationId = req.headers['x-correlation-id'] || `update-profiel-${Date.now()}`;
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

    const { voornaam, achternaam } = req.body;

    // Validatie
    if (!voornaam || !achternaam) {
      return res.status(400).json({
        correlationId,
        message: 'Voornaam en achternaam zijn verplicht'
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
          voornaam: voornaam.trim(),
          achternaam: achternaam.trim()
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        route: 'dashboard/klant/update-profiel',
        action: 'update_failed',
        error: errorText
      }));
      throw new Error('Kon profiel niet bijwerken');
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/update-profiel',
      action: 'profile_updated',
      userId: user.id
    }));

    return res.status(200).json({
      correlationId,
      message: 'Profiel bijgewerkt',
      success: true
    });

  } catch (error) {
    return handleErrorResponse(error, res, correlationId);
  }
}
