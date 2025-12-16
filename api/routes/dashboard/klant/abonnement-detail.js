// api/routes/dashboard/klant/abonnement-detail.js
/**
 * Haal abonnement details op voor klant dashboard
 * Alleen eigen abonnementen toegestaan
 * Inclusief schoonmaker profiel en adres gegevens
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { withAuth } from '../../../utils/authMiddleware.js';

async function abonnementDetailHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `abonnement-detail-${Date.now()}`;
  const userId = req.user.id;
  const authToken = req.headers.authorization?.split(' ')[1];

  try {
    // Get abonnement ID from query params
    const { id } = req.query;

    if (!id) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/abonnement-detail',
        action: 'missing_id',
        userId
      }));
      return res.status(400).json({
        correlationId,
        error: 'Abonnement ID is verplicht'
      });
    }

    console.log('🔄 [Abonnement Detail] Fetching abonnement...', { id, userId });

    // === FETCH ABONNEMENT MET SCHOONMAKER EN USER PROFIEL (voor adres) ===
    // Join met schoonmakers tabel voor schoonmaker gegevens
    // Join met user_profiles voor klant adres via gebruiker_id
    const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${id}&gebruiker_id=eq.${userId}&select=*,schoonmaker:schoonmakers(id,bio),user_profile:user_profiles!abonnementen_gebruiker_id_fkey(voornaam,achternaam,adres_id,adressen:adres_id(straat,huisnummer,toevoeging,postcode,plaats))`;
    
    const abonnementResponse = await httpClient(abonnementUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    });

    if (!abonnementResponse.ok) {
      throw new Error('Kan abonnement niet ophalen');
    }

    const abonnementen = await abonnementResponse.json();

    if (!abonnementen || abonnementen.length === 0) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/abonnement-detail',
        action: 'abonnement_not_found',
        id,
        userId
      }));
      return res.status(404).json({
        correlationId,
        error: 'Abonnement niet gevonden'
      });
    }

    const abonnement = abonnementen[0];

    // === FETCH SCHOONMAKER USER PROFILE (voor naam en contact) ===
    let schoonmakerProfile = null;
    
    if (abonnement.schoonmaker_id) {
      console.log('🔄 [Abonnement Detail] Fetching schoonmaker profile...', { schoonmaker_id: abonnement.schoonmaker_id });
      
      const schoonmakerUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${abonnement.schoonmaker_id}&select=voornaam,achternaam,email,telefoon,profielfoto`;
      
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
        console.warn('⚠️ [Abonnement Detail] Kon schoonmaker profiel niet ophalen');
      }
    }

    console.log(`✅ [Abonnement Detail] Abonnement opgehaald - Status: ${abonnement.status}, Heeft schoonmaker: ${!!abonnement.schoonmaker_id}`);

    // === RESPONSE SAMENSTELLEN ===
    // Flatten nested data voor frontend gemak
    const adres = abonnement.user_profile?.adressen || null;
    
    const responseData = {
      correlationId,
      // Abonnement gegevens
      id: abonnement.id,
      uren: abonnement.uren,
      frequentie: abonnement.frequentie,
      status: abonnement.status,
      startdatum: abonnement.startdatum,
      aangemaakt_op: abonnement.aangemaakt_op,
      sessions_per_4w: abonnement.sessions_per_4w,
      prijs_per_sessie_cents: abonnement.prijs_per_sessie_cents,
      bundle_amount_cents: abonnement.bundle_amount_cents,
      canceled_at: abonnement.canceled_at,
      cancellation_reason: abonnement.cancellation_reason,
      
      // Schoonmaker gegevens (combinatie van schoonmakers en user_profiles)
      schoonmaker: schoonmakerProfile ? {
        id: abonnement.schoonmaker_id,
        voornaam: schoonmakerProfile.voornaam,
        achternaam: schoonmakerProfile.achternaam,
        email: schoonmakerProfile.email,
        telefoon: schoonmakerProfile.telefoon,
        profielfoto: schoonmakerProfile.profielfoto,
        bio: abonnement.schoonmaker?.bio || null
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
        voornaam: abonnement.user_profile?.voornaam || '',
        achternaam: abonnement.user_profile?.achternaam || ''
      }
    };

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ [Abonnement Detail] Error:', error);
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'dashboard/klant/abonnement-detail',
      action: 'error',
      error: error.message,
      userId
    }));

    return res.status(500).json({
      correlationId,
      error: 'Er is een probleem opgetreden bij het ophalen van het abonnement'
    });
  }
}

// Export met auth middleware - alleen klanten toegestaan
export default withAuth(abonnementDetailHandler, { roles: ['klant'] });
