// api/routes/dashboard/schoonmaker/abonnementen.js
/**
 * Dashboard abonnementen endpoint voor schoonmakers
 * Retourneert alle abonnementen waaraan de schoonmaker is gekoppeld
 * (actief, gepauzeerd, gestopt)
 */
import { withAuth } from '../../../utils/authMiddleware.js';
import { httpClient } from '../../../utils/apiClient.js';
import { supabaseConfig } from '../../../config/index.js';

async function abonnementenHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `schoonmaker-abonnementen-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    console.log(`📅 [Schoonmaker Abonnementen] ========== START ========== [${correlationId}]`);
    console.log(`👤 [Schoonmaker Abonnementen] User ID: ${req.user.id}`);

    const schoonmakerId = req.user.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!authToken) {
      return res.status(401).json({ error: 'Authenticatie vereist' });
    }

    // === HAAL ALLE ABONNEMENTEN VOOR SCHOONMAKER OP ===
    console.log(`🔄 [Schoonmaker Abonnementen] Fetching abonnementen for schoonmaker ${schoonmakerId}...`);
    
    const abonnementenUrl = `${supabaseConfig.url}/rest/v1/abonnementen?schoonmaker_id=eq.${schoonmakerId}&select=id,gebruiker_id,uren,status,frequentie,startdatum,next_billing_date&order=status.asc,startdatum.desc`;
    
    const abonnementenResponse = await httpClient(abonnementenUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    }, correlationId);

    if (!abonnementenResponse.ok) {
      const errorText = await abonnementenResponse.text();
      console.error(`❌ [Schoonmaker Abonnementen] Failed to fetch [${correlationId}]`, errorText);
      throw new Error('Kan abonnementen niet ophalen');
    }

    const abonnementen = await abonnementenResponse.json();
    console.log(`✅ [Schoonmaker Abonnementen] Found ${abonnementen.length} abonnementen [${correlationId}]`);

    // === VERWERK ELKE ABONNEMENT ===
    const processedAbonnementen = [];

    for (const abb of abonnementen) {
      try {
        console.log(`🔄 [Schoonmaker Abonnementen] Processing abonnement ${abb.id} [${correlationId}]`);

        // Haal klant gegevens en adres op
        const klantUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${abb.gebruiker_id}&select=voornaam,achternaam,adres_id`;
        const klantResp = await httpClient(klantUrl, {
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${authToken}`,
          }
        }, correlationId);

        if (!klantResp.ok) {
          console.warn(`⚠️ [Schoonmaker Abonnementen] Could not fetch klant for ${abb.id}`);
          continue;
        }

        const klanten = await klantResp.json();
        const klant = klanten[0];

        if (!klant) continue;

        // Haal adres op
        const adresUrl = `${supabaseConfig.url}/rest/v1/adressen?id=eq.${klant.adres_id}&select=straat,huisnummer,toevoeging,postcode,plaats`;
        const adresResp = await httpClient(adresUrl, {
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${authToken}`,
          }
        }, correlationId);

        let adres = null;
        if (adresResp.ok) {
          const adressen = await adresResp.json();
          adres = adressen[0];
        }

        // Bepaal start week en jaar dari startdatum
        let startWeeknummer = null;
        let startJaar = null;
        if (abb.startdatum) {
          const startDate = new Date(abb.startdatum);
          // ISO week number calculation
          const d = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));
          const dayNum = d.getUTCDay() || 7;
          d.setUTCDate(d.getUTCDate() + 4 - dayNum);
          const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
          startWeeknummer = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
          startJaar = d.getUTCFullYear();
        }

        const abbData = {
          id: abb.id,
          gebruiker_id: abb.gebruiker_id,
          uren: abb.uren,
          status: abb.status,
          frequentie: abb.frequentie,
          startdatum: abb.startdatum,
          startWeeknummer,
          startJaar,
          next_billing_date: abb.next_billing_date,
          klant_voornaam: klant.voornaam,
          klant_achternaam: klant.achternaam,
          adres: adres ? {
            straat: adres.straat,
            huisnummer: adres.huisnummer,
            toevoeging: adres.toevoeging,
            postcode: adres.postcode,
            plaats: adres.plaats
          } : null
        };

        processedAbonnementen.push(abbData);
      } catch (err) {
        console.error(`❌ [Schoonmaker Abonnementen] Error processing abonnement ${abb.id} [${correlationId}]`, err.message);
      }
    }

    console.log(`✅ [Schoonmaker Abonnementen] Processed ${processedAbonnementen.length} abonnementen [${correlationId}]`);

    return res.status(200).json({
      success: true,
      data: processedAbonnementen
    });

  } catch (error) {
    console.error(`❌ [Schoonmaker Abonnementen] Error [${correlationId}]`, {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van abonnementen'
    });
  }
}

// Exporteer met authenticatie
export default async function handler(req, res) {
  // CORS headers
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

  // Wrap met authenticatie
  return withAuth(abonnementenHandler)(req, res);
}
