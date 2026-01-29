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

  // 1. Haal schoonmakers van abonnementen
  // Status = actief → altijd tonen
  // Status = gestopt + canceled_at binnen 3 weken → nog tonen (voor nabetaling/contact)
  const drieWekenGeleden = new Date();
  drieWekenGeleden.setDate(drieWekenGeleden.getDate() - 21);

  const abonnementenUrl = `${supabaseConfig.url}/rest/v1/abonnementen?gebruiker_id=eq.${klantId}&select=schoonmaker_id,status,canceled_at`;
  const abonnementenResp = await httpClient(abonnementenUrl, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
    }
  }, correlationId);

  if (abonnementenResp.ok) {
    const abonnementen = await abonnementenResp.json();
    
    for (const abonnement of abonnementen) {
      if (!abonnement.schoonmaker_id) continue;

      // Status actief → altijd tonen
      // Status gestopt + canceled_at binnen 3 weken → nog tonen (voor nabetaling/contact)
      const toonSchoonmaker = 
        abonnement.status === 'actief' ||
        (abonnement.status === 'gestopt' && abonnement.canceled_at && new Date(abonnement.canceled_at) >= drieWekenGeleden);

      if (toonSchoonmaker) {
        schoonmakerIds.add(abonnement.schoonmaker_id);
        if (!schoonmakerData[abonnement.schoonmaker_id]) {
          schoonmakerData[abonnement.schoonmaker_id] = {};
        }
      }
    }
  }

  // 2. Haal schoonmakers van opdrachten
  // gewenste_datum IS NULL → altijd tonen (aanvraag in behandeling)
  // gewenste_datum gevuld → tonen tot 3 weken NA deze datum
  // Status check: geannuleerd → niet tonen, anders wel
  const opdrachtenUrl = `${supabaseConfig.url}/rest/v1/opdrachten?gebruiker_id=eq.${klantId}&select=schoonmaker_id,gewenste_datum,status`;
  const opdrachtenResp = await httpClient(opdrachtenUrl, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
    }
  }, correlationId);

  if (opdrachtenResp.ok) {
    const opdrachten = await opdrachtenResp.json();
    
    for (const opdracht of opdrachten) {
      if (!opdracht.schoonmaker_id) continue;
      
      // Geannuleerde opdrachten niet tonen
      if (opdracht.status === 'geannuleerd') continue;

      let toonSchoonmaker = false;

      // gewenste_datum NULL → altijd tonen (aanvraag nog in behandeling)
      if (!opdracht.gewenste_datum) {
        toonSchoonmaker = true;
      } else {
        // gewenste_datum gevuld → tonen tot 3 weken erna
        const gewensteDatum = new Date(opdracht.gewenste_datum);
        const drieWekenNaOpdracht = new Date(gewensteDatum);
        drieWekenNaOpdracht.setDate(drieWekenNaOpdracht.getDate() + 21);
        
        if (new Date() <= drieWekenNaOpdracht) {
          toonSchoonmaker = true;
        }
      }

      if (toonSchoonmaker) {
        schoonmakerIds.add(opdracht.schoonmaker_id);
        if (!schoonmakerData[opdracht.schoonmaker_id]) {
          schoonmakerData[opdracht.schoonmaker_id] = {};
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

  // 1. Haal klanten van abonnementen
  // Status = actief → altijd tonen
  // Status = gestopt + canceled_at binnen 3 weken → nog tonen
  const drieWekenGeleden = new Date();
  drieWekenGeleden.setDate(drieWekenGeleden.getDate() - 21);

  const abonnementenUrl = `${supabaseConfig.url}/rest/v1/abonnementen?schoonmaker_id=eq.${schoonmakerId}&select=gebruiker_id,status,canceled_at`;
  const abonnementenResp = await httpClient(abonnementenUrl, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
    }
  }, correlationId);

  if (abonnementenResp.ok) {
    const abonnementen = await abonnementenResp.json();
    
    for (const abonnement of abonnementen) {
      if (!abonnement.gebruiker_id) continue;

      // Status actief → altijd tonen
      // Status gestopt + canceled_at binnen 3 weken → tonen
      const toonKlant = 
        abonnement.status === 'actief' ||
        (abonnement.status === 'gestopt' && abonnement.canceled_at && new Date(abonnement.canceled_at) >= drieWekenGeleden);

      if (toonKlant) {
        klantIds.add(abonnement.gebruiker_id);
        if (!klantData[abonnement.gebruiker_id]) {
          klantData[abonnement.gebruiker_id] = {};
        }
      }
    }
  }

  // 2. Haal klanten van opdrachten
  // gewenste_datum IS NULL → altijd tonen
  // gewenste_datum gevuld → tonen tot 3 weken NA deze datum
  // Status check: geannuleerd → niet tonen
  const opdrachtenUrl = `${supabaseConfig.url}/rest/v1/opdrachten?schoonmaker_id=eq.${schoonmakerId}&select=gebruiker_id,gewenste_datum,status`;
  const opdrachtenResp = await httpClient(opdrachtenUrl, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
    }
  }, correlationId);

  if (opdrachtenResp.ok) {
    const opdrachten = await opdrachtenResp.json();
    
    for (const opdracht of opdrachten) {
      if (!opdracht.gebruiker_id) continue;
      
      // Geannuleerde opdrachten niet tonen
      if (opdracht.status === 'geannuleerd') continue;

      let toonKlant = false;

      // gewenste_datum NULL → altijd tonen
      if (!opdracht.gewenste_datum) {
        toonKlant = true;
      } else {
        // gewenste_datum gevuld → tonen tot 3 weken erna
        const gewensteDatum = new Date(opdracht.gewenste_datum);
        const drieWekenNaOpdracht = new Date(gewensteDatum);
        drieWekenNaOpdracht.setDate(drieWekenNaOpdracht.getDate() + 21);
        
        if (new Date() <= drieWekenNaOpdracht) {
          toonKlant = true;
        }
      }

      if (toonKlant) {
        klantIds.add(opdracht.gebruiker_id);
        if (!klantData[opdracht.gebruiker_id]) {
          klantData[opdracht.gebruiker_id] = {};
        }
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
