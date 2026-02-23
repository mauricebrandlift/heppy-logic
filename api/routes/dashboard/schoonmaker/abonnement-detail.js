// api/routes/dashboard/schoonmaker/abonnement-detail.js
/**
 * Haal abonnement details op voor schoonmaker dashboard
 * Alleen eigen abonnementen (waar schoonmaker_id matcht) toegestaan
 * Inclusief klant profiel, adres en woning gegevens
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { withAuth } from '../../../utils/authMiddleware.js';

async function abonnementDetailHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `sm-abonnement-detail-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);
  const schoonmakerId = req.user.id;
  const authToken = req.headers.authorization?.split(' ')[1];

  try {
    // Get abonnement ID from query params
    const { id } = req.query;

    if (!id) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/schoonmaker/abonnement-detail',
        action: 'missing_id',
        schoonmakerId
      }));
      return res.status(400).json({
        correlationId,
        error: 'Abonnement ID is verplicht'
      });
    }

    console.log(`🔄 [SM Abonnement Detail] Fetching abonnement ${id} for schoonmaker ${schoonmakerId} [${correlationId}]`);

    // === FETCH ABONNEMENT (filter op schoonmaker_id) ===
    const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${id}&schoonmaker_id=eq.${schoonmakerId}&select=*`;

    const abonnementResponse = await httpClient(abonnementUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    }, correlationId);

    if (!abonnementResponse.ok) {
      const errorText = await abonnementResponse.text();
      console.error(`❌ [SM Abonnement Detail] Failed to fetch abonnement [${correlationId}]`, errorText);
      throw new Error('Kan abonnement niet ophalen');
    }

    const abonnementen = await abonnementResponse.json();

    if (!abonnementen || abonnementen.length === 0) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/schoonmaker/abonnement-detail',
        action: 'abonnement_not_found',
        id,
        schoonmakerId
      }));
      return res.status(404).json({
        correlationId,
        error: 'Abonnement niet gevonden'
      });
    }

    const abonnement = abonnementen[0];

    // === FETCH KLANT PROFIEL (user_profiles + adres) ===
    let klantProfile = null;
    let klantAdres = null;

    if (abonnement.gebruiker_id) {
      console.log(`🔄 [SM Abonnement Detail] Fetching klant profile for ${abonnement.gebruiker_id} [${correlationId}]`);

      const klantUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${abonnement.gebruiker_id}&select=voornaam,achternaam,email,telefoon,profielfoto,adres_id`;

      const klantResponse = await httpClient(klantUrl, {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${authToken}`,
        }
      }, correlationId);

      if (klantResponse.ok) {
        const profiles = await klantResponse.json();
        klantProfile = profiles[0] || null;

        // Fetch adres als klant een adres_id heeft
        if (klantProfile?.adres_id) {
          const adresUrl = `${supabaseConfig.url}/rest/v1/adressen?id=eq.${klantProfile.adres_id}&select=straat,huisnummer,toevoeging,postcode,plaats`;

          const adresResponse = await httpClient(adresUrl, {
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${authToken}`,
            }
          }, correlationId);

          if (adresResponse.ok) {
            const adressen = await adresResponse.json();
            klantAdres = adressen[0] || null;
          }
        }
      } else {
        console.warn(`⚠️ [SM Abonnement Detail] Kon klant profiel niet ophalen [${correlationId}]`);
      }
    }

    // === CHECK OF SCHOONMAKER GESTOPT IS (stopgeschiedenis) ===
    let stopInfo = null;

    const stopUrl = `${supabaseConfig.url}/rest/v1/schoonmaker_stopgeschiedenis?abonnement_id=eq.${id}&schoonmaker_id=eq.${schoonmakerId}&select=reden,stopdatum,opzeg_week,opzeg_jaar&order=stopdatum.desc&limit=1`;

    const stopResponse = await httpClient(stopUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    }, correlationId);

    if (stopResponse.ok) {
      const stopRecords = await stopResponse.json();
      if (stopRecords.length > 0) {
        stopInfo = {
          reden: stopRecords[0].reden,
          stopdatum: stopRecords[0].stopdatum,
          opzeg_week: stopRecords[0].opzeg_week,
          opzeg_jaar: stopRecords[0].opzeg_jaar,
          gestopt_door: 'schoonmaker'
        };
      }
    }

    // Als geen schoonmaker stop, check of klant heeft opgezegd
    if (!stopInfo && abonnement.canceled_at) {
      stopInfo = {
        reden: abonnement.cancellation_reason,
        stopdatum: abonnement.canceled_at,
        gestopt_door: 'klant'
      };
    }

    console.log(`✅ [SM Abonnement Detail] Abonnement opgehaald - Status: ${abonnement.status} [${correlationId}]`);

    // === RESPONSE SAMENSTELLEN ===
    const responseData = {
      correlationId,
      // Abonnement gegevens
      id: abonnement.id,
      uren: abonnement.uren,
      frequentie: abonnement.frequentie,
      status: abonnement.status,
      startdatum: abonnement.startdatum,
      aangemaakt_op: abonnement.aangemaakt_op,
      canceled_at: abonnement.canceled_at,
      cancellation_reason: abonnement.cancellation_reason,
      opzeg_week: abonnement.opzeg_week,
      opzeg_jaar: abonnement.opzeg_jaar,

      // Adres gegevens
      adres: klantAdres ? {
        straat: klantAdres.straat,
        huisnummer: klantAdres.huisnummer,
        toevoeging: klantAdres.toevoeging,
        postcode: klantAdres.postcode,
        plaats: klantAdres.plaats
      } : null,

      // Klant profiel
      klant: klantProfile ? {
        voornaam: klantProfile.voornaam,
        achternaam: klantProfile.achternaam,
        email: klantProfile.email,
        telefoon: klantProfile.telefoon,
        profielfoto: klantProfile.profielfoto,
        plaats: klantAdres?.plaats || null
      } : null,

      // Stop info (indien van toepassing)
      stop_info: stopInfo
    };

    return res.status(200).json(responseData);

  } catch (error) {
    console.error(`❌ [SM Abonnement Detail] Error [${correlationId}]`, error.message);
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'dashboard/schoonmaker/abonnement-detail',
      action: 'error',
      error: error.message,
      schoonmakerId
    }));

    return res.status(500).json({
      correlationId,
      error: 'Er is een probleem opgetreden bij het ophalen van het abonnement'
    });
  }
}

// Export met auth middleware - alleen schoonmakers toegestaan
export default withAuth(abonnementDetailHandler, { roles: ['schoonmaker'] });
