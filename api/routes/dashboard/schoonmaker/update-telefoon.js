// api/routes/dashboard/schoonmaker/update-telefoon.js
/**
 * Update schoonmaker telefoon
 * 
 * PATCH /api/routes/dashboard/schoonmaker/update-telefoon
 * 
 * Body:
 * - telefoon: string
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

  const correlationId = req.headers['x-correlation-id'] || `update-telefoon-${Date.now()}`;
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

    const { telefoon } = req.body;

    // Validatie
    if (!telefoon) {
      return res.status(400).json({
        correlationId,
        message: 'Telefoonnummer is verplicht'
      });
    }

    // Telefoon format validatie
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(telefoon)) {
      return res.status(400).json({
        correlationId,
        message: 'Telefoonnummer bevat ongeldige karakters'
      });
    }

    // Update in user_profiles
    const response = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${user.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        },
        body: JSON.stringify({ telefoon: telefoon.trim() })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        route: 'dashboard/schoonmaker/update-telefoon',
        action: 'update_failed',
        error: errorText
      }));
      throw new Error('Kon telefoonnummer niet bijwerken');
    }

    console.log('✅ [Update Telefoon] Telefoon bijgewerkt voor user:', user.id);

    return res.status(200).json({
      success: true,
      message: 'Telefoonnummer succesvol bijgewerkt'
    });

  } catch (error) {
    console.error('❌ [Update Telefoon] Error:', error);
    return handleErrorResponse(error, res, correlationId);
  }
}
