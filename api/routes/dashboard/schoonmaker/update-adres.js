// api/routes/dashboard/schoonmaker/update-adres.js
/**
 * Update schoonmaker adres
 * 
 * PATCH /api/routes/dashboard/schoonmaker/update-adres
 * 
 * Body:
 * - straatnaam: string
 * - huisnummer: string
 * - toevoeging: string (optional)
 * - postcode: string
 * - plaats: string
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

  const correlationId = req.headers['x-correlation-id'] || `update-adres-${Date.now()}`;
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

    const { straatnaam, huisnummer, toevoeging, postcode, plaats } = req.body;

    // Validatie
    if (!straatnaam || !huisnummer || !postcode || !plaats) {
      return res.status(400).json({
        correlationId,
        message: 'Straat, huisnummer, postcode en plaats zijn verplicht'
      });
    }

    // Haal huidige profiel op
    const profileResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${user.id}&select=adres_id`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }
    );

    const profileData = (await profileResponse.json())[0];
    const adresId = profileData?.adres_id;

    const adresData = {
      straat: straatnaam.trim(),
      huisnummer: huisnummer.trim(),
      toevoeging: toevoeging ? toevoeging.trim() : null,
      postcode: postcode.trim().toUpperCase(),
      plaats: plaats.trim()
    };

    let updatedAdresId = adresId;

    if (adresId) {
      // Update existing address
      const updateResponse = await httpClient(
        `${supabaseConfig.url}/rest/v1/adressen?id=eq.${adresId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
          },
          body: JSON.stringify(adresData)
        }
      );

      if (!updateResponse.ok) {
        throw new Error('Kon adres niet bijwerken');
      }
    } else {
      // Create new address
      const createResponse = await httpClient(
        `${supabaseConfig.url}/rest/v1/adressen`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
          },
          body: JSON.stringify(adresData)
        }
      );

      if (!createResponse.ok) {
        throw new Error('Kon adres niet aanmaken');
      }

      const newAddresses = await createResponse.json();
      updatedAdresId = newAddresses[0].id;
    }

    // Update profiel met adres_id
    const profileUpdateResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${user.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        },
        body: JSON.stringify({ adres_id: updatedAdresId })
      }
    );

    if (!profileUpdateResponse.ok) {
      throw new Error('Kon profiel niet bijwerken met adres');
    }

    console.log('✅ [Update Adres] Adres bijgewerkt voor user:', user.id);

    return res.status(200).json({
      success: true,
      message: 'Adres succesvol bijgewerkt'
    });

  } catch (error) {
    console.error('❌ [Update Adres] Error:', error);
    return handleErrorResponse(error, res, correlationId);
  }
}
