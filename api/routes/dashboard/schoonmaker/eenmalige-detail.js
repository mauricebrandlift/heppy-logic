// api/routes/dashboard/schoonmaker/eenmalige-detail.js
/**
 * Dashboard eenmalige schoonmaak detail endpoint voor schoonmakers
 * Retourneert alle details van één aangenomen eenmalige opdracht
 */
import { withAuth } from '../../../utils/authMiddleware.js';
import { httpClient } from '../../../utils/apiClient.js';
import { supabaseConfig } from '../../../config/index.js';

function getSchoonmaakStatus(opdracht, match, schoonmakerId) {
  const gekoppeldAanDezeSchoonmaker =
    match?.schoonmaker_id === schoonmakerId &&
    match?.status === 'geaccepteerd' &&
    (!opdracht?.schoonmaker_id || opdracht.schoonmaker_id === schoonmakerId);

  if (opdracht?.status === 'geannuleerd' || !gekoppeldAanDezeSchoonmaker) {
    return {
      code: 'geannuleerd',
      label: 'Geannuleerd',
      className: 'is-unactive'
    };
  }

  if (opdracht?.status === 'voltooid') {
    return {
      code: 'uitgevoerd',
      label: 'Uitgevoerd',
      className: 'is-done'
    };
  }

  if (!opdracht?.gewenste_datum) {
    return {
      code: 'nog_inplannen',
      label: 'Nog inplannen',
      className: 'is-pending'
    };
  }

  return {
    code: 'gepland',
    label: 'Gepland',
    className: 'is-active'
  };
}

