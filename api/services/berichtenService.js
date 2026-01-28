/**
 * BerichtenService
 * Beheert chat berichten tussen klanten en schoonmakers
 */

import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

/**
 * Haal gekoppelde schoonmakers op voor een klant (of klanten voor een schoonmaker)
 * Dit zijn schoonmakers met actieve abonnementen of recente opdrachten
 */
export async function getGekoppeldeGebruikers(userId, correlationId = 'default') {
  console.log(`📋 [BerichtenService] Ophalen gekoppelde gebruikers voor ${userId}`);

  // Haal user rol op
  const userUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${userId}&select=rol`;
  const userResp = await httpClient(userUrl, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
    }
  }, correlationId);

  if (!userResp.ok) {
    throw new Error('User niet gevonden');
  }

  const [user] = await userResp.json();
  const rol = user?.rol;

  if (rol === 'klant') {
    return await getGekoppeldeSchoonmakersVoorKlant(userId, correlationId);
  } else if (rol === 'schoonmaker') {
    return await getGekoppeldeKlantenVoorSchoonmaker(userId, correlationId);
  } else {
    return []; // Admin heeft geen directe koppelingen
  }
}

/**
 * Haal schoonmakers op voor een klant
 */
async function getGekoppeldeSchoonmakersVoorKlant(klantId, correlationId) {
  const schoonmakerIds = new Set();
  const schoonmakerData = {};

  // 1. Haal schoonmakers van actieve abonnementen (via aanvragen)
  const aanvragenUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen?email=eq.(select email from user_profiles where id='${klantId}')&select=id`;
  const aanvragenResp = await httpClient(aanvragenUrl, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
    }
  }, correlationId);

  if (aanvragenResp.ok) {
    const aanvragen = await aanvragenResp.json();
    
    for (const aanvraag of aanvragen) {
      // Haal matches op voor deze aanvraag
      const matchUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_match?schoonmaak_aanvraag_id=eq.${aanvraag.id}&select=schoonmaker_id,abonnement_id`;
      const matchResp = await httpClient(matchUrl, {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }, correlationId);

      if (matchResp.ok) {
        const matches = await matchResp.json();
        
        for (const match of matches) {
          if (!match.schoonmaker_id || !match.abonnement_id) continue;

          // Check of abonnement nog actief is
          const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${match.abonnement_id}&select=status,einddatum`;
          const abonnementResp = await httpClient(abonnementUrl, {
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
            }
          }, correlationId);

          if (abonnementResp.ok) {
            const [abonnement] = await abonnementResp.json();
            
            // Alleen actieve abonnementen OF einddatum in toekomst
            const isActief = abonnement?.status === 'actief' || 
                            (abonnement?.einddatum && new Date(abonnement.einddatum) > new Date());
            
            if (isActief) {
              schoonmakerIds.add(match.schoonmaker_id);
              if (!schoonmakerData[match.schoonmaker_id]) {
                schoonmakerData[match.schoonmaker_id] = { matchId: match.id };
              }
            }
          }
        }
      }
    }
  }

  // 2. Haal schoonmakers van recente opdrachten (laatste 3 maanden)
  const drieWeken = new Date();
  drieWeken.setDate(drieWeken.getDate() - 21);
  const cutoffDate = drieWeken.toISOString().split('T')[0];

  const opdrachtenUrl = `${supabaseConfig.url}/rest/v1/opdrachten?gebruiker_id=eq.${klantId}&uitgevoerd_op=gte.${cutoffDate}&select=id`;
  const opdrachtenResp = await httpClient(opdrachtenUrl, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
    }
  }, correlationId);

  if (opdrachtenResp.ok) {
    const opdrachten = await opdrachtenResp.json();
    
    for (const opdracht of opdrachten) {
      const matchUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_match?opdracht_id=eq.${opdracht.id}&select=schoonmaker_id,id`;
      const matchResp = await httpClient(matchUrl, {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }, correlationId);

      if (matchResp.ok) {
        const [match] = await matchResp.json();
        if (match?.schoonmaker_id) {
          schoonmakerIds.add(match.schoonmaker_id);
          if (!schoonmakerData[match.schoonmaker_id]) {
            schoonmakerData[match.schoonmaker_id] = { matchId: match.id };
          }
        }
      }
    }
  }

  // 3. Haal user profiles op voor alle schoonmakers
  if (schoonmakerIds.size === 0) {
    return [];
  }

  const schoonmakerIdsArray = Array.from(schoonmakerIds);
  const profilesUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=in.(${schoonmakerIdsArray.join(',')})&select=id,voornaam,achternaam,email,foto_url`;
  const profilesResp = await httpClient(profilesUrl, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
    }
  }, correlationId);

  if (!profilesResp.ok) {
    return [];
  }

  const profiles = await profilesResp.json();

  // 4. Haal laatste bericht per schoonmaker op
  const result = [];
  for (const profile of profiles) {
    const laatsteBerichtUrl = `${supabaseConfig.url}/rest/v1/berichten?or=(verzender_id.eq.${profile.id},ontvanger_id.eq.${profile.id})&or=(verzender_id.eq.${klantId},ontvanger_id.eq.${klantId})&select=inhoud,aangemaakt_op,verzender_id&order=aangemaakt_op.desc&limit=1`;
    const berichtResp = await httpClient(laatsteBerichtUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
      }
    }, correlationId);

    let laatsteBericht = null;
    if (berichtResp.ok) {
      const [bericht] = await berichtResp.json();
      laatsteBericht = bericht || null;
    }

    // Tel ongelezen berichten van deze schoonmaker
    const ongelezenUrl = `${supabaseConfig.url}/rest/v1/berichten?verzender_id=eq.${profile.id}&ontvanger_id=eq.${klantId}&gelezen_op=is.null&select=id`;
    const ongelezenResp = await httpClient(ongelezenUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
      }
    }, correlationId);

    let ongelezenCount = 0;
    if (ongelezenResp.ok) {
      const ongelezen = await ongelezenResp.json();
      ongelezenCount = ongelezen.length;
    }

    result.push({
      id: profile.id,
      voornaam: profile.voornaam,
      achternaam: profile.achternaam,
      email: profile.email,
      foto_url: profile.foto_url,
      laatsteBericht,
      ongelezenCount,
      matchId: schoonmakerData[profile.id]?.matchId
    });
  }

  // Sorteer op laatste activiteit (laatste bericht eerst)
  result.sort((a, b) => {
    if (!a.laatsteBericht && !b.laatsteBericht) return 0;
    if (!a.laatsteBericht) return 1;
    if (!b.laatsteBericht) return -1;
    return new Date(b.laatsteBericht.aangemaakt_op) - new Date(a.laatsteBericht.aangemaakt_op);
  });

  console.log(`✅ [BerichtenService] ${result.length} gekoppelde schoonmakers gevonden`);
  return result;
}

