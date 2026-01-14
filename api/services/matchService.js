/**
 * Match Service
 * 
 * Herbruikbare service voor schoonmaak_matches operaties.
 * Gebruikt door zowel aanvraag (abonnement) als opdracht (eenmalig) flows.
 */

import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';
import { sendEmail } from './emailService.js';

/**
 * Get match details met aanvraag/opdracht en klant info
 * @param {string} matchId - UUID van de match
 * @param {string} correlationId - Correlation ID voor logging
 * @returns {Promise<Object>} Match data met alle details
 */
export async function getMatchDetails(matchId, correlationId = 'no-correlation-id') {
  console.log(`[matchService.getMatchDetails] START [${correlationId}]`, { matchId });

  // Validate input
  if (!matchId) {
    throw new Error('Match ID is required');
  }

  // Build query - NOTE: schoonmakers table only has id/bio/status, voornaam/achternaam/email are in user_profiles
  // We need to do multiple queries or simplify the response
  // For now: just get match + basic foreign key data, fetch user_profiles separately
  const matchUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_match?id=eq.${matchId}`;
  
  const matchResp = await httpClient(matchUrl, {
    method: 'GET',
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`
    }
  }, correlationId);

  if (!matchResp.ok) {
    console.error(`[matchService.getMatchDetails] HTTP error [${correlationId}]`, await matchResp.text());
    throw new Error('Failed to fetch match');
  }

  const matches = await matchResp.json();
  if (!matches || matches.length === 0) {
    console.error(`[matchService.getMatchDetails] Match not found [${correlationId}]`);
    const error = new Error('Match niet gevonden');
    error.code = 'MATCH_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const match = matches[0];

  // Fetch related data separately
  const isAanvraag = !!match.schoonmaak_aanvraag_id;
  
  // Fetch schoonmaker user_profile
  let schoonmaker = null;
  if (match.schoonmaker_id) {
    const schoonmakerUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${match.schoonmaker_id}&select=id,voornaam,achternaam,email`;
    const schoonmakerResp = await httpClient(schoonmakerUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    }, correlationId);
    
    if (schoonmakerResp.ok) {
      const schoonmakers = await schoonmakerResp.json();
      schoonmaker = schoonmakers[0] || null;
    }
  }

  // Fetch aanvraag or opdracht
  let aanvraag = null;
  let opdracht = null;

  if (isAanvraag && match.schoonmaak_aanvraag_id) {
    const aanvraagUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen?id=eq.${match.schoonmaak_aanvraag_id}&select=*`;
    const aanvraagResp = await httpClient(aanvraagUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    }, correlationId);
    
    if (aanvraagResp.ok) {
      const aanvragen = await aanvraagResp.json();
      aanvraag = aanvragen[0] || null;
    }
  } else if (match.opdracht_id) {
    const opdrachtUrl = `${supabaseConfig.url}/rest/v1/opdrachten?id=eq.${match.opdracht_id}&select=*`;
    const opdrachtResp = await httpClient(opdrachtUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    }, correlationId);
    
    if (opdrachtResp.ok) {
      const opdrachten = await opdrachtResp.json();
      opdracht = opdrachten[0] || null;
    }
  }

  console.log(`[matchService.getMatchDetails] Match found [${correlationId}]`, {
    match_id: match.id,
    status: match.status,
    type: isAanvraag ? 'aanvraag' : 'opdracht',
    has_schoonmaker: !!schoonmaker,
    has_aanvraag: !!aanvraag,
    has_opdracht: !!opdracht
  });

  return {
    match_id: match.id,
    status: match.status,
    type: isAanvraag ? 'aanvraag' : 'opdracht',
    schoonmaker: schoonmaker,
    aanvraag: aanvraag,
    opdracht: opdracht,
    created_at: match.aangemaakt_op
  };
}

/**
 * Approve match via match_id
 * @param {string} matchId - UUID van de match
 * @param {string} correlationId - Correlation ID voor logging
 * @returns {Promise<Object>} Result met match, aanvraag/opdracht, schoonmaker
 */
