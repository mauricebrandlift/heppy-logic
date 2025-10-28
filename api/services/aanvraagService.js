// aanvraagService: create schoonmaak_aanvraag
import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';
import * as schoonmaakMatchService from './schoonmaakMatchService.js';
import * as schoonmakerService from './schoonmakerService.js';
import * as auditService from './auditService.js';

function uuid(){
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
}

export const aanvraagService = {
  async create(meta, addressId, correlationId){
    const id = uuid();
    const url = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen`;
    const body = { id, voornaam: meta.voornaam||null, achternaam: meta.achternaam||null, email: meta.email||null, telefoon: meta.telefoon||null, adres_id: addressId, uren: meta.uren||null, startdatum: meta.startdatum||null, schoonmaak_optie: meta.frequentie||null, status: 'betaald' };
    const resp = await httpClient(url, { method:'POST', headers:{ 'Content-Type':'application/json','apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}`,'Prefer':'return=minimal' }, body: JSON.stringify(body) }, correlationId);
    if(!resp.ok) throw new Error(`schoonmaak_aanvragen insert failed: ${await resp.text()}`);
    return { id };
  },

  /**
   * Schoonmaker keurt aanvraag goed
   * 
   * Flow:
   * 1. Haal aanvraag op (check bestaat)
   * 2. Haal gerelateerd abonnement op (via aanvraag_id)
   * 3. Haal actieve match op (schoonmaker_id + aanvraag_id, status='open')
   * 4. Valideer: match moet status 'open' hebben
   * 5. Update match.status = 'geaccepteerd'
   * 6. Update abonnement.schoonmaker_id = schoonmaker_id
   * 7. Update abonnement.status = 'actief'
   * 8. Update aanvraag.status = 'geaccepteerd'
   * 9. Audit log
   * 
   * @param {Object} params
   * @param {string} params.aanvraagId - UUID van schoonmaak_aanvraag
   * @param {string} params.schoonmakerId - UUID van schoonmaker die goedkeurt
   * @param {string} correlationId - Voor logging
   * @returns {Promise<Object>} Result met aanvraag, abonnement, match, schoonmaker
   * @throws {Error} Als aanvraag niet bestaat, match niet gevonden, of al goedgekeurd
   */
  async approve({ aanvraagId, schoonmakerId }, correlationId) {
    console.log(`[aanvraagService.approve] START [${correlationId}]`, { aanvraagId, schoonmakerId });

    // STAP 1: Haal aanvraag op
    const aanvraagUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen?id=eq.${aanvraagId}&select=*`;
    const aanvraagResp = await httpClient(aanvraagUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    }, correlationId);

    if (!aanvraagResp.ok) {
      throw new Error(`Failed to fetch aanvraag: ${await aanvraagResp.text()}`);
    }

    const aanvragen = await aanvraagResp.json();
    if (!aanvragen || aanvragen.length === 0) {
      const error = new Error('Aanvraag not found');
      error.statusCode = 404;
      throw error;
    }

    const aanvraag = aanvragen[0];
    console.log(`[aanvraagService.approve] Aanvraag found [${correlationId}]`, { 
      id: aanvraag.id, 
      status: aanvraag.status 
    });

    // STAP 2: Haal gerelateerd abonnement op
    const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?schoonmaak_aanvraag_id=eq.${aanvraagId}&select=*`;
    const abonnementResp = await httpClient(abonnementUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    }, correlationId);

    if (!abonnementResp.ok) {
      throw new Error(`Failed to fetch abonnement: ${await abonnementResp.text()}`);
    }

    const abonnementen = await abonnementResp.json();
    if (!abonnementen || abonnementen.length === 0) {
      const error = new Error('Abonnement not found for this aanvraag');
      error.statusCode = 404;
      throw error;
    }

    const abonnement = abonnementen[0];
    console.log(`[aanvraagService.approve] Abonnement found [${correlationId}]`, { 
      id: abonnement.id,
      status: abonnement.status
    });

    // STAP 3: Haal actieve match op
    const matches = await schoonmaakMatchService.findByAanvraagId(aanvraagId, correlationId);
    
    if (!matches || matches.length === 0) {
      const error = new Error('No match found for this aanvraag');
      error.statusCode = 404;
      throw error;
    }

    // Neem de meest recente match (array is gesorteerd op aangemaakt_op DESC)
    const match = matches[0];

    // Valideer dat deze schoonmaker de juiste is
    if (match.schoonmaker_id !== schoonmakerId) {
      const error = new Error('This schoonmaker is not assigned to this aanvraag');
      error.statusCode = 403;
      throw error;
    }

    console.log(`[aanvraagService.approve] Match found [${correlationId}]`, { 
      match_id: match.id,
      status: match.status,
      schoonmaker_id: match.schoonmaker_id
    });

    // STAP 4: Valideer match status
    if (match.status === 'geaccepteerd') {
      const error = new Error('Aanvraag already approved by this schoonmaker');
      error.statusCode = 409;
      throw error;
    }

    if (match.status === 'geweigerd') {
      const error = new Error('Cannot approve a previously rejected match');
      error.statusCode = 409;
      throw error;
    }

    if (match.status !== 'open') {
      const error = new Error(`Cannot approve match with status: ${match.status}`);
      error.statusCode = 409;
      throw error;
    }

    // STAP 5: Update match status naar 'geaccepteerd'
    await schoonmaakMatchService.updateStatus(match.id, 'geaccepteerd', correlationId);
    console.log(`[aanvraagService.approve] Match status updated to 'geaccepteerd' [${correlationId}]`);

    // STAP 6: Update abonnement.schoonmaker_id
    const updateAbonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${abonnement.id}`;
    const updateAbonnementResp = await httpClient(updateAbonnementUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        schoonmaker_id: schoonmakerId,
        status: 'actief'
      })
    }, correlationId);

    if (!updateAbonnementResp.ok) {
      throw new Error(`Failed to update abonnement: ${await updateAbonnementResp.text()}`);
    }

    console.log(`[aanvraagService.approve] Abonnement updated [${correlationId}]`, {
      abonnement_id: abonnement.id,
      schoonmaker_id: schoonmakerId,
      status: 'actief'
    });

    // STAP 7: Update aanvraag.status naar 'geaccepteerd'
    const updateAanvraagUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen?id=eq.${aanvraagId}`;
    const updateAanvraagResp = await httpClient(updateAanvraagUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        status: 'geaccepteerd'
      })
    }, correlationId);

    if (!updateAanvraagResp.ok) {
      throw new Error(`Failed to update aanvraag: ${await updateAanvraagResp.text()}`);
    }

    console.log(`[aanvraagService.approve] Aanvraag status updated to 'geaccepteerd' [${correlationId}]`);

    // STAP 8: Audit log
    await auditService.log(
      'aanvraag_goedgekeurd',
      aanvraagId,
      'approved',
      schoonmakerId,
      {
        aanvraag_id: aanvraagId,
        abonnement_id: abonnement.id,
        schoonmaker_id: schoonmakerId,
        match_id: match.id
      },
      correlationId
    );

    console.log(`[aanvraagService.approve] SUCCESS [${correlationId}]`);

    // Return complete result
    return {
      aanvraag: {
        id: aanvraag.id,
        status: 'geaccepteerd'
      },
      abonnement: {
        id: abonnement.id,
        status: 'actief',
        schoonmaker_id: schoonmakerId
      },
      match: {
        id: match.id,
        status: 'geaccepteerd'
      },
      schoonmaker: {
        id: schoonmakerId
      }
    };
  },

  /**
   * Schoonmaker keurt aanvraag af
   * 
   * Flow:
   * 1. Haal aanvraag op (check bestaat)
   * 2. Haal actieve match op (schoonmaker_id + aanvraag_id, status='open')
   * 3. Valideer: match moet status 'open' hebben
   * 4. Update match.status = 'geweigerd' + afwijzing_reden
   * 5. Haal lijst van eerder afgewezen schoonmakers op
   * 6. Zoek nieuwe schoonmaker (exclude afgewezen lijst)
   * 7a. Als gevonden: maak nieuwe match (status='open')
   * 7b. Als NIET gevonden: update aanvraag.status = 'afgewezen'
   * 8. Audit log
   * 
   * @param {Object} params
   * @param {string} params.aanvraagId - UUID van schoonmaak_aanvraag
   * @param {string} params.schoonmakerId - UUID van schoonmaker die afkeurt
   * @param {string|null} params.reden - Optionele afwijzingsreden
   * @param {string} correlationId - Voor logging
   * @returns {Promise<Object>} Result met aanvraag, rejectedMatch, newMatch (of null)
   * @throws {Error} Als aanvraag niet bestaat, match niet gevonden, of al afgewezen
   */
  async reject({ aanvraagId, schoonmakerId, reden }, correlationId) {
    console.log(`[aanvraagService.reject] START [${correlationId}]`, { 
      aanvraagId, 
      schoonmakerId,
      reden: reden || '(geen reden)'
    });

    // STAP 1: Haal aanvraag op
    const aanvraagUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen?id=eq.${aanvraagId}&select=*`;
    const aanvraagResp = await httpClient(aanvraagUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    }, correlationId);

    if (!aanvraagResp.ok) {
      throw new Error(`Failed to fetch aanvraag: ${await aanvraagResp.text()}`);
    }

    const aanvragen = await aanvraagResp.json();
    if (!aanvragen || aanvragen.length === 0) {
      const error = new Error('Aanvraag not found');
      error.statusCode = 404;
      throw error;
    }

    const aanvraag = aanvragen[0];
    console.log(`[aanvraagService.reject] Aanvraag found [${correlationId}]`, { 
      id: aanvraag.id, 
      status: aanvraag.status 
    });

    // STAP 2: Haal actieve match op
    const matches = await schoonmaakMatchService.findByAanvraagId(aanvraagId, correlationId);
    
    if (!matches || matches.length === 0) {
      const error = new Error('No match found for this aanvraag');
      error.statusCode = 404;
      throw error;
    }

    // Neem de meest recente match (array is gesorteerd op aangemaakt_op DESC)
    const match = matches[0];

    // Valideer dat deze schoonmaker de juiste is
    if (match.schoonmaker_id !== schoonmakerId) {
      const error = new Error('This schoonmaker is not assigned to this aanvraag');
      error.statusCode = 403;
      throw error;
    }

    console.log(`[aanvraagService.reject] Match found [${correlationId}]`, { 
      match_id: match.id,
      status: match.status,
      schoonmaker_id: match.schoonmaker_id
    });

    // STAP 3: Valideer match status
    if (match.status === 'geweigerd') {
      const error = new Error('Match already rejected by this schoonmaker');
      error.statusCode = 409;
      throw error;
    }

    if (match.status === 'geaccepteerd') {
      const error = new Error('Cannot reject an accepted match');
      error.statusCode = 409;
      throw error;
    }

    if (match.status !== 'open') {
      const error = new Error(`Cannot reject match with status: ${match.status}`);
      error.statusCode = 409;
      throw error;
    }

    // STAP 4: Update match status naar 'geweigerd' + reden
    const updateMatchUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_match?id=eq.${match.id}`;
    const updateMatchResp = await httpClient(updateMatchUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        status: 'geweigerd',
        afwijzing_reden: reden || null,
        bijgewerkt_op: new Date().toISOString()
      })
    }, correlationId);

    if (!updateMatchResp.ok) {
      throw new Error(`Failed to update match: ${await updateMatchResp.text()}`);
    }

    console.log(`[aanvraagService.reject] Match status updated to 'geweigerd' [${correlationId}]`);

    // STAP 5: Haal lijst van eerder afgewezen schoonmakers op
    const rejectedMatches = matches.filter(m => m.status === 'geweigerd');
    const excludeSchoonmakerIds = rejectedMatches.map(m => m.schoonmaker_id).filter(Boolean);
    
    console.log(`[aanvraagService.reject] Excluding ${excludeSchoonmakerIds.length} previously rejected schoonmakers [${correlationId}]`);

    // STAP 6: Zoek nieuwe schoonmaker
    // STAP 6: Zoek nieuwe schoonmaker (indien beschikbaar)
    console.log(`[aanvraagService.reject] Searching for new schoonmaker [${correlationId}]`);
    
    let newMatch = null;
    let newSchoonmaker = null;

    try {
      const matchResult = await schoonmakerService.findAndAssignSchoonmaker(
        aanvraagId,
        abonnement.id,
        excludeSchoonmakerIds,
        correlationId
      );

      if (matchResult) {
        newMatch = matchResult;
        newSchoonmaker = {
          id: matchResult.schoonmaker_id,
          voornaam: matchResult.schoonmaker_voornaam,
          achternaam: matchResult.schoonmaker_achternaam
        };
        console.log(`✅ [aanvraagService.reject] New match created [${correlationId}]`, {
          match_id: newMatch.id,
          schoonmaker_id: newSchoonmaker.id
        });
      } else {
        console.log(`ℹ️ [aanvraagService.reject] No available schoonmaker found [${correlationId}]`);
      }
    } catch (error) {
      console.error(`❌ [aanvraagService.reject] Auto-matching failed [${correlationId}]`, {
        error: error.message
      });
      // Continue flow - geen nieuwe match betekent admin actie nodig
    }

    // STAP 7: Als geen nieuwe schoonmaker gevonden, update aanvraag status
    if (!newMatch) {
      console.log(`[aanvraagService.reject] No new match found, updating aanvraag status [${correlationId}]`);
      
      const updateAanvraagUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen?id=eq.${aanvraagId}`;
      const updateAanvraagResp = await httpClient(updateAanvraagUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          status: 'afgewezen'
        })
      }, correlationId);

      if (!updateAanvraagResp.ok) {
        throw new Error(`Failed to update aanvraag: ${await updateAanvraagResp.text()}`);
      }

      console.log(`[aanvraagService.reject] Aanvraag status updated to 'afgewezen' [${correlationId}]`);
    }

    // STAP 8: Audit log
    await auditService.log(
      'aanvraag_afgewezen',
      aanvraagId,
      'rejected',
      schoonmakerId,
      {
        aanvraag_id: aanvraagId,
        rejected_match_id: match.id,
        schoonmaker_id: schoonmakerId,
        reden: reden || null,
        new_match_found: newMatch !== null,
        excluded_schoonmakers: excludeSchoonmakerIds
      },
      correlationId
    );

    console.log(`[aanvraagService.reject] SUCCESS [${correlationId}]`);

    // Return complete result
    return {
      aanvraag: {
        id: aanvraag.id,
        status: newMatch ? 'betaald' : 'afgewezen'
      },
      rejectedMatch: {
        id: match.id,
        status: 'geweigerd',
        reden: reden || null
      },
      newMatch: newMatch ? {
        id: newMatch.id,
        schoonmaker_id: newMatch.schoonmaker_id,
        status: 'open',
        schoonmaker_naam: newSchoonmaker?.voornaam || null
      } : null
    };
  }
};