/**
 * Haal klanten op voor een schoonmaker
 */
async function getGekoppeldeKlantenVoorSchoonmaker(schoonmakerId, correlationId) {
  const klantIds = new Set();
  const klantData = {};

  // 1. Haal klanten van actieve matches
  const matchesUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_match?schoonmaker_id=eq.${schoonmakerId}&select=id,schoonmaak_aanvraag_id,opdracht_id,abonnement_id`;
  const matchesResp = await httpClient(matchesUrl, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
    }
  }, correlationId);

  if (!matchesResp.ok) {
    return [];
  }

  const matches = await matchesResp.json();

  for (const match of matches) {
    let klantId = null;

    // Via abonnement
    if (match.abonnement_id) {
      const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${match.abonnement_id}&select=gebruiker_id,status,einddatum`;
      const abonnementResp = await httpClient(abonnementUrl, {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }, correlationId);

      if (abonnementResp.ok) {
        const [abonnement] = await abonnementResp.json();
        const isActief = abonnement?.status === 'actief' || 
                        (abonnement?.einddatum && new Date(abonnement.einddatum) > new Date());
        
        if (isActief) {
          klantId = abonnement.gebruiker_id;
        }
      }
    }

    // Via opdracht (laatste 3 weken)
    if (!klantId && match.opdracht_id) {
      const drieWeken = new Date();
      drieWeken.setDate(drieWeken.getDate() - 21);
      const cutoffDate = drieWeken.toISOString().split('T')[0];

      const opdrachtUrl = `${supabaseConfig.url}/rest/v1/opdrachten?id=eq.${match.opdracht_id}&uitgevoerd_op=gte.${cutoffDate}&select=gebruiker_id`;
      const opdrachtResp = await httpClient(opdrachtUrl, {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }, correlationId);

      if (opdrachtResp.ok) {
        const [opdracht] = await opdrachtResp.json();
        if (opdracht) {
          klantId = opdracht.gebruiker_id;
        }
      }
    }

    if (klantId) {
      klantIds.add(klantId);
      if (!klantData[klantId]) {
        klantData[klantId] = { matchId: match.id };
      }
    }
  }

  if (klantIds.size === 0) {
    return [];
  }

  // 2. Haal user profiles op
  const klantIdsArray = Array.from(klantIds);
  const profilesUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=in.(${klantIdsArray.join(',')})&select=id,voornaam,achternaam,email,foto_url`;
  const profilesResp = await httpClient(profilesUrl, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
    }
  }, correlationId);

  if (!profilesResp.ok) {
    return [];
  }

  const profiles = await profilesResp.json();

  // 3. Haal laatste bericht + ongelezen count
  const result = [];
  for (const profile of profiles) {
    const laatsteBerichtUrl = `${supabaseConfig.url}/rest/v1/berichten?or=(verzender_id.eq.${profile.id},ontvanger_id.eq.${profile.id})&or=(verzender_id.eq.${schoonmakerId},ontvanger_id.eq.${schoonmakerId})&select=inhoud,aangemaakt_op,verzender_id&order=aangemaakt_op.desc&limit=1`;
    const berichtResp = await httpClient(laatsteBerichtUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
      }
    }, correlationId);

    let laatsteBericht = null;
    if (berichtResp.ok) {
      const [bericht] = await berichtResp.json();
      laatsteBericht = bericht || null;
    }

    const ongelezenUrl = `${supabaseConfig.url}/rest/v1/berichten?verzender_id=eq.${profile.id}&ontvanger_id=eq.${schoonmakerId}&gelezen_op=is.null&select=id`;
    const ongelezenResp = await httpClient(ongelezenUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
      }
    }, correlationId);

    let ongelezenCount = 0;
    if (ongelezenResp.ok) {
      const ongelezen = await ongelezenResp.json();
      ongelezenCount = ongelezen.length;
    }

    result.push({
      id: profile.id,
      voornaam: profile.voornaam,
      achternaam: profile.achternaam,
      email: profile.email,
      foto_url: profile.foto_url,
      laatsteBericht,
      ongelezenCount,
      matchId: klantData[profile.id]?.matchId
    });
  }

  // Sorteer op laatste activiteit
  result.sort((a, b) => {
    if (!a.laatsteBericht && !b.laatsteBericht) return 0;
    if (!a.laatsteBericht) return 1;
    if (!b.laatsteBericht) return -1;
    return new Date(b.laatsteBericht.aangemaakt_op) - new Date(a.laatsteBericht.aangemaakt_op);
  });

  console.log(`✅ [BerichtenService] ${result.length} gekoppelde klanten gevonden`);
  return result;
}

/**
 * Haal chat berichten op tussen twee gebruikers
 */
export async function getChatBerichten(userId, anderePersoonId, correlationId = 'default') {
  console.log(`💬 [BerichtenService] Ophalen berichten tussen ${userId} en ${anderePersoonId}`);

  const url = `${supabaseConfig.url}/rest/v1/berichten?or=(and(verzender_id.eq.${userId},ontvanger_id.eq.${anderePersoonId}),and(verzender_id.eq.${anderePersoonId},ontvanger_id.eq.${userId}))&select=id,verzender_id,ontvanger_id,inhoud,aangemaakt_op,gelezen_op&order=aangemaakt_op.desc`;
  
  const response = await httpClient(url, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
    }
  }, correlationId);

  if (!response.ok) {
    throw new Error('Berichten ophalen mislukt');
  }

  const berichten = await response.json();
  console.log(`✅ [BerichtenService] ${berichten.length} berichten opgehaald`);
  
  return berichten;
}

/**
 * Verstuur een nieuw bericht
 */
export async function verstuurBericht({ verzenderId, ontvangerId, inhoud, matchId, opdrachtId }, correlationId = 'default') {
  console.log(`📤 [BerichtenService] Verstuur bericht van ${verzenderId} naar ${ontvangerId}`);

  const berichtData = {
    id: crypto.randomUUID(),
    verzender_id: verzenderId,
    ontvanger_id: ontvangerId,
    inhoud: inhoud.trim(),
    schoonmaak_match_id: matchId || null,
    opdracht_id: opdrachtId || null
  };

  const url = `${supabaseConfig.url}/rest/v1/berichten`;
  const response = await httpClient(url, {
    method: 'POST',
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(berichtData)
  }, correlationId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bericht versturen mislukt: ${errorText}`);
  }

  const [bericht] = await response.json();
  console.log(`✅ [BerichtenService] Bericht verstuurd: ${bericht.id}`);
  
  return bericht;
}