export async function approveMatch(matchId, correlationId = 'no-correlation-id') {
  console.log(`[matchService.approveMatch] START [${correlationId}]`, { matchId });

  // Get match details first
  const matchDetails = await getMatchDetails(matchId, correlationId);

  // Check if match is still open
  if (matchDetails.status !== 'open') {
    console.warn(`[matchService.approveMatch] Match not open [${correlationId}]`, {
      match_id: matchId,
      current_status: matchDetails.status
    });
    const error = new Error(`Match heeft al status '${matchDetails.status}' en kan niet meer worden goedgekeurd`);
    error.code = 'MATCH_ALREADY_PROCESSED';
    throw error;
  }

  // Update match status to geaccepteerd
  const updateUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_match?id=eq.${matchId}`;
  const updateResp = await httpClient(updateUrl, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseConfig.serviceRoleKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      status: 'geaccepteerd',
      match_datum: new Date().toISOString(),
      bijgewerkt_op: new Date().toISOString()
    })
  }, correlationId);

  if (!updateResp.ok) {
    console.error(`[matchService.approveMatch] Failed to update match [${correlationId}]`, await updateResp.text());
    throw new Error('Kon match status niet updaten');
  }

  const updatedMatches = await updateResp.json();
  const updatedMatch = updatedMatches[0];

  console.log(`[matchService.approveMatch] Match updated to geaccepteerd [${correlationId}]`);

  // Update aanvraag or opdracht status
  if (matchDetails.type === 'aanvraag') {
    const aanvraagUpdateUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen?id=eq.${matchDetails.aanvraag.id}`;
    await httpClient(aanvraagUpdateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseConfig.serviceRoleKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'geaccepteerd' })
    }, correlationId);

    // Update abonnement with schoonmaker if exists
    if (match.abonnement_id) {
      const abonnementUpdateUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${match.abonnement_id}`;
      await httpClient(abonnementUpdateUrl, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseConfig.serviceRoleKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          schoonmaker_id: match.schoonmaker_id,
          status: 'actief'
        })
      }, correlationId);
    }
  } else {
    // For opdrachten: status options are 'aangevraagd', 'gepland', 'voltooid', 'geannuleerd'
    const opdrachtUpdateUrl = `${supabaseConfig.url}/rest/v1/opdrachten?id=eq.${matchDetails.opdracht.id}`;
    await httpClient(opdrachtUpdateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseConfig.serviceRoleKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        status: 'gepland',
        schoonmaker_id: match.schoonmaker_id
      })
    }, correlationId);
  }

  // Send confirmation emails
  try {
    // Get klant email from aanvraag or opdracht
    const klantEmail = matchDetails.type === 'aanvraag' 
      ? matchDetails.aanvraag?.email 
      : matchDetails.opdracht?.email;
    
    const klantNaam = matchDetails.type === 'aanvraag'
      ? `${matchDetails.aanvraag?.voornaam || ''} ${matchDetails.aanvraag?.achternaam || ''}`.trim()
      : 'klant'; // Opdrachten hebben geen voornaam/achternaam in tabel
    
    if (klantEmail && matchDetails.schoonmaker) {
      await sendEmail({
        to: klantEmail,
        subject: 'Schoonmaker geaccepteerd',
        html: `<p>Beste ${klantNaam},</p>
               <p>Uw ${matchDetails.type === 'aanvraag' ? 'abonnement' : 'opdracht'} is geaccepteerd door ${matchDetails.schoonmaker.voornaam} ${matchDetails.schoonmaker.achternaam}.</p>`
      });

      console.log(`[matchService.approveMatch] Confirmation emails sent [${correlationId}]`);
    }
  } catch (emailError) {
    console.error(`[matchService.approveMatch] Email sending failed [${correlationId}]`, emailError);
    // Don't throw - match is already approved
  }

  console.log(`[matchService.approveMatch] SUCCESS [${correlationId}]`);

  return {
    match: updatedMatch,
    schoonmaker: matchDetails.schoonmaker,
    aanvraag: matchDetails.aanvraag,
    opdracht: matchDetails.opdracht,
    abonnement: matchDetails.aanvraag?.abonnement
  };
}

/**
 * Reject match via match_id
 * @param {string} matchId - UUID van de match
 * @param {string} reden - Reden voor afwijzing
 * @param {string} correlationId - Correlation ID voor logging
 * @returns {Promise<Object>} Result met rejected match en optioneel nieuwe match
 */
export async function rejectMatch(matchId, reden, correlationId = 'no-correlation-id') {
  console.log(`[matchService.rejectMatch] START [${correlationId}]`, { matchId, reden });

  // Get match details first
  const matchDetails = await getMatchDetails(matchId, correlationId);

  // Check if match is still open
  if (matchDetails.status !== 'open') {
    console.warn(`[matchService.rejectMatch] Match not open [${correlationId}]`, {
      match_id: matchId,
      current_status: matchDetails.status
    });
    const error = new Error(`Match heeft al status '${matchDetails.status}' en kan niet meer worden afgewezen`);
    error.code = 'MATCH_ALREADY_PROCESSED';
    throw error;
  }

  // Update match status to geweigerd
  const updateUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_match?id=eq.${matchId}`;
  const updateResp = await httpClient(updateUrl, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseConfig.serviceRoleKey,
      'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      status: 'geweigerd',
      afwijzing_reden: reden,
      bijgewerkt_op: new Date().toISOString()
    })
  }, correlationId);

  if (!updateResp.ok) {
    console.error(`[matchService.rejectMatch] Failed to update match [${correlationId}]`, await updateResp.text());
    throw new Error('Kon match status niet updaten');
  }

  const updatedMatches = await updateResp.json();
  const updatedMatch = updatedMatches[0];

  console.log(`[matchService.rejectMatch] Match updated to geweigerd [${correlationId}]`);

  // Try to find a new schoonmaker
  let newMatch = null;

  try {
    if (matchDetails.type === 'aanvraag') {
      // Import aanvraagService to reuse findBestSchoonmaker logic
      // const { aanvraagService } = await import('./aanvraagService.js');
      
      // This would need to be implemented in aanvraagService
      // For now, we'll just set requires_admin_action flag
      console.log(`[matchService.rejectMatch] Auto-rematch for aanvraag not implemented yet [${correlationId}]`);
    } else {
      // Same for opdracht
      console.log(`[matchService.rejectMatch] Auto-rematch for opdracht not implemented yet [${correlationId}]`);
    }
  } catch (rematchError) {
    console.error(`[matchService.rejectMatch] Rematch failed [${correlationId}]`, rematchError);
  }

  // Send notification emails
  try {
    // Get klant info from aanvraag or opdracht  
    const klantNaam = matchDetails.type === 'aanvraag'
      ? `${matchDetails.aanvraag?.voornaam || ''} ${matchDetails.aanvraag?.achternaam || ''}`.trim()
      : 'klant';
    
    const schoonmakerNaam = matchDetails.schoonmaker 
      ? `${matchDetails.schoonmaker.voornaam} ${matchDetails.schoonmaker.achternaam}`
      : 'onbekend';

    // Email to admin
    await sendEmail({
      to: 'admin@heppy-schoonmaak.nl',
      subject: 'Match afgewezen',
      html: `<p>Match ${matchId} is afgewezen door ${schoonmakerNaam}.</p>
             <p>Reden: ${reden}</p>
             <p>Klant: ${klantNaam}</p>`
    });

    console.log(`[matchService.rejectMatch] Notification emails sent [${correlationId}]`);
  } catch (emailError) {
    console.error(`[matchService.rejectMatch] Email sending failed [${correlationId}]`, emailError);
    // Don't throw - match is already rejected
  }

  console.log(`[matchService.rejectMatch] SUCCESS [${correlationId}]`);

  return {
    match: updatedMatch,
    schoonmaker: matchDetails.schoonmaker,
    aanvraag: matchDetails.aanvraag,
    opdracht: matchDetails.opdracht,
    newMatch: newMatch
  };
}

export const matchService = {
  getMatchDetails,
  approveMatch,
  rejectMatch
};
