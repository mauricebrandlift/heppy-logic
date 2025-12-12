// api/routes/dashboard/klant/verify-email-change.js
/**
 * Verify email change (stap 2 van 2)
 * 
 * GET/POST /api/routes/dashboard/klant/verify-email-change?token=xxx
 * 
 * Flow:
 * 1. Valideer token (bestaat, niet expired, niet al gebruikt)
 * 2. Update user_profiles.email
 * 3. Update auth.users.email (Supabase Auth)
 * 4. Mark token als geverifieerd
 * 5. Check actief abonnement voor schoonmaker notificatie
 * 6. Stuur bevestiging naar OUDE email
 * 7. Stuur bevestiging naar NIEUWE email
 * 8. Notificeer schoonmakers (indien actief abonnement)
 * 9. Log audit trail
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { handleErrorResponse } from '../../../utils/errorHandler.js';
import { logAudit } from '../../../services/auditService.js';
import { sendEmail } from '../../../services/emailService.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const correlationId = req.headers['x-correlation-id'] || `verify-email-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ correlationId, message: 'Method not allowed' });
  }

  try {
    // Token uit query string
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        correlationId,
        message: 'Verificatie token ontbreekt',
        success: false
      });
    }

    // Haal token op uit database
    const tokenResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/email_verificatie_tokens?token=eq.${token}&select=*`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }
    );

    const tokens = await tokenResponse.json();
    if (!tokens || tokens.length === 0) {
      return res.status(404).json({
        correlationId,
        message: 'Ongeldige verificatie link',
        success: false,
        error: 'TOKEN_NOT_FOUND'
      });
    }

    const tokenData = tokens[0];

    // Check of token al gebruikt is
    if (tokenData.geverifieerd) {
      return res.status(400).json({
        correlationId,
        message: 'Deze verificatie link is al gebruikt',
        success: false,
        error: 'TOKEN_ALREADY_USED'
      });
    }

    // Check of token expired is
    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);
    if (now > expiresAt) {
      return res.status(400).json({
        correlationId,
        message: 'Verificatie link is verlopen. Vraag een nieuwe email wijziging aan.',
        success: false,
        error: 'TOKEN_EXPIRED'
      });
    }

    const userId = tokenData.user_id;
    const oudEmail = tokenData.oud_email;
    const nieuwEmail = tokenData.nieuw_email;

    // Haal user profiel op
    const profileResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${userId}&select=voornaam,achternaam`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }
    );

    const profiles = await profileResponse.json();
    if (!profiles || profiles.length === 0) {
      return res.status(404).json({ correlationId, message: 'Profiel niet gevonden' });
    }

    const userProfile = profiles[0];

    // Update user_profiles.email
    const updateProfileResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          email: nieuwEmail
        })
      }
    );

    if (!updateProfileResponse.ok) {
      const errorText = await updateProfileResponse.text();
      throw new Error(`Profiel update mislukt: ${errorText}`);
    }

    // Update auth.users.email via Supabase Admin API
    const updateAuthResponse = await httpClient(
      `${supabaseConfig.url}/auth/v1/admin/users/${userId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        },
        body: JSON.stringify({
          email: nieuwEmail
        })
      }
    );

    if (!updateAuthResponse.ok) {
      const errorText = await updateAuthResponse.text();
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        message: 'Auth user update failed',
        error: errorText
      }));
      // Continue - profiel is al geupdate
    }

    // Mark token als geverifieerd
    await httpClient(
      `${supabaseConfig.url}/rest/v1/email_verificatie_tokens?id=eq.${tokenData.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          geverifieerd: true,
          geverifieerd_op: new Date().toISOString()
        })
      }
    );

    // Extract IP en User Agent
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0].trim() 
                   || req.headers['x-real-ip'] 
                   || req.connection?.remoteAddress 
                   || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Audit log
    await logAudit({
      userId,
      action: 'verify_email_change',
      entityType: 'user_profiles',
      entityId: userId,
      oldValues: { email: oudEmail },
      newValues: { email: nieuwEmail },
      ipAddress,
      userAgent,
      correlationId
    });

    // Check actief abonnement
    const abonnementenResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/abonnementen?user_id=eq.${userId}&status=eq.actief&select=id,schoonmaker_id,schoonmakers(voornaam,achternaam,email)`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }
    );

    const abonnementen = await abonnementenResponse.json();
    const heeftActiefAbonnement = Array.isArray(abonnementen) && abonnementen.length > 0;

    // Email naar OUDE adres (bevestiging)
    await sendEmail({
      to: oudEmail,
      subject: 'Je email is gewijzigd',
      template: 'email-gewijzigd-bevestiging-oud',
      data: {
        voornaam: userProfile.voornaam,
        oudEmail,
        nieuwEmail
      }
    }, correlationId);

    // Email naar NIEUWE adres (bevestiging)
    await sendEmail({
      to: nieuwEmail,
      subject: 'Je email is gewijzigd',
      template: 'email-gewijzigd-bevestiging-nieuw',
      data: {
        voornaam: userProfile.voornaam,
        nieuwEmail
      }
    }, correlationId);

    // Notificeer schoonmakers bij actief abonnement
    if (heeftActiefAbonnement) {
      for (const abo of abonnementen) {
        if (abo.schoonmakers?.email) {
          await sendEmail({
            to: abo.schoonmakers.email,
            subject: 'Email klant gewijzigd',
            template: 'schoonmaker-klant-email-gewijzigd',
            data: {
              schoonmakerNaam: abo.schoonmakers.voornaam,
              klantNaam: `${userProfile.voornaam} ${userProfile.achternaam}`,
              oudEmail,
              nieuwEmail,
              abonnementId: abo.id
            }
          }, correlationId);
        }
      }
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/verify-email-change',
      action: 'email_changed',
      userId,
      oudEmail,
      nieuwEmail,
      schoonmakerGenotificeerd: heeftActiefAbonnement
    }));

    // API response (JSON)
    return res.status(200).json({
      correlationId,
      message: 'Email succesvol gewijzigd',
      success: true,
      nieuwEmail,
      schoonmakerGenotificeerd: heeftActiefAbonnement
    });

  } catch (error) {
    // API error response (JSON)
    return handleErrorResponse(error, res, correlationId);
  }
}
