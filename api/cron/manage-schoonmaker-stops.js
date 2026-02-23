import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

/**
 * Dagelijkse cron job om schoonmaker stops te verwerken:
 * Wanneer de opzeg_week + opzeg_jaar bereikt is, wordt schoonmaker_id op null gezet
 * op het bijbehorende abonnement zodat admin een nieuwe schoonmaker kan toewijzen.
 * 
 * Runs daily via Vercel Cron at 01:00
 */

/**
 * Get current ISO week number
 */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export default async function manageSchoonmakerStopsHandler(req, res) {
  // Security: Vercel cron authentication
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error(JSON.stringify({
      level: 'ERROR',
      route: 'cron/manage-schoonmaker-stops',
      action: 'unauthorized',
      error: 'Invalid cron secret'
    }));
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const correlationId = `cron-sm-stops-${Date.now()}`;

  try {
    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'cron/manage-schoonmaker-stops',
      action: 'start'
    }));

    const now = new Date();
    const currentWeek = getISOWeek(now);
    const currentYear = now.getFullYear();

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'cron/manage-schoonmaker-stops',
      action: 'current_week',
      week: currentWeek,
      year: currentYear
    }));

    // === VIND STOPS DIE VERWERKT MOETEN WORDEN ===
    // Criteria: opzeg_week + opzeg_jaar is bereikt of voorbij
    // We zoeken stops waar:
    // - opzeg_jaar < currentYear (vorig jaar, sowieso verlopen)
    // - OF opzeg_jaar = currentYear EN opzeg_week <= currentWeek
    // We filteren later in code om complexe OR-conditie te vermijden in REST API

    // Haal alle stops op die nog niet verwerkt zijn (abonnement heeft nog schoonmaker_id)
    const stopsUrl = `${supabaseConfig.url}/rest/v1/schoonmaker_stopgeschiedenis?select=id,abonnement_id,schoonmaker_id,opzeg_week,opzeg_jaar`;

    const stopsResponse = await httpClient(stopsUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
      }
    });

    if (!stopsResponse.ok) {
      throw new Error('Kan schoonmaker_stopgeschiedenis niet ophalen');
    }

    const allStops = await stopsResponse.json();

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'cron/manage-schoonmaker-stops',
      action: 'total_stop_records',
      count: allStops.length
    }));

    // Filter stops die verlopen zijn (opzeg_week bereikt)
    const expiredStops = allStops.filter(stop => {
      if (!stop.opzeg_week || !stop.opzeg_jaar) return false;
      if (stop.opzeg_jaar < currentYear) return true;
      if (stop.opzeg_jaar === currentYear && stop.opzeg_week <= currentWeek) return true;
      return false;
    });

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'cron/manage-schoonmaker-stops',
      action: 'expired_stops_found',
      count: expiredStops.length
    }));

    // === VERWERK ELKE VERLOPEN STOP ===
    let processedCount = 0;
    let skippedCount = 0;

    for (const stop of expiredStops) {
      try {
        // Check of abonnement nog steeds deze schoonmaker_id heeft
        const aboUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${stop.abonnement_id}&schoonmaker_id=eq.${stop.schoonmaker_id}&select=id,schoonmaker_id`;

        const aboResponse = await httpClient(aboUrl, {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
          }
        });

        if (!aboResponse.ok) continue;

        const abonnementen = await aboResponse.json();

        if (!abonnementen || abonnementen.length === 0) {
          // Schoonmaker is al ontkoppeld (misschien door admin), skip
          skippedCount++;
          continue;
        }

        // Ontkoppel schoonmaker van abonnement
        const updateUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${stop.abonnement_id}`;

        const updateResponse = await httpClient(updateUrl, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            schoonmaker_id: null
          })
        });

        if (updateResponse.ok) {
          processedCount++;
          console.log(JSON.stringify({
            level: 'INFO',
            correlationId,
            route: 'cron/manage-schoonmaker-stops',
            action: 'schoonmaker_ontkoppeld',
            abonnementId: stop.abonnement_id,
            schoonmakerId: stop.schoonmaker_id,
            opzegWeek: stop.opzeg_week,
            opzegJaar: stop.opzeg_jaar
          }));
        } else {
          console.error(JSON.stringify({
            level: 'ERROR',
            correlationId,
            route: 'cron/manage-schoonmaker-stops',
            action: 'update_failed',
            abonnementId: stop.abonnement_id,
            status: updateResponse.status
          }));
        }
      } catch (error) {
        console.error(JSON.stringify({
          level: 'ERROR',
          correlationId,
          route: 'cron/manage-schoonmaker-stops',
          action: 'process_stop_failed',
          abonnementId: stop.abonnement_id,
          error: error.message
        }));
      }
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'cron/manage-schoonmaker-stops',
      action: 'completed',
      processed: processedCount,
      skipped: skippedCount,
      total: expiredStops.length
    }));

    return res.status(200).json({
      success: true,
      week: currentWeek,
      year: currentYear,
      processed: processedCount,
      skipped: skippedCount
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'cron/manage-schoonmaker-stops',
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
