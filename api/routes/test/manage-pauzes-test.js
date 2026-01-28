import { supabaseConfig } from '../../config/index.js';
import { httpClient } from '../../utils/apiClient.js';

/**
 * TEST ENDPOINT voor manage-pauzes cron logica
 * Gebruik dit om de pauze start/eind logica te testen zonder op de cron schedule te wachten
 * 
 * GET /api/routes/test/manage-pauzes-test
 * GET /api/routes/test/manage-pauzes-test?week=5&year=2026  (test specifieke week)
 */

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export default async function managePauzesTestHandler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'OK' });
  }

  const correlationId = `test-${Date.now()}`;
  
  try {
    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'test/manage-pauzes-test',
      action: 'start'
    }));

    // Gebruik query params voor custom week/year, of huidige week
    const testWeek = req.query.week ? parseInt(req.query.week) : null;
    const testYear = req.query.year ? parseInt(req.query.year) : null;

    const now = new Date();
    const currentWeek = testWeek || getISOWeek(now);
    const currentYear = testYear || now.getFullYear();

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'test/manage-pauzes-test',
      action: 'testing_week',
      week: currentWeek,
      year: currentYear,
      isCustomWeek: !!(testWeek || testYear)
    }));

    // 1. Start pauzes: vind abonnementen waar pauze deze week begint
    const startPauzesUrl = `${supabaseConfig.url}/rest/v1/abonnement_pauzes?pauze_start_weeknr=eq.${currentWeek}&pauze_start_jaar=eq.${currentYear}&select=id,abonnement_id,pauze_start_weeknr,pauze_start_jaar`;
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
      route: 'test/manage-pauzes-test',
      action: 'found_pauzes_to_start',
      count: pauzesToStart.length,
      pauzes: pauzesToStart
    }));

    const startResults = [];
    for (const pauze of pauzesToStart) {
      try {
        // Haal huidige abonnement status op
        const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${pauze.abonnement_id}&select=id,status`;
        const abonnementResponse = await httpClient(abonnementUrl, {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
          }
        });

        if (!abonnementResponse.ok) {
          startResults.push({ pauzeId: pauze.id, status: 'error', reason: 'abonnement_not_found' });
          continue;
        }

        const [abonnement] = await abonnementResponse.json();
        
        if (abonnement?.status === 'actief') {
          // TEST MODE: Log wat we ZOUDEN doen, maar doe het NIET echt (tenzij ?apply=true)
          if (req.query.apply === 'true') {
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
              startResults.push({ 
                pauzeId: pauze.id, 
                abonnementId: pauze.abonnement_id,
                status: 'UPDATED', 
                action: 'actief -> gepauzeerd' 
              });
            } else {
              startResults.push({ 
                pauzeId: pauze.id, 
                status: 'error', 
                reason: 'update_failed' 
              });
            }
          } else {
            startResults.push({ 
              pauzeId: pauze.id, 
              abonnementId: pauze.abonnement_id,
              status: 'WOULD_UPDATE', 
              action: 'actief -> gepauzeerd (dry-run)' 
            });
          }
        } else {
          startResults.push({ 
            pauzeId: pauze.id, 
            abonnementId: pauze.abonnement_id,
            status: 'skipped', 
            currentStatus: abonnement?.status,
            reason: 'not_actief' 
          });
        }
      } catch (error) {
        startResults.push({ 
          pauzeId: pauze.id, 
          status: 'error', 
          error: error.message 
        });
      }
    }

    // 2. Beëindig pauzes: vind abonnementen waar eerste_schoonmaak_week deze week is
    const eindPauzesUrl = `${supabaseConfig.url}/rest/v1/abonnement_pauzes?eerste_schoonmaak_week=eq.${currentWeek}&eerste_schoonmaak_jaar=eq.${currentYear}&select=id,abonnement_id,eerste_schoonmaak_week,eerste_schoonmaak_jaar`;
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
      route: 'test/manage-pauzes-test',
      action: 'found_pauzes_to_end',
      count: pauzesToEnd.length,
      pauzes: pauzesToEnd
    }));

    const endResults = [];
    for (const pauze of pauzesToEnd) {
      try {
        const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${pauze.abonnement_id}&select=id,status`;
        const abonnementResponse = await httpClient(abonnementUrl, {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
          }
        });

        if (!abonnementResponse.ok) {
          endResults.push({ pauzeId: pauze.id, status: 'error', reason: 'abonnement_not_found' });
          continue;
        }

        const [abonnement] = await abonnementResponse.json();
        
        if (abonnement?.status === 'gepauzeerd') {
          if (req.query.apply === 'true') {
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
              endResults.push({ 
                pauzeId: pauze.id, 
                abonnementId: pauze.abonnement_id,
                status: 'UPDATED', 
                action: 'gepauzeerd -> actief' 
              });
            } else {
              endResults.push({ 
                pauzeId: pauze.id, 
                status: 'error', 
                reason: 'update_failed' 
              });
            }
          } else {
            endResults.push({ 
              pauzeId: pauze.id, 
              abonnementId: pauze.abonnement_id,
              status: 'WOULD_UPDATE', 
              action: 'gepauzeerd -> actief (dry-run)' 
            });
          }
        } else {
          endResults.push({ 
            pauzeId: pauze.id, 
            abonnementId: pauze.abonnement_id,
            status: 'skipped', 
            currentStatus: abonnement?.status,
            reason: 'not_gepauzeerd' 
          });
        }
      } catch (error) {
        endResults.push({ 
          pauzeId: pauze.id, 
          status: 'error', 
          error: error.message 
        });
      }
    }

    const isDryRun = req.query.apply !== 'true';
    
    return res.status(200).json({
      success: true,
      mode: isDryRun ? 'DRY-RUN (geen changes gemaakt)' : 'LIVE (changes toegepast)',
      note: isDryRun ? 'Gebruik ?apply=true om changes daadwerkelijk toe te passen' : 'Changes zijn toegepast',
      testWeek: currentWeek,
      testYear: currentYear,
      startPauzes: {
        found: pauzesToStart.length,
        results: startResults
      },
      endPauzes: {
        found: pauzesToEnd.length,
        results: endResults
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'test/manage-pauzes-test',
      action: 'error',
      error: error.message,
      stack: error.stack
    }));

    return res.status(500).json({
      error: 'Test failed',
      message: error.message,
      correlationId
    });
  }
}
