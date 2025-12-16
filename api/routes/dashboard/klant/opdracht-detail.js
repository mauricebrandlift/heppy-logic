// api/routes/dashboard/klant/opdracht-detail.js
/**
 * Haal eenmalige opdracht details op voor klant dashboard
 * Alleen eigen opdrachten toegestaan
 * Inclusief schoonmaker profiel en adres gegevens
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { withAuth } from '../../../utils/authMiddleware.js';

async function opdrachtDetailHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `opdracht-detail-${Date.now()}`;
  const userId = req.user.id;
  const authToken = req.headers.authorization?.split(' ')[1];

  try {
    // Get opdracht ID from query params
    const { id } = req.query;

    if (!id) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/opdracht-detail',
        action: 'missing_id',
        userId
      }));
      return res.status(400).json({
        correlationId,
        error: 'Opdracht ID is verplicht'
      });
    }

    console.log('🔄 [Opdracht Detail] Fetching opdracht...', { id, userId });

    // === FETCH OPDRACHT MET USER PROFIEL (voor adres) ===
    // Join met user_profiles voor klant adres via gebruiker_id
    const opdrachtUrl = `${supabaseConfig.url}/rest/v1/opdrachten?id=eq.${id}&gebruiker_id=eq.${userId}&select=*,user_profile:user_profiles!opdrachten_gebruiker_id_fkey(voornaam,achternaam,adres_id,adressen:adres_id(straat,huisnummer,toevoeging,postcode,plaats))`;
    
    const opdrachtResponse = await httpClient(opdrachtUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    });

    if (!opdrachtResponse.ok) {
      throw new Error('Kan opdracht niet ophalen');
    }

    const opdrachten = await opdrachtResponse.json();

    if (!opdrachten || opdrachten.length === 0) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/opdracht-detail',
        action: 'opdracht_not_found',
        id,
        userId
      }));
      return res.status(404).json({
        correlationId,
        error: 'Opdracht niet gevonden'
      });
    }

    const opdracht = opdrachten[0];

    // === FETCH SCHOONMAKER USER PROFILE (voor naam en contact) ===
    let schoonmakerProfile = null;
    
    if (opdracht.schoonmaker_id) {
      console.log('🔄 [Opdracht Detail] Fetching schoonmaker profile...', { schoonmaker_id: opdracht.schoonmaker_id });
      
      const schoonmakerUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${opdracht.schoonmaker_id}&select=voornaam,achternaam,email,telefoon,profielfoto,adressen:adres_id(plaats)`;
      
      const schoonmakerResponse = await httpClient(schoonmakerUrl, {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${authToken}`,
        }
      });

      if (schoonmakerResponse.ok) {
        const profiles = await schoonmakerResponse.json();
        schoonmakerProfile = profiles[0] || null;
      } else {
        console.warn('⚠️ [Opdracht Detail] Kon schoonmaker profiel niet ophalen');
      }
    }

    console.log(`✅ [Opdracht Detail] Opdracht opgehaald - Type: ${opdracht.type}, Status: ${opdracht.status}, Heeft schoonmaker: ${!!opdracht.schoonmaker_id}`);

    // === RESPONSE SAMENSTELLEN ===
    // Flatten nested data voor frontend gemak
    const adres = opdracht.user_profile?.adressen || null;
    
    const responseData = {
      correlationId,
      // Opdracht gegevens
      id: opdracht.id,
      type: opdracht.type,
      status: opdracht.status,
      totaalbedrag: opdracht.totaalbedrag,
      betaalstatus: opdracht.betaalstatus,
      gewenste_datum: opdracht.gewenste_datum,
      geplande_datum: opdracht.geplande_datum || null,
      aangemaakt_op: opdracht.aangemaakt_op,
      opmerking: opdracht.opmerking,
      
      // Spoed informatie
      is_spoed: opdracht.is_spoed || false,
      spoed_toeslag_cents: opdracht.spoed_toeslag_cents || 0,
      
      // Offerte informatie (indien van toepassing)
      offerte_status: opdracht.offerte_status,
      offerte_bedrag: opdracht.offerte_bedrag,
      offerte_datum: opdracht.offerte_datum,
      
      // Type-specifieke gegevens uit JSONB veld
      gegevens: opdracht.gegevens || {},
      
      // Schoonmaker gegevens (combinatie van user_profiles)
      schoonmaker: schoonmakerProfile ? {
        id: opdracht.schoonmaker_id,
        voornaam: schoonmakerProfile.voornaam,
        achternaam: schoonmakerProfile.achternaam,
        email: schoonmakerProfile.email,
        telefoon: schoonmakerProfile.telefoon,
        profielfoto: schoonmakerProfile.profielfoto,
        plaats: schoonmakerProfile.adressen?.plaats || null
      } : null,
      
      // Adres gegevens
      adres: adres ? {
        straat: adres.straat,
        huisnummer: adres.huisnummer,
        toevoeging: adres.toevoeging,
        postcode: adres.postcode,
        plaats: adres.plaats
      } : null,
      
      // Klant naam (voor header)
      klant: {
        voornaam: opdracht.user_profile?.voornaam || '',
        achternaam: opdracht.user_profile?.achternaam || ''
      }
    };

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ [Opdracht Detail] Error:', error);
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'dashboard/klant/opdracht-detail',
      action: 'error',
      error: error.message,
      userId
    }));

    return res.status(500).json({
      correlationId,
      error: 'Er is een probleem opgetreden bij het ophalen van de opdracht'
    });
  }
}

// Export met auth middleware - alleen klanten toegestaan
export default withAuth(opdrachtDetailHandler, { roles: ['klant'] });
