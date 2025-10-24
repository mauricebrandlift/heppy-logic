/**
 * SchoonmaakMatchService
 * Beheert de koppeling tussen schoonmaak aanvragen en schoonmakers
 */

import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

function uuid(){
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
}

/**
 * Maakt een nieuwe match tussen schoonmaak_aanvraag en schoonmaker
 * 
 * @param {Object} params
 * @param {string} params.aanvraagId - UUID van schoonmaak_aanvraag
 * @param {string|null} params.schoonmakerId - UUID van schoonmaker of null voor "geen voorkeur"
 * @param {string|null} params.abonnementId - UUID van abonnement (optioneel)
 * @param {string} [correlationId] - Voor logging/tracing
 * @returns {Promise<Object>} De aangemaakte match record
 */
export async function create({ aanvraagId, schoonmakerId, abonnementId }, correlationId = '') {
  console.log(`🤝 [SchoonmaakMatchService] Creating match [${correlationId}]`, {
    aanvraagId,
    schoonmakerId: schoonmakerId || 'geen voorkeur',
    abonnementId: abonnementId || 'none'
  });

  // Validatie
  if (!aanvraagId) {
    throw new Error('aanvraagId is verplicht voor match');
  }

  const id = uuid();
  const url = `${supabaseConfig.url}/rest/v1/schoonmaak_match`;
  
  // schoonmakerId mag null zijn (geen voorkeur)
  const body = {
    id,
    schoonmaak_aanvraag_id: aanvraagId,
    schoonmaker_id: schoonmakerId || null,
    abonnement_id: abonnementId || null,
    status: 'open', // Status start als 'open'
    aangemaakt_op: new Date().toISOString(),
    match_datum: null // Wordt gevuld bij acceptatie door schoonmaker
  };

  const resp = await httpClient(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(body)
  }, correlationId);

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`❌ [SchoonmaakMatchService] Create failed [${correlationId}]`, {
      status: resp.status,
      error: errorText,
      aanvraagId,
      schoonmakerId
    });
    throw new Error(`schoonmaak_match insert failed: ${errorText}`);
  }

  console.log(`✅ [SchoonmaakMatchService] Match created: ${id} [${correlationId}]`);
  return { id };
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

  const url = `${supabaseConfig.url}/rest/v1/schoonmaak_match?schoonmaak_aanvraag_id=eq.${aanvraagId}&order=aangemaakt_op.desc`;
  
  const resp = await httpClient(url, {
    method: 'GET',
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`
    }
  }, correlationId);

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`❌ [SchoonmaakMatchService] Query failed [${correlationId}]`, errorText);
    throw new Error(`Fout bij ophalen matches: ${errorText}`);
  }

  const data = await resp.json();
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

  const url = `${supabaseConfig.url}/rest/v1/schoonmaak_match?id=eq.${matchId}`;
  const body = { 
    status: status,
    bijgewerkt_op: new Date().toISOString()
  };

  const resp = await httpClient(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  }, correlationId);

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`❌ [SchoonmaakMatchService] Update failed [${correlationId}]`, errorText);
    throw new Error(`Fout bij updaten match status: ${errorText}`);
  }

  const data = await resp.json();
  console.log(`✅ [SchoonmaakMatchService] Match status updated [${correlationId}]`);
  return data[0] || { id: matchId };
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

  const url = `${supabaseConfig.url}/rest/v1/schoonmaak_match?id=eq.${matchId}`;

  const resp = await httpClient(url, {
    method: 'DELETE',
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`
    }
  }, correlationId);

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`❌ [SchoonmaakMatchService] Delete failed [${correlationId}]`, errorText);
    throw new Error(`Fout bij verwijderen match: ${errorText}`);
  }

  console.log(`✅ [SchoonmaakMatchService] Match deleted [${correlationId}]`);
  return true;
}
