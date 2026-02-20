// api/routes/dashboard/schoonmaker/update-profiel.js
/**
 * Update schoonmaker profiel (voornaam + achternaam)
 * 
 * PATCH /api/routes/dashboard/schoonmaker/update-profiel
 * 
 * Body:
 * - voornaam: string
 * - achternaam: string
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { handleErrorResponse } from '../../../utils/errorHandler.js';
import { verifyAuth } from '../../../checks/authCheck.js';
import { logAudit } from '../../../services/auditService.js';

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

    // Naam format validatie
    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
    if (!nameRegex.test(voornaam) || !nameRegex.test(achternaam)) {
      return res.status(400).json({
        correlationId,
        message: 'Naam mag alleen letters, spaties, koppeltekens en apostrofs bevatten'
      });
    }

    if (voornaam.trim().length < 2 || achternaam.trim().length < 2) {
      return res.status(400).json({
        correlationId,
        message: 'Voor- en achternaam moeten minimaal 2 karakters bevatten'
      });
    }

    // Haal oude waarden op voor audit log
    const oldProfileResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${user.id}&select=voornaam,achternaam,email`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }
    );

    const oldProfile = (await oldProfileResponse.json())[0];
    if (!oldProfile) {
      throw new Error('Profiel niet gevonden');
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
        route: 'dashboard/schoonmaker/update-profiel',
        action: 'update_failed',
        error: errorText
      }));
      throw new Error('Kon profiel niet bijwerken');
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/schoonmaker/update-profiel',
      action: 'profile_updated',
      userId: user.id
    }));

    // Audit log opslaan
    const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    await logAudit({
      userId: user.id,
      action: 'update_profiel',
      entityType: 'user_profiles',
      entityId: user.id,
      oldValues: {
        voornaam: oldProfile.voornaam,
        achternaam: oldProfile.achternaam
      },
      newValues: {
        voornaam: voornaam.trim(),
        achternaam: achternaam.trim()
      },
      ipAddress,
      userAgent
    });

    return res.status(200).json({
      success: true,
      message: 'Profiel succesvol bijgewerkt'
    });

  } catch (error) {
    console.error('❌ [Update Profiel] Error:', error);
    return handleErrorResponse(error, res, correlationId);
  }
}
