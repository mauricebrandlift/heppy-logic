// api/services/notificatieService.js
/**
 * Notificatie Service
 * Beheert notificaties voor klanten, schoonmakers en admin
 */
import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

/**
 * Haal notificaties op voor een gebruiker
 * @param {string} userId - User profile ID
 * @param {Object} options - Filter opties
 * @param {boolean} options.alleenActieVereist - Alleen notificaties die actie vereisen (voor admin)
 * @param {number} options.limit - Max aantal notificaties
 * @returns {Array} Notificaties
 */
export async function getNotificaties(userId, options = {}) {
  const { alleenActieVereist = false, limit = 20 } = options;

  let url = `${supabaseConfig.url}/rest/v1/notificaties?gebruiker_id=eq.${userId}&verwijderd=eq.false&order=aangemaakt_op.desc`;
  
  if (limit) {
    url += `&limit=${limit}`;
  }

  // Admin: alleen actie-vereiste notificaties
  if (alleenActieVereist) {
    const actieTypes = ['match_afgewezen', 'betaling_mislukt'];
    url += `&type=in.(${actieTypes.join(',')})`;
  }

  const response = await httpClient(url, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
    }
  });

  if (!response.ok) {
    throw new Error('Kan notificaties niet ophalen');
  }

  return await response.json();
}

/**
 * Verwijder notificatie (soft delete)
 * @param {string} notificatieId - Notificatie ID
 * @param {string} userId - User profile ID (voor verificatie)
 */
export async function verwijderNotificatie(notificatieId, userId) {
  // Update naar verwijderd = true
  const url = `${supabaseConfig.url}/rest/v1/notificaties?id=eq.${notificatieId}&gebruiker_id=eq.${userId}`;
  
  const response = await httpClient(url, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      verwijderd: true
    })
  });

  if (!response.ok) {
    throw new Error('Kan notificatie niet verwijderen');
  }

  return { success: true };
}

/**
 * Maak nieuwe notificatie aan
 * @param {Object} data - Notificatie data
 * @param {string} data.gebruiker_id - Ontvanger
 * @param {string} data.type - Type notificatie
 * @param {string} data.titel - Titel
 * @param {string} data.bericht - Bericht tekst
 * @param {string} data.link_url - Optionele link
 * @param {string} data.abonnement_id - Optioneel
 * @param {string} data.opdracht_id - Optioneel
 * @param {string} data.match_id - Optioneel
 * @param {string} data.factuur_id - Optioneel
 */
