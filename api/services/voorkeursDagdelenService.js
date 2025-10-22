// voorkeursDagdelenService: create voorkeurs_dagdelen records
// Slaat dagdeel voorkeuren op voor klanten bij schoonmaak aanvragen
import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

function uuid(){
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
}

/**
 * Slaat dagdeel voorkeuren op voor een gebruiker
 * @param {Object} params
 * @param {string} params.gebruikerId - UUID van de gebruiker
 * @param {Object} params.dagdelen - Dagdelen object in database formaat: { "maandag": ["ochtend", "middag"], "dinsdag": ["avond"] }
 * @param {string} correlationId - Correlation ID voor logging
 * @returns {Promise<{ids: string[]}>} - Array van aangemaakte voorkeur IDs
 */
async function createVoorkeuren({ gebruikerId, dagdelen }, correlationId) {
  if (!gebruikerId) {
    throw new Error('gebruikerId is required for voorkeurs_dagdelen');
  }

  // Als dagdelen null of leeg is, sla niets op (geen voorkeuren)
  if (!dagdelen || typeof dagdelen !== 'object' || Object.keys(dagdelen).length === 0) {
    console.log(`[voorkeursDagdelenService] Geen dagdelen voorkeuren om op te slaan voor gebruiker ${gebruikerId}`);
    return { ids: [] };
  }

  const url = `${supabaseConfig.url}/rest/v1/voorkeurs_dagdelen`;
  const ids = [];

  // Voor elke dag met dagdelen, maak een apart record
  for (const [dag, dagdeelLijst] of Object.entries(dagdelen)) {
    if (!Array.isArray(dagdeelLijst) || dagdeelLijst.length === 0) {
      continue; // Skip dagen zonder dagdelen
    }

    // Maak een record per dag met array van dagdelen
    const id = uuid();
    const body = {
      id,
      gebruiker_id: gebruikerId,
      dag: dag, // 'maandag', 'dinsdag', etc.
      dagdelen: dagdeelLijst // ['ochtend', 'middag', 'avond']
    };

    const resp = await httpClient(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(body)
      },
      correlationId
    );

    if (!resp.ok) {
      throw new Error(`voorkeurs_dagdelen insert failed for ${dag}: ${await resp.text()}`);
    }

    ids.push(id);
  }

  console.log(`[voorkeursDagdelenService] Created ${ids.length} voorkeur records for user ${gebruikerId}`);
  return { ids };
}

/**
 * Verwijdert bestaande voorkeuren voor een gebruiker (cleanup voor updates)
 * @param {string} gebruikerId - UUID van de gebruiker
 * @param {string} correlationId - Correlation ID voor logging
 */
async function deleteVoorkeuren(gebruikerId, correlationId) {
  if (!gebruikerId) {
    throw new Error('gebruikerId is required for deleting voorkeurs_dagdelen');
  }

  const url = `${supabaseConfig.url}/rest/v1/voorkeurs_dagdelen?gebruiker_id=eq.${gebruikerId}`;
  const resp = await httpClient(
    url,
    {
      method: 'DELETE',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    },
    correlationId
  );

  if (!resp.ok) {
    throw new Error(`voorkeurs_dagdelen delete failed: ${await resp.text()}`);
  }

  console.log(`[voorkeursDagdelenService] Deleted existing voorkeuren for user ${gebruikerId}`);
}

export const voorkeursDagdelenService = {
  /**
   * Maakt voorkeurs_dagdelen records aan voor een gebruiker
   * @param {Object} params
   * @param {string} params.gebruikerId - UUID van de gebruiker
   * @param {Object} params.dagdelen - Dagdelen object: { "maandag": ["ochtend"], "dinsdag": ["middag", "avond"] }
   * @param {string} correlationId - Correlation ID
   * @returns {Promise<{ids: string[]}>}
   */
  async create({ gebruikerId, dagdelen }, correlationId) {
    return await createVoorkeuren({ gebruikerId, dagdelen }, correlationId);
  },

  /**
   * Update voorkeuren: verwijder oude en maak nieuwe aan (replace strategie)
   * @param {Object} params
   * @param {string} params.gebruikerId - UUID van de gebruiker
   * @param {Object} params.dagdelen - Nieuwe dagdelen voorkeuren
   * @param {string} correlationId - Correlation ID
   * @returns {Promise<{ids: string[]}>}
   */
  async replace({ gebruikerId, dagdelen }, correlationId) {
    // Verwijder bestaande voorkeuren
    await deleteVoorkeuren(gebruikerId, correlationId);
    
    // Maak nieuwe voorkeuren aan
    return await createVoorkeuren({ gebruikerId, dagdelen }, correlationId);
  },

  /**
   * Verwijdert alle voorkeuren voor een gebruiker
   * @param {string} gebruikerId - UUID van de gebruiker
   * @param {string} correlationId - Correlation ID
   */
  async delete(gebruikerId, correlationId) {
    return await deleteVoorkeuren(gebruikerId, correlationId);
  }
};
