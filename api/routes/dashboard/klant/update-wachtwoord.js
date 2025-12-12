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
import { verifyAuth } from '../../../checks/authCheck.js';
import { logAudit } from '../../../services/auditService.js';
import { sendEmail } from '../../../services/emailService.js';

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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ correlationId, message: 'Authenticatie vereist' });
    }
    const token = authHeader.split(' ')[1];
    const user = await verifyAuth(token);

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

    // Haal huidige profiel op voor email
    const profileResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${user.id}&select=voornaam,achternaam`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }
    );

    if (!profileResponse.ok) {
      throw new Error('Kon profiel niet ophalen');
    }

    const profiles = await profileResponse.json();
    if (!profiles || profiles.length === 0) {
      throw new Error('Profiel niet gevonden');
    }

    const currentProfile = profiles[0];

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

    // Extract IP en user agent voor audit (GEEN wachtwoord waarden)
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                      req.headers['x-real-ip'] ||
                      req.connection?.remoteAddress ||
                      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Log audit - ZONDER wachtwoord waarden (security)
    await logAudit({
      userId: user.id,
      action: 'wachtwoord_gewijzigd',
      entityType: 'auth_user',
      entityId: user.id,
      oldValues: null, // Geen wachtwoord waarden loggen
      newValues: null, // Geen wachtwoord waarden loggen
      ipAddress,
      userAgent,
      correlationId
    });

    // Invalideer alle sessies behalve huidige (security)
    // Haal eerst huidige sessie ID op (via token)
    const currentSessionId = token.substring(0, 32); // Simplified - in productie via JWT decode
    
    try {
      const deleteSessionsResponse = await httpClient(
        `${supabaseConfig.url}/rest/v1/user_sessies?user_id=eq.${user.id}&session_token=not.eq.${currentSessionId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
          }
        }
      );

      if (deleteSessionsResponse.ok) {
        console.log(JSON.stringify({
          level: 'INFO',
          correlationId,
          route: 'dashboard/klant/update-wachtwoord',
          action: 'sessions_invalidated',
          userId: user.id
        }));
      }
    } catch (sessionError) {
      console.error('Session invalidatie error (niet-kritisch):', sessionError);
      // Continue - session invalidatie is nice-to-have
    }

    // Stuur beveiligings-email naar klant
    const { wachtwoordGewijzigd } = await import('../../../templates/emails/wachtwoord-gewijzigd.js');
    try {
      await sendEmail({
        to: user.email,
        subject: 'Je wachtwoord is gewijzigd',
        html: wachtwoordGewijzigd({
          voornaam: currentProfile.voornaam
        }),
        from: 'info@mail.heppy-schoonmaak.nl'
      });
    } catch (emailError) {
      console.error('Klant email error:', emailError);
      // Continue - email failure shouldn't block the update
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
