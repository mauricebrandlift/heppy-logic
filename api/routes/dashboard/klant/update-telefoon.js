// api/routes/dashboard/klant/update-telefoon.js
/**
 * Update klant telefoonnummer
 * 
 * PATCH /api/routes/dashboard/klant/update-telefoon
 * 
 * Body:
 * - telefoon: string
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

    // Telefoon validatie
    if (!telefoon || telefoon.trim() === '') {
      return res.status(400).json({
        correlationId,
        message: 'Telefoonnummer is verplicht'
      });
    }

    // Format check (Dutch phone: 10+ digits)
    const phoneDigits = telefoon.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return res.status(400).json({
        correlationId,
        message: 'Ongeldig telefoonnummer formaat'
      });
    }

    // Haal huidig profiel op (voor audit logging en email)
    const profileResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${user.id}&select=voornaam,achternaam,telefoon`,
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
    const oudTelefoon = currentProfile.telefoon;
    const nieuwTelefoon = telefoon.trim();

    // Check of telefoon hetzelfde is
    if (oudTelefoon === nieuwTelefoon) {
      return res.status(400).json({
        correlationId,
        message: 'Dit is al je huidige telefoonnummer'
      });
    }

    // Update telefoon
    const updateResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${user.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        },
        body: JSON.stringify({
          telefoon: nieuwTelefoon,
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        route: 'dashboard/klant/update-telefoon',
        action: 'update_failed',
        error: errorText
      }));
      throw new Error('Kon telefoonnummer niet bijwerken');
    }

    // Extract IP en user agent voor audit
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                      req.headers['x-real-ip'] ||
                      req.connection?.remoteAddress ||
                      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'telefoon_bijgewerkt',
      entityType: 'user_profile',
      entityId: user.id,
      oldValues: { telefoon: oudTelefoon },
      newValues: { telefoon: nieuwTelefoon },
      ipAddress,
      userAgent,
      correlationId
    });

    // Haal actieve abonnementen op met schoonmaker details
    const abonnementResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/abonnementen?klant_id=eq.${user.id}&status=eq.actief&select=id,schoonmaker_id,user_profiles!abonnementen_schoonmaker_id_fkey(voornaam,achternaam,email)`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }
    );

    let activeAbonnementen = [];
    if (abonnementResponse.ok) {
      activeAbonnementen = await abonnementResponse.json();
    } else {
      console.error('Abonnementen ophalen error:', await abonnementResponse.text());
    }

    // Stuur email naar klant
    const telefoonGewijzigdEmail = await import('../../../templates/emails/telefoon-gewijzigd.js');
    try {
      await sendEmail({
        to: user.email,
        subject: 'Je telefoonnummer is gewijzigd',
        html: telefoonGewijzigdEmail.default({
          voornaam: currentProfile.voornaam,
          oudTelefoon,
          nieuwTelefoon
        }),
        from: 'info@heppy-schoonmaak.nl'
      });
    } catch (emailError) {
      console.error('Klant email error:', emailError);
      // Continue - email failure shouldn't block the update
    }

    // Notificeer schoonmakers als er actieve abonnementen zijn
    let schoonmakerGenotificeerd = false;
    if (activeAbonnementen && activeAbonnementen.length > 0) {
      const schoonmakerTelefoonEmail = await import('../../../templates/emails/schoonmaker-klant-telefoon-gewijzigd.js');
      
      for (const abonnement of activeAbonnementen) {
        if (abonnement.user_profiles?.email) {
          try {
            await sendEmail({
              to: abonnement.user_profiles.email,
              subject: 'Klantgegevens gewijzigd',
              html: schoonmakerTelefoonEmail.default({
                schoonmakerVoornaam: abonnement.user_profiles.voornaam,
                klantNaam: `${currentProfile.voornaam} ${currentProfile.achternaam}`,
                oudTelefoon,
                nieuwTelefoon
              }),
              from: 'info@heppy-schoonmaak.nl'
            });
            schoonmakerGenotificeerd = true;
          } catch (emailError) {
            console.error(`Schoonmaker email error voor ${abonnement.user_profiles.email}:`, emailError);
          }
        }
      }
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/update-telefoon',
      action: 'telefoon_updated',
      userId: user.id,
      schoonmakerGenotificeerd
    }));

    return res.status(200).json({
      correlationId,
      message: 'Telefoonnummer succesvol bijgewerkt',
      success: true,
      schoonmakerGenotificeerd
    });

  } catch (error) {
    return handleErrorResponse(error, res, correlationId);
  }
}
