// api/routes/dashboard/klant/profiel.js
/**
 * Haal klant profiel op
 * 
 * GET /api/routes/dashboard/klant/profiel
 * 
 * Returns:
 * - voornaam, achternaam, email, telefoon
 * - adres object (postcode, huisnummer, toevoeging, straat, plaats)
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { handleErrorResponse } from '../../../utils/errorHandler.js';
import { verifyAuthToken } from '../../../utils/authMiddleware.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const correlationId = req.headers['x-correlation-id'] || `profiel-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ correlationId, message: 'Method not allowed' });
  }

  try {
    // Verificatie auth token
    const user = await verifyAuthToken(req, res);
    if (!user) return;

    // Haal user profiel op met adres
    const response = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${user.id}&select=id,voornaam,achternaam,email,telefoon,adres_id,adres:adressen(postcode,huisnummer,toevoeging,straat,plaats)`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        route: 'dashboard/klant/profiel',
        action: 'fetch_failed',
        error: errorText
      }));
      throw new Error('Kon profiel niet ophalen');
    }

    const profiles = await response.json();
    const profile = profiles[0];

    if (!profile) {
      throw new Error('Profiel niet gevonden');
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/profiel',
      action: 'profile_fetched',
      userId: user.id
    }));

    return res.status(200).json({
      correlationId,
      voornaam: profile.voornaam,
      achternaam: profile.achternaam,
      email: profile.email,
      telefoon: profile.telefoon,
      adres: profile.adres || null
    });

  } catch (error) {
    return handleErrorResponse(error, res, correlationId);
  }
}
