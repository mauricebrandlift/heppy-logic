// api/routes/dashboard/schoonmaker/aanvragen.js
/**
 * Dashboard aanvragen endpoint voor schoonmakers
 * Retourneert alle matches (aanvragen) voor de schoonmaker:
 * - Open aanvragen (wacht op acceptatie/afwijzing)
 * - Geaccepteerde aanvragen
 * - Geweigerde aanvragen
 * - Verlopen aanvragen
 * 
 * Bevat zowel abonnement aanvragen als eenmalige opdrachten
 */
import { withAuth } from '../../../utils/authMiddleware.js';
import { httpClient } from '../../../utils/apiClient.js';
import { supabaseConfig } from '../../../config/index.js';

async function aanvragenHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `schoonmaker-aanvragen-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  const requestId = `aanvragen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    console.log(`📋 [Schoonmaker Aanvragen] ========== START ========== [${correlationId}]`);
    console.log(`📋 [Schoonmaker Aanvragen] Request ID: ${requestId}`);
    console.log(`👤 [Schoonmaker Aanvragen] User ID: ${req.user.id}`);

    const schoonmakerId = req.user.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!authToken) {
      return res.status(401).json({ error: 'Authenticatie vereist' });
    }

    // === HAAL ALLE MATCHES OP VOOR DEZE SCHOONMAKER ===
    console.log(`🔄 [Schoonmaker Aanvragen] Fetching matches for schoonmaker ${schoonmakerId}...`);
    
    const matchesUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_match?schoonmaker_id=eq.${schoonmakerId}&select=id,status,aangemaakt_op,schoonmaak_aanvraag_id,opdracht_id,auto_assigned&order=status.asc,aangemaakt_op.desc`;
    
    const matchesResponse = await httpClient(matchesUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    }, correlationId);

    if (!matchesResponse.ok) {
      const errorText = await matchesResponse.text();
      console.error(`❌ [Schoonmaker Aanvragen] Failed to fetch matches [${correlationId}]`, errorText);
      throw new Error('Kan aanvragen niet ophalen');
    }

    const matches = await matchesResponse.json();
    console.log(`✅ [Schoonmaker Aanvragen] Found ${matches.length} matches [${correlationId}]`);

    // === VERWERK ELKE MATCH ===
    const aanvragen = [];

    for (const match of matches) {
      try {
        const isAbonnement = !!match.schoonmaak_aanvraag_id;
        const isEenmalig = !!match.opdracht_id;

        console.log(`🔄 [Schoonmaker Aanvragen] Processing match ${match.id} - type: ${isAbonnement ? 'abonnement' : 'eenmalig'} [${correlationId}]`);

        let aanvraagData = {
          match_id: match.id,
          status: match.status,
          aangemaakt_op: match.aangemaakt_op,
          auto_assigned: match.auto_assigned,
          type: isAbonnement ? 'abonnement' : 'eenmalig'
        };

        // === ABONNEMENT AANVRAAG ===
        if (isAbonnement) {
          // Haal schoonmaak_aanvraag op
          const aanvraagUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen?id=eq.${match.schoonmaak_aanvraag_id}&select=voornaam,achternaam,email,telefoon,uren,startdatum,schoonmaak_optie,adres_id`;
          
          const aanvraagResp = await httpClient(aanvraagUrl, {
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${authToken}`,
            }
          }, correlationId);

          if (aanvraagResp.ok) {
            const aanvragen = await aanvraagResp.json();
            const aanvraag = aanvragen[0];

            if (aanvraag) {
              aanvraagData.klant = {
                voornaam: aanvraag.voornaam,
                achternaam: aanvraag.achternaam,
                email: aanvraag.email,
                telefoon: aanvraag.telefoon
              };
              aanvraagData.frequentie = aanvraag.schoonmaak_optie;
              aanvraagData.uren = aanvraag.uren;
              aanvraagData.startdatum = aanvraag.startdatum;

              // Haal adres op
              if (aanvraag.adres_id) {
                const adresUrl = `${supabaseConfig.url}/rest/v1/adressen?id=eq.${aanvraag.adres_id}&select=straat,huisnummer,toevoeging,postcode,plaats`;
                
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
                    aanvraagData.adres = {
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

        // === EENMALIGE OPDRACHT ===
        if (isEenmalig) {
          // Haal opdracht op
          const opdrachtUrl = `${supabaseConfig.url}/rest/v1/opdrachten?id=eq.${match.opdracht_id}&select=type,gebruiker_id,gewenste_datum,gegevens,is_spoed,prioriteit`;
          
          const opdrachtResp = await httpClient(opdrachtUrl, {
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${authToken}`,
            }
          }, correlationId);

          if (opdrachtResp.ok) {
            const opdrachten = await opdrachtResp.json();
            const opdracht = opdrachten[0];

            if (opdracht) {
              aanvraagData.type_schoonmaak = opdracht.type;
              aanvraagData.gewenste_datum = opdracht.gewenste_datum;
              aanvraagData.is_spoed = opdracht.is_spoed;
              aanvraagData.prioriteit = opdracht.prioriteit;

              // Extract uren uit gegevens JSONB (patroon: {type}_uren)
              if (opdracht.gegevens) {
                const urenVeld = Object.keys(opdracht.gegevens).find(key => key.endsWith('_uren'));
                if (urenVeld) {
                  aanvraagData.uren = opdracht.gegevens[urenVeld];
                  console.log(`📊 [Schoonmaker Aanvragen] Extracted uren: ${aanvraagData.uren} from ${urenVeld} [${correlationId}]`);
                }
              }

              // Haal klant info op via gebruiker_id
              if (opdracht.gebruiker_id) {
                const userUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${opdracht.gebruiker_id}&select=voornaam,achternaam,email,telefoon,adres_id`;
                
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
                    aanvraagData.klant = {
                      voornaam: user.voornaam,
                      achternaam: user.achternaam,
                      email: user.email,
                      telefoon: user.telefoon
                    };

                    // Haal adres op via user_profiles.adres_id
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
                          aanvraagData.adres = {
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
            }
          }
        }

        aanvragen.push(aanvraagData);

      } catch (matchError) {
        console.error(`❌ [Schoonmaker Aanvragen] Error processing match ${match.id} [${correlationId}]`, matchError);
        // Continue met volgende match
      }
    }

    // === SORTEER: Open eerst, dan op datum ===
    aanvragen.sort((a, b) => {
      // Status priority: open = 0, rest = 1
      const statusA = a.status === 'open' ? 0 : 1;
      const statusB = b.status === 'open' ? 0 : 1;
      
      if (statusA !== statusB) {
        return statusA - statusB;
      }
      
      // Binnen zelfde status groep: nieuwste eerst
      return new Date(b.aangemaakt_op) - new Date(a.aangemaakt_op);
    });

    console.log(`✅ [Schoonmaker Aanvragen] ========== SUCCESS ========== [${correlationId}]`);
    console.log(`📊 [Schoonmaker Aanvragen] Returning ${aanvragen.length} aanvragen (${aanvragen.filter(a => a.status === 'open').length} open)`);

    return res.status(200).json({
      success: true,
      data: aanvragen
    });

  } catch (error) {
    console.error(`❌ [Schoonmaker Aanvragen] ========== ERROR ========== [${correlationId}]`, error);
    return res.status(500).json({
      error: 'Er ging iets mis bij het ophalen van aanvragen',
      details: error.message
    });
  }
}

// Export met auth middleware - alleen schoonmakers
export default withAuth(aanvragenHandler, { roles: ['schoonmaker'] });
