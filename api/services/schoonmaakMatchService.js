/**
 * SchoonmaakMatchService
 * Beheert de koppeling tussen schoonmaak aanvragen en schoonmakers
 */

import { supabase } from '../config/index.js';

/**
 * Maakt een nieuwe match tussen schoonmaak_aanvraag en schoonmaker
 * 
 * @param {Object} params
 * @param {string} params.aanvraagId - UUID van schoonmaak_aanvraag
 * @param {string|null} params.schoonmakerId - UUID van schoonmaker of null voor "geen voorkeur"
 * @param {string} [correlationId] - Voor logging/tracing
 * @returns {Promise<Object>} De aangemaakte match record
 */
export async function create({ aanvraagId, schoonmakerId }, correlationId = '') {
  console.log(`🤝 [SchoonmaakMatchService] Creating match [${correlationId}]`, {
    aanvraagId,
    schoonmakerId: schoonmakerId || 'geen voorkeur'
  });

  // Validatie
  if (!aanvraagId) {
    throw new Error('aanvraagId is verplicht voor match');
  }

  // schoonmakerId mag null zijn (geen voorkeur)
  const data = {
    schoonmaak_aanvraag_id: aanvraagId,
    schoonmaker_id: schoonmakerId || null,
    match_status: 'pending', // kan later worden uitgebreid met 'confirmed', 'rejected', etc.
    match_datum: new Date().toISOString()
  };

  const { data: match, error } = await supabase
    .from('schoonmaak_match')
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error(`❌ [SchoonmaakMatchService] Create failed [${correlationId}]`, {
      error: error.message,
      code: error.code,
      details: error.details,
      aanvraagId,
      schoonmakerId
    });
    throw new Error(`Fout bij aanmaken match: ${error.message}`);
  }

  console.log(`✅ [SchoonmaakMatchService] Match created: ${match.id} [${correlationId}]`);
  return match;
}

/**
 * Haalt match(es) op voor een specifieke aanvraag
 * 
 * @param {string} aanvraagId - UUID van schoonmaak_aanvraag
 * @param {string} [correlationId] - Voor logging/tracing
 * @returns {Promise<Array>} Array van match records
 */
export async function findByAanvraagId(aanvraagId, correlationId = '') {
  console.log(`🔍 [SchoonmaakMatchService] Finding matches for aanvraag ${aanvraagId} [${correlationId}]`);

  const { data, error } = await supabase
    .from('schoonmaak_match')
    .select('*')
    .eq('schoonmaak_aanvraag_id', aanvraagId)
    .order('match_datum', { ascending: false });

  if (error) {
    console.error(`❌ [SchoonmaakMatchService] Query failed [${correlationId}]`, error);
    throw new Error(`Fout bij ophalen matches: ${error.message}`);
  }

  console.log(`✅ [SchoonmaakMatchService] Found ${data?.length || 0} match(es) [${correlationId}]`);
  return data || [];
}

/**
 * Update match status (bijvoorbeeld van 'pending' naar 'confirmed')
 * 
 * @param {string} matchId - UUID van match record
 * @param {string} status - Nieuwe status ('pending', 'confirmed', 'rejected', etc.)
 * @param {string} [correlationId] - Voor logging/tracing
 * @returns {Promise<Object>} De geüpdatete match record
 */
export async function updateStatus(matchId, status, correlationId = '') {
  console.log(`📝 [SchoonmaakMatchService] Updating match ${matchId} status to ${status} [${correlationId}]`);

  const { data: match, error } = await supabase
    .from('schoonmaak_match')
    .update({ match_status: status })
    .eq('id', matchId)
    .select()
    .single();

  if (error) {
    console.error(`❌ [SchoonmaakMatchService] Update failed [${correlationId}]`, error);
    throw new Error(`Fout bij updaten match status: ${error.message}`);
  }

  console.log(`✅ [SchoonmaakMatchService] Match status updated [${correlationId}]`);
  return match;
}

/**
 * Verwijdert een match (soft delete mogelijk door status te updaten, of hard delete)
 * 
 * @param {string} matchId - UUID van match record
 * @param {string} [correlationId] - Voor logging/tracing
 * @returns {Promise<boolean>} True als succesvol verwijderd
 */
export async function deleteMatch(matchId, correlationId = '') {
  console.log(`🗑️ [SchoonmaakMatchService] Deleting match ${matchId} [${correlationId}]`);

  const { error } = await supabase
    .from('schoonmaak_match')
    .delete()
    .eq('id', matchId);

  if (error) {
    console.error(`❌ [SchoonmaakMatchService] Delete failed [${correlationId}]`, error);
    throw new Error(`Fout bij verwijderen match: ${error.message}`);
  }

  console.log(`✅ [SchoonmaakMatchService] Match deleted [${correlationId}]`);
  return true;
}
