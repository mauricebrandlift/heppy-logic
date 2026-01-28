/**
 * SchoonmakerService
 * Beheert schoonmaker matching en selectie logica
 */

import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';
import { getBeschikbareSchoonmakers } from './cleanerService.js';
import * as schoonmaakMatchService from './schoonmaakMatchService.js';
import { notificeerNieuweMatch } from './notificatieService.js';

/**
 * Vindt de beste matching schoonmaker voor een aanvraag
 * 
 * Matching criteria:
 * 1. Binnen coverage gebied (plaats)
 * 2. Beschikbaar voor gewenste uren
 * 3. Beschikbaar op gewenste dagdelen (indien opgegeven)
 * 4. Niet eerder afgewezen voor deze aanvraag
 * 5. Scoring: afstand, rating, beschikbaarheid
 * 
 * @param {Object} params
 * @param {string} params.aanvraagId - UUID van schoonmaak_aanvraag
 * @param {Array<string>} params.excludeSchoonmakerIds - IDs van schoonmakers die niet in aanmerking komen
 * @param {string} [correlationId] - Voor logging
 * @returns {Promise<Object|null>} - Beste match of null als geen beschikbaar
 */
export async function findMatchingSchoonmaker({ aanvraagId, excludeSchoonmakerIds = [] }, correlationId = '') {
  console.log(`🔍 [SchoonmakerService] Finding match for aanvraag ${aanvraagId} [${correlationId}]`);
  console.log(`🔍 [SchoonmakerService] Excluding ${excludeSchoonmakerIds.length} schoonmaker(s) [${correlationId}]`);

  try {
    // STAP 1: Haal aanvraag details op
    const aanvraagUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen?id=eq.${aanvraagId}&select=*,adressen(*)`;
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
      console.warn(`⚠️ [SchoonmakerService] Aanvraag not found [${correlationId}]`);
      return null;
    }

    const aanvraag = aanvragen[0];
    const adres = aanvraag.adressen;

    if (!adres || !adres.plaats) {
      console.warn(`⚠️ [SchoonmakerService] No plaats found for aanvraag [${correlationId}]`);
      return null;
    }

    console.log(`📍 [SchoonmakerService] Aanvraag details [${correlationId}]`, {
      plaats: adres.plaats,
      uren: aanvraag.uren,
      frequentie: aanvraag.schoonmaak_optie
    });

    // STAP 2: Haal dagdelen voorkeuren op (indien aanwezig)
    // Voor nu: geen dagdelen filtering (later via voorkeurs_dagdelen tabel)
    const dagdelen = null;

    // STAP 3: Zoek beschikbare schoonmakers via cleanerService
    const beschikbareSchoonmakers = await getBeschikbareSchoonmakers(
      adres.plaats,
      aanvraag.uren || 4,
      dagdelen,
      correlationId
    );

    if (!beschikbareSchoonmakers || beschikbareSchoonmakers.length === 0) {
      console.log(`ℹ️ [SchoonmakerService] No schoonmakers found for ${adres.plaats} [${correlationId}]`);
      return null;
    }

    console.log(`✅ [SchoonmakerService] Found ${beschikbareSchoonmakers.length} candidate(s) [${correlationId}]`);

    // STAP 4: Filter excluded schoonmakers
    const availableSchoonmakers = beschikbareSchoonmakers.filter(s => 
      !excludeSchoonmakerIds.includes(s.schoonmaker_id)  // ✅ Gebruik schoonmaker_id
    );

    if (availableSchoonmakers.length === 0) {
      console.log(`ℹ️ [SchoonmakerService] All candidates were excluded [${correlationId}]`);
      return null;
    }

    console.log(`✅ [SchoonmakerService] ${availableSchoonmakers.length} schoonmaker(s) after filtering [${correlationId}]`);

    // STAP 5: Score en sorteer schoonmakers
    // Voor nu: simpele scoring op basis van database volgorde (later uitbreiden)
    const sortedSchoonmakers = availableSchoonmakers.sort((a, b) => {
      // Prioriteit 1: Rating (hoger is beter)
      if (a.rating && b.rating) {
        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }
      }
      
      // Prioriteit 2: Aantal actieve klanten (lager is meer beschikbaar)
      if (a.aantal_actieve_klanten !== undefined && b.aantal_actieve_klanten !== undefined) {
        return a.aantal_actieve_klanten - b.aantal_actieve_klanten;
      }

      // Default: behoud volgorde
      return 0;
    });

    // STAP 6: Selecteer beste match
    const besteMatch = sortedSchoonmakers[0];

    console.log(`🎯 [SchoonmakerService] Best match found [${correlationId}]`, {
      id: besteMatch.schoonmaker_id,
      voornaam: besteMatch.voornaam,
      rating: besteMatch.rating || 'geen rating',
      actieve_klanten: besteMatch.aantal_actieve_klanten || 0
    });

    return {
      id: besteMatch.schoonmaker_id,  // ✅ Gebruik schoonmaker_id ipv id
      voornaam: besteMatch.voornaam || null,
      achternaam: besteMatch.achternaam || null,
      rating: besteMatch.rating || null,
      aantal_actieve_klanten: besteMatch.aantal_actieve_klanten || 0
    };

  } catch (error) {
    console.error(`❌ [SchoonmakerService] Error finding match [${correlationId}]`, {
      error: error.message,
      stack: error.stack
    });
    // Return null instead of throwing - matching failure should not crash the flow
    return null;
  }
}

/**
 * Vindt en wijst automatisch een schoonmaker toe aan een aanvraag
 * Maakt een nieuwe schoonmaak_match record aan
 * 
 * @param {string} aanvraagId - UUID van schoonmaak_aanvraag
 * @param {string} abonnementId - UUID van abonnement (optioneel)
 * @param {Array<string>} excludeSchoonmakerIds - IDs van schoonmakers die niet in aanmerking komen
 * @param {string} [correlationId] - Voor logging
 * @returns {Promise<Object|null>} - Nieuw aangemaakte match of null
 */
export async function findAndAssignSchoonmaker(aanvraagId, abonnementId = null, excludeSchoonmakerIds = [], correlationId = '') {
  console.log(`🤝 [SchoonmakerService] Finding and assigning schoonmaker [${correlationId}]`);

  // Zoek beste match
  const schoonmaker = await findMatchingSchoonmaker({ 
    aanvraagId, 
    excludeSchoonmakerIds 
  }, correlationId);

  if (!schoonmaker) {
    console.log(`ℹ️ [SchoonmakerService] No match found to assign [${correlationId}]`);
    return null;
  }

  // Maak nieuwe match aan
  const matchResult = await schoonmaakMatchService.create({
    aanvraagId,
    schoonmakerId: schoonmaker.id,
    abonnementId
  }, correlationId);

  console.log(`✅ [SchoonmakerService] Match created and assigned [${correlationId}]`, {
    match_id: matchResult.id,
    schoonmaker_id: schoonmaker.id
  });

  // === MAAK NOTIFICATIES AAN ===
  console.log(`🔔 [SchoonmakerService] Creating notificaties for new match [${correlationId}]`);
  try {
    // Haal aanvraag op voor klant ID
    const aanvraagUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen?id=eq.${aanvraagId}&select=email`;
    const aanvraagResp = await httpClient(aanvraagUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
      }
    }, correlationId);
    const aanvragen = await aanvraagResp.json();
    const klantEmail = aanvragen[0]?.email;

    // Haal klant user_profile op
    if (klantEmail) {
      const userUrl = `${supabaseConfig.url}/rest/v1/user_profiles?email=eq.${klantEmail}&select=id`;
      const userResp = await httpClient(userUrl, {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }, correlationId);
      const users = await userResp.json();
      const klantId = users[0]?.id;

      if (klantId) {
        await notificeerNieuweMatch({
          matchId: matchResult.id,
          klantId,
          schoonmakerId: schoonmaker.id,
          abonnementId,
          opdrachtId: null // Voor aanvragen is dit altijd null
        });
        console.log(`✅ [SchoonmakerService] Notificaties aangemaakt [${correlationId}]`);
      }
    }
  } catch (notifError) {
    console.error(`⚠️ [SchoonmakerService] Notificaties failed (niet-blokkerende fout) [${correlationId}]`, notifError.message);
  }

  return {
    id: matchResult.id,
    schoonmaker_id: schoonmaker.id,
    schoonmaker_voornaam: schoonmaker.voornaam,
    schoonmaker_achternaam: schoonmaker.achternaam,
    status: 'open'
  };
}
