// api/routes/dashboard/klant/update-adres.js
/**
 * Update klant adres
 * 
 * PATCH /api/routes/dashboard/klant/update-adres
 * 
 * Body:
 * - postcode: string
 * - huisnummer: string
 * - toevoeging: string (optional)
 * - straat: string
 * - plaats: string
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

  const correlationId = req.headers['x-correlation-id'] || `update-adres-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH, OPTIONS');
    return res.status(405).json({ correlationId, message: 'Method not allowed' });
  }

  try {
    const user = await verifyAuthToken(req, res);
    if (!user) return;

    const { postcode, huisnummer, toevoeging, straat, plaats } = req.body;

    // Validatie
    if (!postcode || !huisnummer || !straat || !plaats) {
      return res.status(400).json({
        correlationId,
        message: 'Postcode, huisnummer, straat en plaats zijn verplicht'
      });
    }

    // Haal huidige user profiel op voor adres_id
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

    const profiles = await profileResponse.json();
    const currentProfile = profiles[0];
    const adresId = currentProfile?.adres_id;

    const adresData = {
      postcode: postcode.trim().toUpperCase().replace(/\s/g, ''),
      huisnummer: huisnummer.trim(),
      toevoeging: toevoeging ? toevoeging.trim() : null,
      straat: straat.trim(),
      plaats: plaats.trim()
    };

    if (adresId) {
      // Update bestaand adres
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
        const errorText = await updateResponse.text();
        console.error(JSON.stringify({
          level: 'ERROR',
          correlationId,
          route: 'dashboard/klant/update-adres',
          action: 'update_failed',
          error: errorText
        }));
        throw new Error('Kon adres niet bijwerken');
      }

      console.log(JSON.stringify({
        level: 'INFO',
        correlationId,
        route: 'dashboard/klant/update-adres',
        action: 'adres_updated',
        userId: user.id,
        adresId
      }));

    } else {
      // Maak nieuw adres aan
      const createResponse = await httpClient(
        `${supabaseConfig.url}/rest/v1/adressen`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(adresData)
        }
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error(JSON.stringify({
          level: 'ERROR',
          correlationId,
          route: 'dashboard/klant/update-adres',
          action: 'create_failed',
          error: errorText
        }));
        throw new Error('Kon adres niet aanmaken');
      }

      const newAdres = (await createResponse.json())[0];

      // Link nieuw adres aan user profiel
      const linkResponse = await httpClient(
        `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${user.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
          },
          body: JSON.stringify({ adres_id: newAdres.id })
        }
      );

      if (!linkResponse.ok) {
        const errorText = await linkResponse.text();
        console.error(JSON.stringify({
          level: 'ERROR',
          correlationId,
          route: 'dashboard/klant/update-adres',
          action: 'link_failed',
          error: errorText
        }));
        throw new Error('Kon adres niet koppelen aan profiel');
      }

      console.log(JSON.stringify({
        level: 'INFO',
        correlationId,
        route: 'dashboard/klant/update-adres',
        action: 'adres_created_and_linked',
        userId: user.id,
        adresId: newAdres.id
      }));
    }

    return res.status(200).json({
      correlationId,
      message: 'Adres bijgewerkt',
      success: true
    });

  } catch (error) {
    return handleErrorResponse(error, res, correlationId);
  }
}