async function getBetalingStatusForOpdracht(opdrachtId, schoonmakerId, authToken, correlationId) {
  const defaultStatus = {
    code: 'nog_niet_meegenomen',
    label: 'Nog niet meegenomen',
    className: 'is-pending'
  };

  if (!opdrachtId) {
    return defaultStatus;
  }

  const betalingenUrl = `${supabaseConfig.url}/rest/v1/betalingen?opdracht_id=eq.${opdrachtId}&select=id,status`;
  const betalingenResp = await httpClient(betalingenUrl, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${authToken}`,
    }
  }, correlationId);

  if (!betalingenResp.ok) {
    throw new Error('Kon betalingen niet ophalen');
  }

  const betalingen = await betalingenResp.json();
  if (!betalingen.length) {
    return defaultStatus;
  }

  const betalingIds = betalingen.map(betaling => betaling.id).filter(Boolean);
  if (!betalingIds.length) {
    return defaultStatus;
  }

  const betalingIdsInFilter = betalingIds.join(',');
  const transactiesUrl = `${supabaseConfig.url}/rest/v1/uitbetaling_transacties?betaling_id=in.(${betalingIdsInFilter})&select=betaling_id,uitbetaling_id`;
  const transactiesResp = await httpClient(transactiesUrl, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${authToken}`,
    }
  }, correlationId);

  if (!transactiesResp.ok) {
    throw new Error('Kon uitbetaling transacties niet ophalen');
  }

  const transacties = await transactiesResp.json();
  if (!transacties.length) {
    return defaultStatus;
  }

  const uitbetalingIds = [...new Set(transacties.map(transactie => transactie.uitbetaling_id).filter(Boolean))];
  if (!uitbetalingIds.length) {
    return defaultStatus;
  }

  const uitbetalingIdsInFilter = uitbetalingIds.join(',');
  const uitbetalingenUrl = `${supabaseConfig.url}/rest/v1/uitbetalingen?id=in.(${uitbetalingIdsInFilter})&schoonmaker_id=eq.${schoonmakerId}&select=id,status`;
  const uitbetalingenResp = await httpClient(uitbetalingenUrl, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${authToken}`,
    }
  }, correlationId);

  if (!uitbetalingenResp.ok) {
    throw new Error('Kon uitbetalingen niet ophalen');
  }

  const uitbetalingen = await uitbetalingenResp.json();
  if (!uitbetalingen.length) {
    return defaultStatus;
  }

  const statuses = uitbetalingen.map(uitbetaling => uitbetaling.status);

  if (statuses.includes('uitbetaald')) {
    return {
      code: 'uitbetaald',
      label: 'Uitbetaald',
      className: 'is-done'
    };
  }

  if (statuses.includes('in afwachting')) {
    return {
      code: 'in_betalingsronde',
      label: 'In betalingsronde',
      className: 'is-active'
    };
  }

  if (statuses.includes('geannuleerd')) {
    return {
      code: 'betalingsronde_geannuleerd',
      label: 'Betalingsronde geannuleerd',
      className: 'is-unactive'
    };
  }

  return {
    code: 'in_betalingsronde',
    label: 'In betalingsronde',
    className: 'is-active'
  };
}

async function eenmaligeDetailHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `schoonmaker-eenmalige-detail-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    console.log(`🔧 [Schoonmaker Eenmalige Detail] ========== START ========== [${correlationId}]`);
    console.log(`👤 [Schoonmaker Eenmalige Detail] User ID: ${req.user.id}`);

    const schoonmakerId = req.user.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!authToken) {
      return res.status(401).json({ error: 'Authenticatie vereist' });
    }

    const matchId = req.query.id;
    if (!matchId) {
      return res.status(400).json({ error: 'Match ID is verplicht' });
    }

    // === STAP 1: Haal match op en verifieer eigenaarschap ===
    console.log(`🔄 [Schoonmaker Eenmalige Detail] Fetching match ${matchId}...`);

    const matchUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_match?id=eq.${matchId}&select=id,schoonmaker_id,opdracht_id,status`;

    const matchResp = await httpClient(matchUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    }, correlationId);

    if (!matchResp.ok) {
      const errorText = await matchResp.text();
      console.error(`❌ [Schoonmaker Eenmalige Detail] Failed to fetch match [${correlationId}]`, errorText);
      throw new Error('Kan match niet ophalen');
    }

    const matches = await matchResp.json();
    const match = matches[0];

    if (!match) {
      return res.status(404).json({ error: 'Match niet gevonden' });
    }

    // Verifieer dat deze schoonmaker eigenaar is van de match
    if (match.schoonmaker_id !== schoonmakerId) {
      console.warn(`⚠️ [Schoonmaker Eenmalige Detail] Unauthorized access attempt by ${schoonmakerId} for match ${matchId} [${correlationId}]`);
      return res.status(403).json({ error: 'Geen toegang tot deze opdracht' });
    }

    if (!match.opdracht_id) {
      return res.status(404).json({ error: 'Geen opdracht gekoppeld aan deze match' });
    }

    // === STAP 2: Haal opdracht details op ===
    console.log(`🔄 [Schoonmaker Eenmalige Detail] Fetching opdracht ${match.opdracht_id}...`);

    const opdrachtUrl = `${supabaseConfig.url}/rest/v1/opdrachten?id=eq.${match.opdracht_id}&select=id,type,gebruiker_id,schoonmaker_id,gewenste_datum,gegevens,status,opmerking,is_spoed`;

    const opdrachtResp = await httpClient(opdrachtUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    }, correlationId);

    if (!opdrachtResp.ok) {
      const errorText = await opdrachtResp.text();
      console.error(`❌ [Schoonmaker Eenmalige Detail] Failed to fetch opdracht [${correlationId}]`, errorText);
      throw new Error('Kan opdracht niet ophalen');
    }

    const opdrachten = await opdrachtResp.json();
    const opdracht = opdrachten[0];

    if (!opdracht) {
      return res.status(404).json({ error: 'Opdracht niet gevonden' });
    }

    // Extract uren uit gegevens JSONB (patroon: {type}_uren)
    let uren = null;
    if (opdracht.gegevens) {
      const urenVeld = Object.keys(opdracht.gegevens).find(key => key.endsWith('_uren'));
      if (urenVeld) {
        uren = opdracht.gegevens[urenVeld];
        console.log(`📊 [Schoonmaker Eenmalige Detail] Extracted uren: ${uren} from ${urenVeld} [${correlationId}]`);
      }
    }

    // === STAP 3: Haal klant info op ===
    console.log(`🔄 [Schoonmaker Eenmalige Detail] Fetching klant ${opdracht.gebruiker_id}...`);

    const userUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${opdracht.gebruiker_id}&select=voornaam,achternaam,email,telefoon,profielfoto,adres_id`;

    const userResp = await httpClient(userUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    }, correlationId);

    let klant = null;
    let adres = null;

    if (userResp.ok) {
      const users = await userResp.json();
      const user = users[0];

      if (user) {
        klant = {
          voornaam: user.voornaam,
          achternaam: user.achternaam,
          email: user.email,
          telefoon: user.telefoon,
          profielfoto: user.profielfoto || null
        };

        // === STAP 4: Haal adres op via adres_id van klant ===
        if (user.adres_id) {
          console.log(`🔄 [Schoonmaker Eenmalige Detail] Fetching adres ${user.adres_id}...`);

          const adresUrl = `${supabaseConfig.url}/rest/v1/adressen?id=eq.${user.adres_id}&select=straat,huisnummer,toevoeging,postcode,plaats`;

          const adresResp = await httpClient(adresUrl, {
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${authToken}`,
            }
          }, correlationId);

          if (adresResp.ok) {
            const adressen = await adresResp.json();
            const adresData = adressen[0];
            if (adresData) {
              adres = {
                straat: adresData.straat,
                huisnummer: adresData.huisnummer,
                toevoeging: adresData.toevoeging || null,
                postcode: adresData.postcode,
                plaats: adresData.plaats
              };
              // Klant plaats ook invullen vanuit adres
              klant.plaats = adresData.plaats;
            }
          }
        }
      }
    }

    const schoonmaakStatus = getSchoonmaakStatus(opdracht, match, schoonmakerId);

    let betalingStatus = {
      code: 'onbekend',
      label: 'Onbekend',
      className: 'is-pending'
    };

    try {
      betalingStatus = await getBetalingStatusForOpdracht(opdracht.id, schoonmakerId, authToken, correlationId);
    } catch (betalingError) {
      console.warn(`⚠️ [Schoonmaker Eenmalige Detail] Betaling status fallback [${correlationId}]`, betalingError.message);
    }

    console.log(`✅ [Schoonmaker Eenmalige Detail] ========== SUCCESS ========== [${correlationId}]`);

    return res.status(200).json({
      match_id: match.id,
      opdracht_id: opdracht.id,
      type: opdracht.type,
      status: opdracht.status,
      match_status: match.status,
      gewenste_datum: opdracht.gewenste_datum || null,
      uren: uren,
      opmerking: opdracht.opmerking || null,
      is_spoed: opdracht.is_spoed || false,
      schoonmaak_status: schoonmaakStatus.code,
      schoonmaak_status_label: schoonmaakStatus.label,
      schoonmaak_status_class: schoonmaakStatus.className,
      betaling_status: betalingStatus.code,
      betaling_status_label: betalingStatus.label,
      betaling_status_class: betalingStatus.className,
      adres: adres,
      klant: klant
    });

  } catch (error) {
    console.error(`❌ [Schoonmaker Eenmalige Detail] ========== ERROR ========== [${correlationId}]`, error);
    return res.status(500).json({
      error: 'Er ging iets mis bij het ophalen van de opdracht details',
      details: error.message
    });
  }
}

// Export met auth middleware - alleen schoonmakers
export default withAuth(eenmaligeDetailHandler, { roles: ['schoonmaker'] });
