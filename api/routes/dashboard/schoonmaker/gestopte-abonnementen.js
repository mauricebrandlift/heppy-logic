// api/routes/dashboard/schoonmaker/gestopte-abonnementen.js
/**
 * Dashboard gestopte abonnementen endpoint voor schoonmakers
 * Retourneert abonnementen waar de schoonmaker ooit actief op was maar nu gestopt is.
 * Twee bronnen:
 * 1. schoonmaker_stopgeschiedenis: schoonmaker heeft zelf gestopt → opzeg_week/opzeg_jaar uit die tabel
 * 2. abonnementen met canceled_at: klant heeft opgezegd → opzeg_week/opzeg_jaar uit abonnementen tabel
 */
import { withAuth } from '../../../utils/authMiddleware.js';
import { httpClient } from '../../../utils/apiClient.js';
import { supabaseConfig } from '../../../config/index.js';

/**
 * Bereken ISO weeknummer
 */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Haal klant + adres gegevens op voor een abonnement
 */
async function fetchKlantEnAdres(gebruikerId, authToken, correlationId) {
  const klantUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${gebruikerId}&select=voornaam,achternaam,adres_id`;
  const klantResp = await httpClient(klantUrl, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${authToken}`,
    }
  }, correlationId);

  if (!klantResp.ok) return { klant: null, adres: null };

  const klanten = await klantResp.json();
  const klant = klanten[0] || null;
  if (!klant) return { klant: null, adres: null };

  let adres = null;
  if (klant.adres_id) {
    const adresUrl = `${supabaseConfig.url}/rest/v1/adressen?id=eq.${klant.adres_id}&select=straat,huisnummer,toevoeging,postcode,plaats`;
    const adresResp = await httpClient(adresUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    }, correlationId);

    if (adresResp.ok) {
      const adressen = await adresResp.json();
      adres = adressen[0] || null;
    }
  }

  return { klant, adres };
}

/**
 * Bereken start week/jaar uit startdatum
 */
function getStartWeekInfo(startdatum) {
  if (!startdatum) return { startWeeknummer: null, startJaar: null };
  const startDate = new Date(startdatum);
  const d = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    startWeeknummer: Math.ceil((((d - yearStart) / 86400000) + 1) / 7),
    startJaar: d.getUTCFullYear()
  };
}

async function gestopteAbonnementenHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `sm-gestopt-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    const schoonmakerId = req.user.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    console.log(`🛑 [Gestopte Abonnementen] START voor schoonmaker ${schoonmakerId} [${correlationId}]`);

    const resultaten = [];
    const verwerktAbonnementIds = new Set();

    // === 1. SCHOONMAKER HEEFT ZELF GESTOPT (via schoonmaker_stopgeschiedenis) ===
    const stopUrl = `${supabaseConfig.url}/rest/v1/schoonmaker_stopgeschiedenis?schoonmaker_id=eq.${schoonmakerId}&select=abonnement_id,opzeg_week,opzeg_jaar,stopdatum`;
    const stopResp = await httpClient(stopUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    }, correlationId);

    if (stopResp.ok) {
      const stopRecords = await stopResp.json();
      console.log(`🛑 [Gestopte Abonnementen] ${stopRecords.length} records in stopgeschiedenis [${correlationId}]`);

      for (const record of stopRecords) {
        try {
          // Haal abonnement op
          const abbUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${record.abonnement_id}&select=id,gebruiker_id,uren,status,frequentie,startdatum`;
          const abbResp = await httpClient(abbUrl, {
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${authToken}`,
            }
          }, correlationId);

          if (!abbResp.ok) continue;

          const abbs = await abbResp.json();
          const abb = abbs[0];
          if (!abb) continue;

          const { klant, adres } = await fetchKlantEnAdres(abb.gebruiker_id, authToken, correlationId);
          if (!klant) continue;

          const { startWeeknummer, startJaar } = getStartWeekInfo(abb.startdatum);

          resultaten.push({
            id: abb.id,
            uren: abb.uren,
            frequentie: abb.frequentie,
            startWeeknummer,
            startJaar,
            stopWeek: record.opzeg_week,
            stopJaar: record.opzeg_jaar,
            gestopt_door: 'schoonmaker',
            klant_voornaam: klant.voornaam,
            klant_achternaam: klant.achternaam,
            adres: adres ? {
              straat: adres.straat,
              huisnummer: adres.huisnummer,
              toevoeging: adres.toevoeging,
              postcode: adres.postcode,
              plaats: adres.plaats
            } : null
          });

          verwerktAbonnementIds.add(abb.id);
        } catch (err) {
          console.error(`⚠️ [Gestopte Abonnementen] Fout bij verwerken stop record [${correlationId}]`, err.message);
        }
      }
    }

    // === 2. KLANT HEEFT OPGEZEGD (abonnement met canceled_at, nog gekoppeld aan schoonmaker) ===
    const klantStopUrl = `${supabaseConfig.url}/rest/v1/abonnementen?schoonmaker_id=eq.${schoonmakerId}&canceled_at=not.is.null&select=id,gebruiker_id,uren,status,frequentie,startdatum,opzeg_week,opzeg_jaar,canceled_at`;
    const klantStopResp = await httpClient(klantStopUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    }, correlationId);

    if (klantStopResp.ok) {
      const klantStopAbbs = await klantStopResp.json();
      console.log(`🛑 [Gestopte Abonnementen] ${klantStopAbbs.length} abonnementen opgezegd door klant [${correlationId}]`);

      for (const abb of klantStopAbbs) {
        // Skip als al verwerkt via stopgeschiedenis
        if (verwerktAbonnementIds.has(abb.id)) continue;

        try {
          const { klant, adres } = await fetchKlantEnAdres(abb.gebruiker_id, authToken, correlationId);
          if (!klant) continue;

          const { startWeeknummer, startJaar } = getStartWeekInfo(abb.startdatum);

          resultaten.push({
            id: abb.id,
            uren: abb.uren,
            frequentie: abb.frequentie,
            startWeeknummer,
            startJaar,
            stopWeek: abb.opzeg_week,
            stopJaar: abb.opzeg_jaar,
            gestopt_door: 'klant',
            klant_voornaam: klant.voornaam,
            klant_achternaam: klant.achternaam,
            adres: adres ? {
              straat: adres.straat,
              huisnummer: adres.huisnummer,
              toevoeging: adres.toevoeging,
              postcode: adres.postcode,
              plaats: adres.plaats
            } : null
          });
        } catch (err) {
          console.error(`⚠️ [Gestopte Abonnementen] Fout bij verwerken klant stop [${correlationId}]`, err.message);
        }
      }
    }

    console.log(`✅ [Gestopte Abonnementen] Totaal ${resultaten.length} gestopte abonnementen [${correlationId}]`);

    return res.status(200).json({
      success: true,
      data: resultaten
    });

  } catch (error) {
    console.error(`❌ [Gestopte Abonnementen] Error [${correlationId}]`, error.message);
    return res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het ophalen van gestopte abonnementen'
    });
  }
}

// Export met auth middleware
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Correlation-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return withAuth(gestopteAbonnementenHandler)(req, res);
}
