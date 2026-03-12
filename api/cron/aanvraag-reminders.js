import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';
import { notificeerAanvraagVerloopt } from '../services/notificatieService.js';

/**
 * Dagelijkse cron job om schoonmakers te herinneren aan openstaande aanvragen.
 * 
 * Zoekt naar schoonmaak_match records met status 'open' die ouder zijn dan 24 uur.
 * Controleert of er al een herinnering is gestuurd (max 1 herinnering per match).
 * 
 * Runs daily via Vercel Cron at 09:00 (goed moment - begin werkdag)
 */

export default async function aanvraagRemindersHandler(req, res) {
  // Security: Vercel cron authentication
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error(JSON.stringify({
      level: 'ERROR',
      route: 'cron/aanvraag-reminders',
      action: 'unauthorized',
      error: 'Invalid cron secret'
    }));
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const correlationId = `cron-reminders-${Date.now()}`;

  try {
    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'cron/aanvraag-reminders',
      action: 'start'
    }));

    // Zoek open matches ouder dan 24 uur
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const matchesUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_match?status=eq.open&aangemaakt_op=lt.${cutoffDate}&select=id,schoonmaker_id,schoonmaak_aanvraag_id,opdracht_id,abonnement_id`;
    const matchesResp = await httpClient(matchesUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
      }
    });

    if (!matchesResp.ok) {
      throw new Error(`Kan open matches niet ophalen: ${await matchesResp.text()}`);
    }

    const openMatches = await matchesResp.json();

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'cron/aanvraag-reminders',
      action: 'found_open_matches',
      count: openMatches.length
    }));

    let remindersSent = 0;
    let remindersSkipped = 0;

    for (const match of openMatches) {
      try {
        // Check of er al een herinnering is verstuurd voor deze match
        // We zoeken naar een notificatie met type 'nieuwe_match' en match_id die
        // de herinnering-titel bevat (aangemaakt door deze cron)
        const existingNotifUrl = `${supabaseConfig.url}/rest/v1/notificaties?match_id=eq.${match.id}&gebruiker_id=eq.${match.schoonmaker_id}&titel=like.*Herinnering*&select=id&limit=1`;
        const existingNotifResp = await httpClient(existingNotifUrl, {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
          }
        });

        if (existingNotifResp.ok) {
          const existingNotifs = await existingNotifResp.json();
          if (existingNotifs.length > 0) {
            // Al een herinnering gestuurd, skip
            remindersSkipped++;
            continue;
          }
        }

        // Verstuur herinnering
        await notificeerAanvraagVerloopt({
          schoonmakerId: match.schoonmaker_id,
          matchId: match.id,
          abonnementId: match.abonnement_id || null,
          opdrachtId: match.opdracht_id || null
        });

        remindersSent++;

        console.log(JSON.stringify({
          level: 'INFO',
          correlationId,
          route: 'cron/aanvraag-reminders',
          action: 'reminder_sent',
          matchId: match.id,
          schoonmakerId: match.schoonmaker_id
        }));

      } catch (matchError) {
        console.error(JSON.stringify({
          level: 'ERROR',
          correlationId,
          route: 'cron/aanvraag-reminders',
          action: 'reminder_failed',
          matchId: match.id,
          error: matchError.message
        }));
      }
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'cron/aanvraag-reminders',
      action: 'completed',
      remindersSent,
      remindersSkipped,
      totalOpenMatches: openMatches.length
    }));

    return res.status(200).json({
      success: true,
      remindersSent,
      remindersSkipped,
      totalOpenMatches: openMatches.length
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'cron/aanvraag-reminders',
      action: 'error',
      error: error.message,
      stack: error.stack
    }));

    return res.status(500).json({
      error: 'Internal server error',
      correlationId
    });
  }
}
