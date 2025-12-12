// api/routes/dashboard/klant/request-email-change.js
/**
 * Request email change (stap 1 van 2)
 * 
 * POST /api/routes/dashboard/klant/request-email-change
 * 
 * Body:
 * - nieuwEmail: string
 * 
 * Flow:
 * 1. Valideer nieuwe email format
 * 2. Check of nieuwe email al in gebruik is
 * 3. Genereer verificatie token (24u geldig)
 * 4. Invalideer oude tokens voor deze user
 * 5. Sla token op in email_verificatie_tokens
 * 6. Stuur email naar OUDE adres (notificatie)
 * 7. Stuur email naar NIEUWE adres (verificatie link)
 * 8. Log audit trail
 */

import crypto from 'crypto';
import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { handleErrorResponse } from '../../../utils/errorHandler.js';
import { verifyAuth } from '../../../checks/authCheck.js';
import { logAudit } from '../../../services/auditService.js';
import { sendEmail } from '../../../services/emailService.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const correlationId = req.headers['x-correlation-id'] || `request-email-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ correlationId, message: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ correlationId, message: 'Authenticatie vereist' });
    }
    const token = authHeader.split(' ')[1];
    const user = await verifyAuth(token);

    const { nieuwEmail } = req.body;

    // Validatie
    if (!nieuwEmail) {
      return res.status(400).json({
        correlationId,
        message: 'Nieuw email adres is verplicht',
        errors: { nieuwEmail: 'Dit veld is verplicht' }
      });
    }

    // Email format validatie
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(nieuwEmail)) {
      return res.status(400).json({
        correlationId,
        message: 'Ongeldig email adres',
        errors: { nieuwEmail: 'Voer een geldig e-mailadres in' }
      });
    }

    const nieuwEmailLower = nieuwEmail.toLowerCase().trim();

    // Haal huidige profiel op
    const profileResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${user.id}&select=email,voornaam,achternaam`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const profiles = await profileResponse.json();
    if (!profiles || profiles.length === 0) {
      return res.status(404).json({ correlationId, message: 'Profiel niet gevonden' });
    }

    const currentProfile = profiles[0];
    const oudEmail = currentProfile.email;

    // Check of nieuwe email hetzelfde is als oude
    if (nieuwEmailLower === oudEmail.toLowerCase()) {
      return res.status(400).json({
        correlationId,
        message: 'Nieuwe email is hetzelfde als huidige email',
        errors: { nieuwEmail: 'Dit is al je huidige email adres' }
      });
    }

    // Check of nieuwe email al in gebruik is
    const existingUserResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?email=ilike.${encodeURIComponent(nieuwEmailLower)}&select=id`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }
    );

    const existingUsers = await existingUserResponse.json();
    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({
        correlationId,
        message: 'Email adres al in gebruik',
        errors: { nieuwEmail: 'Dit email adres is al geregistreerd' }
      });
    }

    // Genereer unieke token
    const verificatieToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 uur

    // Invalideer oude tokens voor deze user (set geverifieerd to false en expires_at to now)
    await httpClient(
      `${supabaseConfig.url}/rest/v1/email_verificatie_tokens?user_id=eq.${user.id}&geverifieerd=eq.false`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          expires_at: new Date().toISOString()
        })
      }
    );

    // Maak nieuwe token aan
    const insertTokenResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/email_verificatie_tokens`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          user_id: user.id,
          oud_email: oudEmail,
          nieuw_email: nieuwEmailLower,
          token: verificatieToken,
          expires_at: expiresAt.toISOString(),
          geverifieerd: false
        })
      }
    );

    if (!insertTokenResponse.ok) {
      const errorText = await insertTokenResponse.text();
      throw new Error(`Token aanmaken mislukt: ${errorText}`);
    }

    // Extract IP en User Agent
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0].trim() 
                   || req.headers['x-real-ip'] 
                   || req.connection?.remoteAddress 
                   || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Audit log
    await logAudit({
      userId: user.id,
      action: 'request_email_change',
      entityType: 'user_profiles',
      entityId: user.id,
      oldValues: { email: oudEmail },
      newValues: { email: nieuwEmailLower, status: 'pending_verification' },
      ipAddress,
      userAgent,
      correlationId
    });

    // Verificatie link naar Webflow pagina (pagina roept API aan via JS)
    const baseUrl = process.env.FRONTEND_URL || 'https://heppy-frontend-code.vercel.app';
    const verificatieLink = `${baseUrl}/dashboard/klant/verify-email?token=${verificatieToken}`;

    // Email naar OUDE adres (notificatie)
    await sendEmail({
      to: oudEmail,
      subject: 'Email wijziging aangevraagd',
      template: 'email-wijziging-aangevraagd-oud',
      data: {
        voornaam: currentProfile.voornaam,
        nieuwEmail: nieuwEmailLower,
        oudEmail: oudEmail
      }
    }, correlationId);

    // Email naar NIEUWE adres (verificatie)
    await sendEmail({
      to: nieuwEmailLower,
      subject: 'Bevestig je nieuwe email adres',
      template: 'email-wijziging-verificatie-nieuw',
      data: {
        voornaam: currentProfile.voornaam,
        verificatieLink,
        expiresAt: expiresAt.toLocaleString('nl-NL')
      }
    }, correlationId);

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/request-email-change',
      action: 'email_change_requested',
      userId: user.id,
      oudEmail,
      nieuwEmail: nieuwEmailLower
    }));

    return res.status(200).json({
      correlationId,
      message: 'Email wijziging aangevraagd. Check je nieuwe email voor verificatie.',
      success: true,
      verificatieVereist: true
    });

  } catch (error) {
    return handleErrorResponse(error, res, correlationId);
  }
}
