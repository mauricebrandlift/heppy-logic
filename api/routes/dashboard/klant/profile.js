// api/routes/dashboard/klant/profile.js
/**
 * Get klant profiel data
 * 
 * GET /api/dashboard/klant/profile
 * 
 * Returns:
 * - email (from user_profiles table)
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

    // Verify user via auth check (returns { id, email, role, profile })
    const authData = await verifyAuth(token);

    if (!authData || !authData.profile) {
      return res.status(401).json({ correlationId, message: 'Ongeldige authenticatie' });
    }

    const { profile } = authData;

    // Haal adres data op als er een adres_id is
    let adresData = null;
    if (profile.adres_id) {
      const adresResponse = await httpClient(
        `${supabaseConfig.url}/rest/v1/adressen?id=eq.${profile.adres_id}&select=postcode,huisnummer,toevoeging,straat,plaats`,
        {
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (adresResponse.ok) {
        const adressen = await adresResponse.json();
        if (adressen && adressen.length > 0) {
          adresData = adressen[0];
        }
      }
    }

    console.log('✅ [Profile API] Profiel data opgehaald voor user:', authData.id);

    // Return profiel data met adres info
    return res.status(200).json({
      email: profile.email, // Email from database (user_profiles table)
      voornaam: profile.voornaam,
      achternaam: profile.achternaam,
      telefoon: profile.telefoon,
      postcode: adresData?.postcode || null,
      huisnummer: adresData?.huisnummer || null,
      toevoeging: adresData?.toevoeging || null,
      straatnaam: adresData?.straat || null, // Match HTML field name
      plaatsnaam: adresData?.plaats || null  // Match HTML field name
    });

  } catch (error) {
    console.error('❌ [Profile API] Error:', error);
    return handleErrorResponse(error, res, correlationId);
  }
}
