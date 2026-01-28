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
    const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${id}&gebruiker_id=eq.${userId}&select=*,schoonmaker:schoonmakers(id,bio),user_profile:user_profiles!abonnementen_gebruiker_id_fkey(voornaam,achternaam,email,adres_id,adressen:adres_id(straat,huisnummer,toevoeging,postcode,plaats))`;
    
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

    // === FETCH FACTUREN (voor dit abonnement) ===
    const facturenUrl = `${supabaseConfig.url}/rest/v1/facturen?abonnement_id=eq.${id}&select=id,factuur_nummer,factuurdatum,totaal_cents,status,stripe_invoice_id,omschrijving,regels,aangemaakt_op&order=aangemaakt_op.desc`;
    
    const facturenResponse = await httpClient(facturenUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    });

    let facturen = [];
    if (facturenResponse.ok) {
      facturen = await facturenResponse.json();
      // Transform voor frontend compatibiliteit
      facturen = facturen.map(f => ({
        ...f,
        amount_cents: f.totaal_cents,
        periode_display: null // Wordt in frontend berekend uit regels
      }));
      console.log(`🧾 [Abonnement Detail] ${facturen.length} facturen gevonden`);
    } else {
      console.warn('⚠️ [Abonnement Detail] Kon facturen niet ophalen (non-fatal)');
    }

    // === FETCH SEPA PAYMENT METHOD DETAILS (laatste 4 cijfers IBAN) ===
    let sepaIbanLast4 = null;
    
    if (abonnement.stripe_payment_method_id && abonnement.sepa_setup_completed) {
      try {
        // Haal PaymentMethod op bij Stripe voor IBAN details
        const { stripeConfig } = await import('../../../config/index.js');
        const pmResponse = await fetch(`https://api.stripe.com/v1/payment_methods/${abonnement.stripe_payment_method_id}`, {
          headers: {
            'Authorization': `Bearer ${stripeConfig.secretKey}`,
          }
        });
        
        if (pmResponse.ok) {
          const pm = await pmResponse.json();
          if (pm.sepa_debit?.last4) {
            sepaIbanLast4 = pm.sepa_debit.last4;
          }
        }
      } catch (e) {
        console.warn('⚠️ [Abonnement Detail] Kon SEPA details niet ophalen (non-fatal)', e.message);
      }
    }

    // === RESPONSE SAMENSTELLEN ===
    // Flatten nested data voor frontend gemak
    const adres = abonnement.user_profile?.adressen || null;
    
    const responseData = {
      correlationId,
      // Abonnement gegevens
      id: abonnement.id,
      uren: abonnement.uren,
      minimum_uren: abonnement.minimum_uren,
      frequentie: abonnement.frequentie,
      status: abonnement.status,
      startdatum: abonnement.startdatum,
      aangemaakt_op: abonnement.aangemaakt_op,
      sessions_per_4w: abonnement.sessions_per_4w,
      prijs_per_sessie_cents: abonnement.prijs_per_sessie_cents,
      bundle_amount_cents: abonnement.bundle_amount_cents,
      canceled_at: abonnement.canceled_at,
      cancellation_reason: abonnement.cancellation_reason,
      opzeg_week: abonnement.opzeg_week,
      opzeg_jaar: abonnement.opzeg_jaar,
      
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
        achternaam: abonnement.user_profile?.achternaam || '',
        email: abonnement.user_profile?.email || ''
      },
      
      // SEPA incasso status
      sepa: {
        setup_completed: abonnement.sepa_setup_completed || false,
        iban_last4: sepaIbanLast4,
        mandate_id: abonnement.sepa_mandate_id || null,
        payment_method_id: abonnement.stripe_payment_method_id || null,
        actief_sinds: abonnement.sepa_setup_completed ? abonnement.aangemaakt_op : null
      },
      
      // Facturen voor dit abonnement
      facturen: facturen
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
