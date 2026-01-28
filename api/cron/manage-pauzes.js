import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';
import { notificeerPauzeBeëindigd } from '../services/notificatieService.js';

/**
 * Dagelijkse cron job om abonnement pauzes te beheren:
 * 1. Start pauzes (status 'actief' -> 'gepauzeerd' wanneer pauze_start_weeknr bereikt is)
 * 2. Beëindig pauzes (status 'gepauzeerd' -> 'actief' wanneer eerste_schoonmaak_week bereikt is)
 * 
 * Runs daily via Vercel Cron at 00:30 (na recurring-billing die om 00:00 draait)
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

export default async function managePauzesHandler(req, res) {
  // Security: Vercel cron authentication
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error(JSON.stringify({
      level: 'ERROR',
      route: 'cron/manage-pauzes',
      action: 'unauthorized',
      error: 'Invalid cron secret'
    }));
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const correlationId = `cron-${Date.now()}`;
  
  try {
    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'cron/manage-pauzes',
      action: 'start'
    }));

    const now = new Date();
    const currentWeek = getISOWeek(now);
    const currentYear = now.getFullYear();

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'cron/manage-pauzes',
      action: 'current_week',
      week: currentWeek,
      year: currentYear
    }));

    // 1. Start pauzes: vind abonnementen waar pauze deze week begint
    const startPauzesUrl = `${supabaseConfig.url}/rest/v1/abonnement_pauzes?pauze_start_weeknr=eq.${currentWeek}&pauze_start_jaar=eq.${currentYear}&select=id,abonnement_id`;
    const startPauzesResponse = await httpClient(startPauzesUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
      }
    });

    if (!startPauzesResponse.ok) {
      throw new Error('Kan pauzes niet ophalen voor start check');
    }

    const pauzesToStart = await startPauzesResponse.json();
    
    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'cron/manage-pauzes',
      action: 'found_pauzes_to_start',
      count: pauzesToStart.length
    }));

    // Update status naar 'gepauzeerd' voor elk abonnement
    let startedCount = 0;
    for (const pauze of pauzesToStart) {
      try {
        // Haal eerst huidige abonnement status op
        const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${pauze.abonnement_id}&select=status`;
        const abonnementResponse = await httpClient(abonnementUrl, {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
          }
        });

        if (!abonnementResponse.ok) continue;

        const [abonnement] = await abonnementResponse.json();
        
        // Alleen updaten als status 'actief' is
        if (abonnement?.status === 'actief') {
          const updateUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${pauze.abonnement_id}`;
          const updateResponse = await httpClient(updateUrl, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ status: 'gepauzeerd' })
          });

          if (updateResponse.ok) {
            startedCount++;
            console.log(JSON.stringify({
              level: 'INFO',
              correlationId,
              route: 'cron/manage-pauzes',
              action: 'pauze_started',
              abonnementId: pauze.abonnement_id,
              pauzeId: pauze.id
            }));
          }
        }
      } catch (error) {
        console.error(JSON.stringify({
          level: 'ERROR',
          correlationId,
          route: 'cron/manage-pauzes',
          action: 'start_pauze_failed',
          abonnementId: pauze.abonnement_id,
          error: error.message
        }));
      }
    }

    // 2. Beëindig pauzes: vind abonnementen waar eerste_schoonmaak_week deze week is
    const eindPauzesUrl = `${supabaseConfig.url}/rest/v1/abonnement_pauzes?eerste_schoonmaak_week=eq.${currentWeek}&eerste_schoonmaak_jaar=eq.${currentYear}&select=id,abonnement_id`;
    const eindPauzesResponse = await httpClient(eindPauzesUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
      }
    });

    if (!eindPauzesResponse.ok) {
      throw new Error('Kan pauzes niet ophalen voor eind check');
    }

    const pauzesToEnd = await eindPauzesResponse.json();
    
    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'cron/manage-pauzes',
      action: 'found_pauzes_to_end',
      count: pauzesToEnd.length
    }));

    // Update status naar 'actief' voor elk abonnement
    let endedCount = 0;
    for (const pauze of pauzesToEnd) {
      try {
        // Haal eerst huidige abonnement status op
        const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${pauze.abonnement_id}&select=status`;
        const abonnementResponse = await httpClient(abonnementUrl, {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
          }
        });

        if (!abonnementResponse.ok) continue;

        const [abonnement] = await abonnementResponse.json();
        
        // Alleen updaten als status 'gepauzeerd' is
        if (abonnement?.status === 'gepauzeerd') {
          const updateUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${pauze.abonnement_id}`;
          const updateResponse = await httpClient(updateUrl, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ status: 'actief' })
          });

          if (updateResponse.ok) {
            endedCount++;
            console.log(JSON.stringify({
              level: 'INFO',
              correlationId,
              route: 'cron/manage-pauzes',
              action: 'pauze_ended',
              abonnementId: pauze.abonnement_id,
              pauzeId: pauze.id
            }));
            
            // 🔔 NOTIFICATIE: Pauze beëindigd
            try {
              // Haal gebruiker_id op van abonnement
              const abonnementDataUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${pauze.abonnement_id}&select=gebruiker_id,schoonmaak_aanvraag_id`;
              const abonnementDataResp = await httpClient(abonnementDataUrl, {
                method: 'GET',
                headers: {
                  'apikey': supabaseConfig.anonKey,
                  'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
                }
              });
              
              if (abonnementDataResp.ok) {
                const [abonnementData] = await abonnementDataResp.json();
                if (abonnementData?.gebruiker_id) {
                  await notificeerPauzeBeëindigd({
                    klantId: abonnementData.gebruiker_id,
                    abonnementId: pauze.abonnement_id,
                    eersteSchoonmaakWeek: currentWeek,
                    eersteSchoonmaakJaar: currentYear
                  });
                  console.log('✅ Pauze beëindigd notificatie aangemaakt');
                }
              }
            } catch (notifError) {
              console.error('⚠️ Notificatie failed (niet-blokkerende fout):', notifError.message);
            }
          }
        }
      } catch (error) {
        console.error(JSON.stringify({
          level: 'ERROR',
          correlationId,
          route: 'cron/manage-pauzes',
          action: 'end_pauze_failed',
          abonnementId: pauze.abonnement_id,
          error: error.message
        }));
      }
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'cron/manage-pauzes',
      action: 'completed',
      pauzesStarted: startedCount,
      pauzesEnded: endedCount
    }));

    return res.status(200).json({
      success: true,
      week: currentWeek,
      year: currentYear,
      pauzesStarted: startedCount,
      pauzesEnded: endedCount
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'cron/manage-pauzes',
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