/**
 * Markeer berichten als gelezen
 */
export async function markeerBerichtenAlsGelezen(userId, anderePersoonId, correlationId = 'default') {
  console.log(`👁️ [BerichtenService] Markeer berichten als gelezen voor ${userId} van ${anderePersoonId}`);

  const url = `${supabaseConfig.url}/rest/v1/berichten?verzender_id=eq.${anderePersoonId}&ontvanger_id=eq.${userId}&gelezen_op=is.null`;
  
  const response = await httpClient(url, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ gelezen_op: new Date().toISOString() })
  }, correlationId);

  if (!response.ok) {
    console.error('⚠️ Berichten markeren als gelezen mislukt (niet-blokkerende fout)');
    return;
  }

  console.log(`✅ [BerichtenService] Berichten gemarkeerd als gelezen`);
}

/**
 * Tel ongelezen berichten voor een gebruiker
 */
export async function telOngelezenBerichten(userId, correlationId = 'default') {
  console.log(`🔢 [BerichtenService] Tel ongelezen berichten voor ${userId}`);

  const url = `${supabaseConfig.url}/rest/v1/berichten?ontvanger_id=eq.${userId}&gelezen_op=is.null&select=id`;
  
  const response = await httpClient(url, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
    }
  }, correlationId);

  if (!response.ok) {
    return 0;
  }

  const berichten = await response.json();
  const count = berichten.length;
  
  console.log(`✅ [BerichtenService] ${count} ongelezen berichten`);
  return count;
}
