// api/routes/dashboard/schoonmaker/eenmalige-aangenomen.js
/**
 * Dashboard eenmalige aangenomen opdrachten endpoint voor schoonmakers
 * Retourneert alle eenmalige opdrachten die de schoonmaker heeft aangenomen
 */
import { withAuth } from '../../../utils/authMiddleware.js';
import { httpClient } from '../../../utils/apiClient.js';
import { supabaseConfig } from '../../../config/index.js';

async function eenmaligeAangenomenHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `schoonmaker-eenmalige-aangenomen-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    console.log(`🔧 [Schoonmaker Eenmalige Aangenomen] ========== START ========== [${correlationId}]`);
    console.log(`👤 [Schoonmaker Eenmalige Aangenomen] User ID: ${req.user.id}`);

    const schoonmakerId = req.user.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!authToken) {
      return res.status(401).json({ error: 'Authenticatie vereist' });
    }

    // === HAAL ALLE AANGENOMEN MATCHES OP VOOR DEZE SCHOONMAKER ===
    // Match moet: schoonmaker_id = current user, status = 'geaccepteerd', opdracht_id != null
    console.log(`🔄 [Schoonmaker Eenmalige Aangenomen] Fetching accepted matches for schoonmaker ${schoonmakerId}...`);
    
    const matchesUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_match?schoonmaker_id=eq.${schoonmakerId}&status=eq.geaccepteerd&opdracht_id=not.is.null&select=id,opdracht_id,aangemaakt_op&order=aangemaakt_op.desc`;
    
    const matchesResponse = await httpClient(matchesUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    }, correlationId);

    if (!matchesResponse.ok) {
      const errorText = await matchesResponse.text();
      console.error(`❌ [Schoonmaker Eenmalige Aangenomen] Failed to fetch matches [${correlationId}]`, errorText);
      throw new Error('Kan opdrachten niet ophalen');
    }

    const matches = await matchesResponse.json();
    console.log(`✅ [Schoonmaker Eenmalige Aangenomen] Found ${matches.length} aangenomen opdrachten [${correlationId}]`);

    // === VERWERK ELKE OPDRACHT ===
    const opdrachten = [];

    for (const match of matches) {
      try {
        // Haal opdracht details op
        const opdrachtUrl = `${supabaseConfig.url}/rest/v1/opdrachten?id=eq.${match.opdracht_id}&select=id,type,gebruiker_id,gewenste_datum,gegevens,status,is_spoed`;
        
        const opdrachtResp = await httpClient(opdrachtUrl, {
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${authToken}`,
          }
        }, correlationId);

        if (!opdrachtResp.ok) {
          console.warn(`⚠️ [Schoonmaker Eenmalige Aangenomen] Could not fetch opdracht ${match.opdracht_id} [${correlationId}]`);
          continue;
        }

        const opdrachtArray = await opdrachtResp.json();
        const opdracht = opdrachtArray[0];

        if (!opdracht) continue;

        let opdrachtData = {
          match_id: match.id,
          opdracht_id: match.opdracht_id,
          type: opdracht.type || 'onbekend',
          gewenste_datum: opdracht.gewenste_datum,
          status: opdracht.status,
          is_spoed: opdracht.is_spoed || false
        };

        // Extract uren uit gegevens JSONB (patroon: {type}_uren)
        if (opdracht.gegevens) {
          const urenVeld = Object.keys(opdracht.gegevens).find(key => key.endsWith('_uren'));
          if (urenVeld) {
            opdrachtData.uren = opdracht.gegevens[urenVeld];
            console.log(`📊 [Schoonmaker Eenmalige Aangenomen] Extracted uren: ${opdrachtData.uren} from ${urenVeld} [${correlationId}]`);
          }
        }

        // === HAAL KLANT INFO OP ===
        if (opdracht.gebruiker_id) {
          const userUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${opdracht.gebruiker_id}&select=voornaam,achternaam,adres_id`;
          
          const userResp = await httpClient(userUrl, {
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${authToken}`,
            }
          }, correlationId);

          if (userResp.ok) {
            const users = await userResp.json();
            const user = users[0];

            if (user) {
              opdrachtData.klant = {
                voornaam: user.voornaam,
                achternaam: user.achternaam
              };

              // === HAAL ADRES OP ===
              if (user.adres_id) {
                const adresUrl = `${supabaseConfig.url}/rest/v1/adressen?id=eq.${user.adres_id}&select=straat,huisnummer,toevoeging,postcode,plaats`;
                
                const adresResp = await httpClient(adresUrl, {
                  headers: {
                    'apikey': supabaseConfig.anonKey,
                    'Authorization': `Bearer ${authToken}`,
                  }
                }, correlationId);

                if (adresResp.ok) {
                  const adressen = await adresResp.json();
                  const adres = adressen[0];
                  if (adres) {
                    opdrachtData.adres = {
                      straat: adres.straat,
                      huisnummer: adres.huisnummer,
                      toevoeging: adres.toevoeging,
                      postcode: adres.postcode,
                      plaats: adres.plaats
                    };
                  }
                }
              }
            }
          }
        }

        opdrachten.push(opdrachtData);

      } catch (matchError) {
        console.error(`❌ [Schoonmaker Eenmalige Aangenomen] Error processing match ${match.id} [${correlationId}]`, matchError);
        // Continue met volgende opdracht
      }
    }

    // === SORTEER: Nieuwste eerst ===
    opdrachten.sort((a, b) => {
      return new Date(b.gewenste_datum || 0) - new Date(a.gewenste_datum || 0);
    });

    console.log(`✅ [Schoonmaker Eenmalige Aangenomen] ========== SUCCESS ========== [${correlationId}]`);
    console.log(`📊 [Schoonmaker Eenmalige Aangenomen] Returning ${opdrachten.length} opdrachten`);

    return res.status(200).json({
      success: true,
      data: opdrachten
    });

  } catch (error) {
    console.error(`❌ [Schoonmaker Eenmalige Aangenomen] ========== ERROR ========== [${correlationId}]`, error);
    return res.status(500).json({
      error: 'Er ging iets mis bij het ophalen van opdrachten',
      details: error.message
    });
  }
}

// Export met auth middleware - alleen schoonmakers
export default withAuth(eenmaligeAangenomenHandler, { roles: ['schoonmaker'] });
