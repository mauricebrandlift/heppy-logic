/**
 * Match Service
 * 
 * Herbruikbare service voor schoonmaak_matches operaties.
 * Gebruikt door zowel aanvraag (abonnement) als opdracht (eenmalig) flows.
 */

import { supabase } from '../config/index.js';
import { emailService } from './emailService.js';

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

  // Fetch match from database
  const { data: match, error: matchError } = await supabase
    .from('schoonmaak_matches')
    .select(`
      *,
      schoonmaker:schoonmakers(id, voornaam, achternaam, email),
      aanvraag:aanvragen(
        id,
        type,
        status,
        gewenste_startweek,
        abonnement:abonnementen(
          id,
          uren_per_week,
          klant:klanten(id, voornaam, achternaam, email, telefoon, adres, postcode, plaats)
        )
      ),
      opdracht:opdrachten(
        id,
        type,
        status,
        gewenste_datum,
        klant:klanten(id, voornaam, achternaam, email, telefoon, adres, postcode, plaats)
      )
    `)
    .eq('id', matchId)
    .single();

  if (matchError || !match) {
    console.error(`[matchService.getMatchDetails] Match not found [${correlationId}]`, matchError);
    throw new Error('Match niet gevonden');
  }

  console.log(`[matchService.getMatchDetails] Match found [${correlationId}]`, {
    match_id: match.id,
    status: match.status,
    type: match.aanvraag_id ? 'aanvraag' : 'opdracht'
  });

  // Determine type and extract relevant data
  const isAanvraag = !!match.aanvraag_id;
  const klant = isAanvraag ? match.aanvraag?.abonnement?.klant : match.opdracht?.klant;

  return {
    match_id: match.id,
    status: match.status,
    type: isAanvraag ? 'aanvraag' : 'opdracht',
    schoonmaker: match.schoonmaker,
    aanvraag: match.aanvraag,
    opdracht: match.opdracht,
    klant: klant,
    created_at: match.created_at
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
    throw new Error(`Match heeft al status '${matchDetails.status}' en kan niet meer worden goedgekeurd`);
  }

  // Update match status to geaccepteerd
  const { data: updatedMatch, error: updateError } = await supabase
    .from('schoonmaak_matches')
    .update({ 
      status: 'geaccepteerd',
      geaccepteerd_op: new Date().toISOString()
    })
    .eq('id', matchId)
    .select()
    .single();

  if (updateError) {
    console.error(`[matchService.approveMatch] Failed to update match [${correlationId}]`, updateError);
    throw new Error('Kon match status niet updaten');
  }

  console.log(`[matchService.approveMatch] Match updated to geaccepteerd [${correlationId}]`);

  // Update aanvraag or opdracht status
  if (matchDetails.type === 'aanvraag') {
    await supabase
      .from('aanvragen')
      .update({ status: 'geaccepteerd' })
      .eq('id', matchDetails.aanvraag.id);

    // Update abonnement with schoonmaker
    if (matchDetails.aanvraag.abonnement) {
      await supabase
        .from('abonnementen')
        .update({ schoonmaker_id: matchDetails.schoonmaker.id })
        .eq('id', matchDetails.aanvraag.abonnement.id);
    }
  } else {
    await supabase
      .from('opdrachten')
      .update({ status: 'geaccepteerd' })
      .eq('id', matchDetails.opdracht.id);
  }

  // Send confirmation emails
  try {
    // Email to klant
    await emailService.sendMatchAcceptedKlant({
      klantEmail: matchDetails.klant.email,
      klantNaam: `${matchDetails.klant.voornaam} ${matchDetails.klant.achternaam}`,
      schoonmakerNaam: `${matchDetails.schoonmaker.voornaam} ${matchDetails.schoonmaker.achternaam}`,
      type: matchDetails.type
    });

    // Email to admin
    await emailService.sendMatchAcceptedAdmin({
      matchId: matchId,
      schoonmakerNaam: `${matchDetails.schoonmaker.voornaam} ${matchDetails.schoonmaker.achternaam}`,
      klantNaam: `${matchDetails.klant.voornaam} ${matchDetails.klant.achternaam}`,
      type: matchDetails.type
    });

    console.log(`[matchService.approveMatch] Confirmation emails sent [${correlationId}]`);
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
    throw new Error(`Match heeft al status '${matchDetails.status}' en kan niet meer worden afgewezen`);
  }

  // Update match status to geweigerd
  const { data: updatedMatch, error: updateError } = await supabase
    .from('schoonmaak_matches')
    .update({ 
      status: 'geweigerd',
      afwijzing_reden: reden,
      afgewezen_op: new Date().toISOString()
    })
    .eq('id', matchId)
    .select()
    .single();

  if (updateError) {
    console.error(`[matchService.rejectMatch] Failed to update match [${correlationId}]`, updateError);
    throw new Error('Kon match status niet updaten');
  }

  console.log(`[matchService.rejectMatch] Match updated to geweigerd [${correlationId}]`);

  // Try to find a new schoonmaker
  let newMatch = null;

  try {
    if (matchDetails.type === 'aanvraag') {
      // Import aanvraagService to reuse findBestSchoonmaker logic
      const { aanvraagService } = await import('./aanvraagService.js');
      
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
    // Email to admin
    await emailService.sendMatchRejectedAdmin({
      matchId: matchId,
      schoonmakerNaam: `${matchDetails.schoonmaker.voornaam} ${matchDetails.schoonmaker.achternaam}`,
      klantNaam: `${matchDetails.klant.voornaam} ${matchDetails.klant.achternaam}`,
      reden: reden,
      type: matchDetails.type
    });

    console.log(`[matchService.rejectMatch] Notification emails sent [${correlationId}]`);
  } catch (emailError) {
    console.error(`[matchService.rejectMatch] Email sending failed [${correlationId}]`, emailError);
  }

  console.log(`[matchService.rejectMatch] SUCCESS [${correlationId}]`);

  return {
    rejected_match_id: updatedMatch.id,
    new_match: newMatch,
    requires_admin_action: !newMatch
  };
}

export const matchService = {
  getMatchDetails,
  approveMatch,
  rejectMatch
};
