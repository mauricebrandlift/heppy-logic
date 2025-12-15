// api/routes/dashboard/klant/profile.js
/**
 * Get klant profiel data
 * 
 * GET /api/dashboard/klant/profile
 * 
 * Returns:
 * - voornaam, achternaam
 * - telefoon
 * - postcode, huisnummer, toevoeging, straat, plaats
 * 
 * Note: Voor alleen auth verificatie, gebruik /auth/me
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { handleErrorResponse } from '../../../utils/errorHandler.js';
import { verifyAuth } from '../../../checks/authCheck.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const correlationId = req.headers['x-correlation-id'] || `profile-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ correlationId, message: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ correlationId, message: 'Authenticatie vereist' });
    }

    const token = authHeader.split(' ')[1];

    // Verify user via auth check
    const { user, profile } = await verifyAuth(token);

    if (!user || !profile) {
      return res.status(401).json({ correlationId, message: 'Ongeldige authenticatie' });
    }

    console.log('✅ [Profile API] Profiel data opgehaald voor user:', user.id);

    // Return profiel data
    return res.status(200).json({
      voornaam: profile.voornaam,
      achternaam: profile.achternaam,
      telefoon: profile.telefoon,
      postcode: profile.postcode,
      huisnummer: profile.huisnummer,
      toevoeging: profile.toevoeging,
      straat: profile.straat,
      plaats: profile.plaats
    });

  } catch (error) {
    console.error('❌ [Profile API] Error:', error);
    return handleErrorResponse(res, error, correlationId);
  }
}