export async function maakNotificatie(data) {
  const url = `${supabaseConfig.url}/rest/v1/notificaties`;
  
  const response = await httpClient(url, {
    method: 'POST',
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kan notificatie niet aanmaken: ${error}`);
  }

  const notificaties = await response.json();
  return notificaties[0];
}

/**
 * Helper: Maak notificatie voor nieuwe match
 */
export async function notificeerNieuweMatch({ matchId, klantId, schoonmakerId, abonnementId, opdrachtId }) {
  const isAbonnement = !!abonnementId;
  const context = isAbonnement ? 'abonnement' : 'opdracht';
  
  // Notificatie voor klant
  await maakNotificatie({
    gebruiker_id: klantId,
    type: 'nieuwe_match',
    titel: 'Je hebt een schoonmaker toegewezen gekregen! 🎉',
    bericht: `Er is een schoonmaker voor je ${context} toegewezen. Je ontvangt binnenkort meer informatie.`,
    link_url: isAbonnement 
      ? `/dashboard/klant/schoonmaak-abonnement?id=${abonnementId}`
      : `/dashboard/klant/opdracht?id=${opdrachtId}`,
    abonnement_id: abonnementId || null,
    opdracht_id: opdrachtId || null,
    match_id: matchId
  });

  // Notificatie voor schoonmaker
  await maakNotificatie({
    gebruiker_id: schoonmakerId,
    type: 'nieuwe_match',
    titel: 'Nieuwe match ontvangen! 🔔',
    bericht: `Je hebt een nieuwe match ontvangen voor een ${context}. Check je email voor details.`,
    link_url: `/schoonmaak-actie?match_id=${matchId}`,
    abonnement_id: abonnementId || null,
    opdracht_id: opdrachtId || null,
    match_id: matchId
  });
}

/**
 * Helper: Maak notificatie voor geaccepteerde match
 */
export async function notificeerMatchGeaccepteerd({ matchId, klantId, abonnementId, opdrachtId }) {
  const isAbonnement = !!abonnementId;
  
  await maakNotificatie({
    gebruiker_id: klantId,
    type: 'match_geaccepteerd',
    titel: 'Je schoonmaker heeft de match geaccepteerd! ✅',
    bericht: 'Goed nieuws! Je schoonmaker heeft de match geaccepteerd en jullie kunnen binnenkort van start.',
    link_url: isAbonnement 
      ? `/dashboard/klant/schoonmaak-abonnement?id=${abonnementId}`
      : `/dashboard/klant/opdracht?id=${opdrachtId}`,
    abonnement_id: abonnementId || null,
    opdracht_id: opdrachtId || null,
    match_id: matchId
  });
}

/**
 * Helper: Maak notificatie voor afgewezen match
 */
export async function notificeerMatchAfgewezen({ matchId, klantId, adminId, abonnementId, opdrachtId }) {
  const isAbonnement = !!abonnementId;
  
  // Notificatie voor klant
  await maakNotificatie({
    gebruiker_id: klantId,
    type: 'match_afgewezen',
    titel: 'We zoeken een nieuwe schoonmaker voor je',
    bericht: 'De schoonmaker kon helaas niet met je match aan de slag. Geen zorgen, we zoeken een nieuwe match voor je!',
    link_url: isAbonnement 
      ? `/dashboard/klant/schoonmaak-abonnement?id=${abonnementId}`
      : `/dashboard/klant/opdracht?id=${opdrachtId}`,
    abonnement_id: abonnementId || null,
    opdracht_id: opdrachtId || null,
    match_id: matchId
  });

  // Notificatie voor admin
  if (adminId) {
    await maakNotificatie({
      gebruiker_id: adminId,
      type: 'match_afgewezen',
      titel: '⚠️ Match afgewezen - actie vereist',
      bericht: 'Een schoonmaker heeft een match afgewezen. Controleer of er automatisch een nieuwe match is gemaakt.',
      link_url: `/dashboard/admin/matches?match_id=${matchId}`,
      abonnement_id: abonnementId || null,
      opdracht_id: opdrachtId || null,
      match_id: matchId
    });
  }
}

/**
 * Helper: Maak notificatie voor pauze gestart
 */
export async function notificeerPauzeGestart({ abonnementId, klantId, schoonmakerId, pauzeStartWeek, pauzeStartJaar }) {
  // Notificatie voor klant
  await maakNotificatie({
    gebruiker_id: klantId,
    type: 'pauze_gestart',
    titel: 'Je pauze is bevestigd',
    bericht: `Je abonnement is gepauzeerd vanaf week ${pauzeStartWeek}, ${pauzeStartJaar}.`,
    link_url: `/dashboard/klant/schoonmaak-abonnement?id=${abonnementId}`,
    abonnement_id: abonnementId
  });

  // Notificatie voor schoonmaker (indien toegewezen)
  if (schoonmakerId) {
    await maakNotificatie({
      gebruiker_id: schoonmakerId,
      type: 'pauze_gestart',
      titel: 'Klant heeft pauze ingepland',
      bericht: `Een klant heeft een pauze ingepland vanaf week ${pauzeStartWeek}, ${pauzeStartJaar}.`,
      link_url: `/dashboard/schoonmaker/abonnement?id=${abonnementId}`,
      abonnement_id: abonnementId
    });
  }
}

/**
 * Helper: Maak notificatie voor abonnement opgezegd
 */
export async function notificeerAbonnementOpgezegd({ abonnementId, klantId, schoonmakerId, adminId, opzegWeek, opzegJaar }) {
  // Notificatie voor klant
  await maakNotificatie({
    gebruiker_id: klantId,
    type: 'abonnement_opgezegd',
    titel: 'Je opzegging is bevestigd',
    bericht: `Je abonnement is opgezegd per week ${opzegWeek}, ${opzegJaar}. Bedankt voor je vertrouwen!`,
    link_url: `/dashboard/klant/schoonmaak-abonnement?id=${abonnementId}`,
    abonnement_id: abonnementId
  });

  // Notificatie voor schoonmaker
  if (schoonmakerId) {
    await maakNotificatie({
      gebruiker_id: schoonmakerId,
      type: 'abonnement_opgezegd',
      titel: 'Abonnement opgezegd',
      bericht: `Een klant heeft het abonnement opgezegd per week ${opzegWeek}, ${opzegJaar}.`,
      link_url: `/dashboard/schoonmaker/abonnement?id=${abonnementId}`,
      abonnement_id: abonnementId
    });
  }

  // Notificatie voor admin
  if (adminId) {
    await maakNotificatie({
      gebruiker_id: adminId,
      type: 'abonnement_opgezegd',
      titel: 'Abonnement opgezegd',
      bericht: `Een klant heeft een abonnement opgezegd. Bekijk de exit survey indien beschikbaar.`,
      link_url: `/dashboard/admin/abonnementen?id=${abonnementId}`,
      abonnement_id: abonnementId
    });
  }
}

/**
 * Helper: Maak notificatie voor betaling mislukt
 */
export async function notificeerBetalingMislukt({ klantId, adminId, factuurId, bedrag }) {
  // Notificatie voor klant
  await maakNotificatie({
    gebruiker_id: klantId,
    type: 'betaling_mislukt',
    titel: '❌ Betaling mislukt - actie vereist',
    bericht: `Je betaling van €${(bedrag / 100).toFixed(2)} kon niet worden afgeschreven. Controleer je betaalgegevens.`,
    link_url: `/dashboard/klant/facturen?id=${factuurId}`,
    factuur_id: factuurId
  });

  // Notificatie voor admin
  if (adminId) {
    await maakNotificatie({
      gebruiker_id: adminId,
      type: 'betaling_mislukt',
      titel: '⚠️ Betaling mislukt',
      bericht: `Een betaling van €${(bedrag / 100).toFixed(2)} is mislukt. Check retry status.`,
      link_url: `/dashboard/admin/betalingen?factuur_id=${factuurId}`,
      factuur_id: factuurId
    });
  }
}
