// api/routes/dashboard/klant/update-abonnement.js
/**
 * Update abonnement frequentie en uren
 * Alleen eigen abonnementen toegestaan
 * Valideert minimum uren en herberekent prijzen
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { withAuth } from '../../../utils/authMiddleware.js';
import { fetchPricingConfiguration, formatPricingConfiguration } from '../../../services/configService.js';
import { calculateAbonnementPricing } from '../../../services/pricingCalculator.js';
import { emailService } from '../../../services/emailService.js';
import { 
  abonnementGewijzigdKlant,
  abonnementGewijzigdSchoonmaker,
  abonnementGewijzigdAdmin
} from '../../../templates/emails/index.js';

async function updateAbonnementHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `update-abonnement-${Date.now()}`;
  const userId = req.user.id;
  const authToken = req.headers.authorization?.split(' ')[1];

  try {
    const { id, frequentie, uren } = req.body;

    // Validatie: verplichte velden
    if (!id) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/update-abonnement',
        action: 'missing_id',
        userId
      }));
      return res.status(400).json({
        correlationId,
        error: 'Abonnement ID is verplicht'
      });
    }

    if (!frequentie) {
      return res.status(400).json({
        correlationId,
        error: 'Frequentie is verplicht'
      });
    }

    if (!uren) {
      return res.status(400).json({
        correlationId,
        error: 'Aantal uren is verplicht'
      });
    }

    // Parse en valideer uren
    const parsedUren = parseFloat(uren);
    if (isNaN(parsedUren) || parsedUren <= 0) {
      return res.status(400).json({
        correlationId,
        error: 'Ongeldig aantal uren'
      });
    }

    // Valideer dat uren in halve uren stappen zijn (0.5)
    if ((parsedUren * 2) % 1 !== 0) {
      return res.status(400).json({
        correlationId,
        error: 'Uren moeten in halve uren stappen zijn (bijv. 3, 3.5, 4)'
      });
    }

    console.log('🔄 [Update Abonnement] Fetching abonnement...', { id, userId });

    // === HAAL ABONNEMENT OP MET OWNERSHIP CHECK + EXTRA DATA VOOR EMAILS ===
    const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${id}&gebruiker_id=eq.${userId}&select=id,minimum_uren,frequentie,uren,schoonmaker_id,prijs_per_sessie_cents,bundle_amount_cents,startdatum`;
    
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
        route: 'dashboard/klant/update-abonnement',
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

    // === VALIDEER MINIMUM UREN ===
    if (abonnement.minimum_uren && parsedUren < abonnement.minimum_uren) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/update-abonnement',
        action: 'below_minimum',
        requestedUren: parsedUren,
        minimumUren: abonnement.minimum_uren,
        userId
      }));
      return res.status(400).json({
        correlationId,
        error: 'BELOW_MINIMUM',
        details: `Het aantal uren mag niet lager zijn dan ${abonnement.minimum_uren} uur`
      });
    }

    // === CHECK OF ER DAADWERKELIJK WIJZIGINGEN ZIJN ===
    const hasChanges = 
      abonnement.frequentie !== frequentie || 
      parseFloat(abonnement.uren) !== parsedUren;

    if (!hasChanges) {
      console.log('ℹ️ [Update Abonnement] Geen wijzigingen gedetecteerd');
      return res.status(200).json({
        correlationId,
        message: 'Geen wijzigingen'
      });
    }

    // === HERBEREKEN PRIJZEN ===
    console.log('💰 [Update Abonnement] Herberekenen prijzen...', {
      frequentie,
      uren: parsedUren
    });

    const pricingRows = await fetchPricingConfiguration(correlationId, 'abonnement');
    const pricingConfig = formatPricingConfiguration(pricingRows);
    
    const pricingResult = calculateAbonnementPricing({
      frequentie,
      requestedHours: parsedUren
    }, pricingConfig);

    console.log('📊 [Update Abonnement] Prijs herberekend:', {
      sessionsPerCycle: pricingResult.sessionsPerCycle,
      pricePerSession: pricingResult.pricePerSession,
      bundleAmount: pricingResult.bundleAmount
    });

    // === UPDATE ABONNEMENT MET PRIJZEN ===
    console.log('🔄 [Update Abonnement] Updating...', {
      id,
      frequentie,
      uren: parsedUren,
      previousFrequentie: abonnement.frequentie,
      previousUren: abonnement.uren
    });

    const updateUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${id}`;
    
    const updateResponse = await httpClient(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        frequentie,
        uren: parsedUren,
        sessions_per_4w: pricingResult.sessionsPerCycle,
        prijs_per_sessie_cents: Math.round(pricingResult.pricePerSession * 100),
        bundle_amount_cents: pricingResult.bundleAmountCents
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Update failed: ${errorText}`);
    }

    console.log('✅ [Update Abonnement] Succesvol bijgewerkt');

    // === HAAL GEBRUIKER + SCHOONMAKER GEGEVENS OP VOOR EMAILS ===
    console.log('📧 [Update Abonnement] Fetching user + schoonmaker data voor emails...');
    
    // Fetch user_profile
    const userUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${userId}&select=voornaam,achternaam,email,adres_id,adressen:adres_id(straat,huisnummer,toevoeging,postcode,plaats)`;
    const userResponse = await httpClient(userUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    });
    
    const users = await userResponse.json();
    const user = users[0] || {};
    const adres = user.adressen;
    const volledigAdres = adres 
      ? `${adres.straat} ${adres.huisnummer}${adres.toevoeging || ''}, ${adres.postcode} ${adres.plaats}`
      : 'Adres niet beschikbaar';

    // Fetch schoonmaker (indien toegewezen)
    let schoonmaker = null;
    if (abonnement.schoonmaker_id) {
      const schoonmakerUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${abonnement.schoonmaker_id}&select=voornaam,achternaam,email`;
      const schoonmakerResponse = await httpClient(schoonmakerUrl, {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${authToken}`,
        }
      });
      const schoonmakers = await schoonmakerResponse.json();
      schoonmaker = schoonmakers[0] || null;
    }

    // === VERZEND EMAILS ===
    console.log('📧 [Update Abonnement] Sending emails...');

    // Email naar klant
    try {
      const klantEmailData = {
        voornaam: user.voornaam,
        achternaam: user.achternaam,
        abonnementId: id,
        oudeUren: abonnement.uren,
        oudeFrequentie: abonnement.frequentie,
        oudePrijsCents: abonnement.bundle_amount_cents,
        nieuweUren: parsedUren,
        nieuweFrequentie: frequentie,
        nieuwePrijsCents: pricingResult.bundleAmountCents,
        sessionsPerCycle: pricingResult.sessionsPerCycle
      };
      
      await emailService.send({
        to: user.email,
        subject: 'Je abonnement is gewijzigd',
        html: abonnementGewijzigdKlant(klantEmailData)
      }, correlationId);
      
      console.log('✅ [Update Abonnement] Klant email verzonden');
    } catch (error) {
      console.error('⚠️ [Update Abonnement] Klant email failed:', error.message);
    }

    // Email naar schoonmaker (indien toegewezen)
    if (schoonmaker) {
      try {
        const schoonmakerEmailData = {
          schoonmakerNaam: schoonmaker.voornaam,
          klantNaam: `${user.voornaam} ${user.achternaam}`,
          klantAdres: volledigAdres,
          abonnementId: id,
          oudeUren: abonnement.uren,
          oudeFrequentie: abonnement.frequentie,
          oudePrijsPerSessieCents: abonnement.prijs_per_sessie_cents,
          nieuweUren: parsedUren,
          nieuweFrequentie: frequentie,
          nieuwePrijsPerSessieCents: Math.round(pricingResult.pricePerSession * 100),
          sessionsPerCycle: pricingResult.sessionsPerCycle
        };
        
        await emailService.send({
          to: schoonmaker.email,
          subject: `Abonnement gewijzigd - ${user.voornaam} ${user.achternaam}`,
          html: abonnementGewijzigdSchoonmaker(schoonmakerEmailData)
        }, correlationId);
        
        console.log('✅ [Update Abonnement] Schoonmaker email verzonden');
      } catch (error) {
        console.error('⚠️ [Update Abonnement] Schoonmaker email failed:', error.message);
      }
    }

    // Email naar admin
    try {
      const adminEmailData = {
        klantNaam: `${user.voornaam} ${user.achternaam}`,
        klantEmail: user.email,
        schoonmakerNaam: schoonmaker ? `${schoonmaker.voornaam} ${schoonmaker.achternaam}` : 'Nog niet toegewezen',
        klantAdres: volledigAdres,
        abonnementId: id,
        oudeUren: abonnement.uren,
        oudeFrequentie: abonnement.frequentie,
        oudeBundleCents: abonnement.bundle_amount_cents,
        nieuweUren: parsedUren,
        nieuweFrequentie: frequentie,
        nieuweBundleCents: pricingResult.bundleAmountCents,
        sessionsPerCycle: pricingResult.sessionsPerCycle
      };
      
      await emailService.send({
        to: 'info@heppy-schoonmaak.nl',
        subject: `Abonnement gewijzigd - ${user.voornaam} ${user.achternaam}`,
        html: abonnementGewijzigdAdmin(adminEmailData)
      }, correlationId);
      
      console.log('✅ [Update Abonnement] Admin email verzonden');
    } catch (error) {
      console.error('⚠️ [Update Abonnement] Admin email failed:', error.message);
    }

    return res.status(200).json({
      correlationId,
      message: 'Abonnement succesvol bijgewerkt',
      data: {
        id,
        frequentie,
        uren: parsedUren,
        sessions_per_4w: pricingResult.sessionsPerCycle,
        prijs_per_sessie_cents: Math.round(pricingResult.pricePerSession * 100),
        bundle_amount_cents: pricingResult.bundleAmountCents
      }
    });

  } catch (error) {
    console.error('❌ [Update Abonnement] Error:', error);
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'dashboard/klant/update-abonnement',
      action: 'error',
      error: error.message,
      userId
    }));

    return res.status(500).json({
      correlationId,
      error: 'Er is een probleem opgetreden bij het bijwerken van het abonnement'
    });
  }
}

// Export met auth middleware - alleen klanten toegestaan
export default withAuth(updateAbonnementHandler, { roles: ['klant'] });
