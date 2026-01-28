// api/routes/dashboard/klant/opzeg-abonnement.js
/**
 * Opzeggen van abonnement
 * Alleen eigen abonnementen toegestaan
 * Minimum opzegtermijn: 2 weken
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { withAuth } from '../../../utils/authMiddleware.js';
import { sendEmail } from '../../../services/emailService.js';
import { 
  abonnementOpgezegdKlant,
  abonnementOpgezegdSchoonmaker,
  abonnementOpgezegdAdmin
} from '../../../templates/emails/index.js';

/**
 * Bereken ISO weeknummer voor een datum
 */
function getISOWeek(date) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
}

/**
 * Bereken startdatum van een ISO week
 */
function getStartDateOfISOWeek(weekNumber, year) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const weekOneMonday = new Date(jan4);
  weekOneMonday.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1);
  const targetDate = new Date(weekOneMonday);
  targetDate.setUTCDate(weekOneMonday.getUTCDate() + (weekNumber - 1) * 7);
  return targetDate;
}

/**
 * Aantal weken in een ISO jaar
 */
function weeksInISOYear(year) {
  const dec28 = new Date(Date.UTC(year, 11, 28));
  return getISOWeek(dec28);
}

async function opzegAbonnementHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `opzeg-abonnement-${Date.now()}`;
  const userId = req.user.id;
  const authToken = req.headers.authorization?.split(' ')[1];

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://heppy-schoonmaak.webflow.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { id, opzeg_weeknr, opzeg_jaar, opzeg_reden } = req.body;

    // Validatie: verplichte velden
    if (!id) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/opzeg-abonnement',
        action: 'missing_id',
        userId
      }));
      return res.status(400).json({
        correlationId,
        error: 'Abonnement ID is verplicht'
      });
    }

    if (!opzeg_weeknr) {
      return res.status(400).json({
        correlationId,
        error: 'Weeknummer is verplicht'
      });
    }

    if (!opzeg_jaar) {
      return res.status(400).json({
        correlationId,
        error: 'Jaar is verplicht'
      });
    }

    // Parse en valideer weeknummer
    const parsedWeek = parseInt(opzeg_weeknr, 10);
    const parsedYear = parseInt(opzeg_jaar, 10);

    if (isNaN(parsedWeek) || parsedWeek < 1 || parsedWeek > 53) {
      return res.status(400).json({
        correlationId,
        error: 'Ongeldig weeknummer'
      });
    }

    if (isNaN(parsedYear) || parsedYear < 2024 || parsedYear > 2030) {
      return res.status(400).json({
        correlationId,
        error: 'Ongeldig jaar'
      });
    }

    // === VALIDEER OPZEGTERMIJN (MINIMUM 2 WEKEN) ===
    const now = new Date();
    const currentWeek = getISOWeek(now);
    const currentYear = now.getFullYear();
    const weeksCurrentYear = weeksInISOYear(currentYear);

    // Bereken minimale opzegweek (huidige + 2)
    let minWeek = currentWeek + 2;
    let minYear = currentYear;
    if (minWeek > weeksCurrentYear) {
      minWeek -= weeksCurrentYear;
      minYear += 1;
    }

    // Bereken datum van gekozen week
    const chosenDate = getStartDateOfISOWeek(parsedWeek, parsedYear);
    const minDate = getStartDateOfISOWeek(minWeek, minYear);

    if (chosenDate < minDate) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/opzeg-abonnement',
        action: 'termijn_too_short',
        chosenWeek: parsedWeek,
        chosenYear: parsedYear,
        minWeek,
        minYear,
        userId
      }));
      return res.status(400).json({
        correlationId,
        error: 'INVALID_WEEK',
        details: `Je kunt pas opzeggen vanaf week ${minWeek} (${minYear}). Opzegtermijn is minimaal 2 weken.`
      });
    }

    console.log('🔄 [Opzeg Abonnement] Fetching abonnement...', { id, userId });

    // === HAAL ABONNEMENT OP MET OWNERSHIP CHECK + EXTRA DATA VOOR EMAILS ===
    const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${id}&gebruiker_id=eq.${userId}&select=id,status,canceled_at,schoonmaker_id,uren,frequentie,bundle_amount_cents,startdatum`;
    
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
        route: 'dashboard/klant/opzeg-abonnement',
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

    // Check of al opgezegd
    if (abonnement.canceled_at) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/opzeg-abonnement',
        action: 'already_canceled',
        id,
        userId
      }));
      return res.status(400).json({
        correlationId,
        error: 'ALREADY_CANCELED',
        details: 'Dit abonnement is al opgezegd'
      });
    }

    // === UPDATE ABONNEMENT MET OPZEGGING ===
    console.log('🔄 [Opzeg Abonnement] Verwerken opzegging...', {
      id,
      week: parsedWeek,
      year: parsedYear,
      reden: opzeg_reden || 'Geen reden opgegeven'
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
        canceled_at: new Date().toISOString(),
        cancellation_reason: opzeg_reden || 'Geen reden opgegeven',
        status: 'gestopt', // Status direct op gestopt zetten
        opzeg_week: parsedWeek,
        opzeg_jaar: parsedYear
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Update failed: ${errorText}`);
    }

    console.log('✅ [Opzeg Abonnement] Opzegging succesvol verwerkt');

    // === HAAL GEBRUIKER + SCHOONMAKER GEGEVENS OP VOOR EMAILS ===
    console.log('📧 [Opzeg Abonnement] Fetching user + schoonmaker data voor emails...');
    
    // Fetch user_profile
    const userUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${userId}&select=voornaam,achternaam,email,telefoon,adres_id,adressen:adres_id(straat,huisnummer,toevoeging,postcode,plaats)`;
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
    console.log('📧 [Opzeg Abonnement] Sending emails...');
    console.log(`👤 [Opzeg Abonnement] Schoonmaker status: ${abonnement.schoonmaker_id ? `Toegewezen (${abonnement.schoonmaker_id})` : 'Niet toegewezen'}`);

    // Email naar klant
    try {
      console.log(`📧 [Opzeg Abonnement] Sending klant email to: ${user.email}`);
      const klantEmailData = {
        voornaam: user.voornaam,
        achternaam: user.achternaam,
        abonnementId: id,
        opzegWeek: parsedWeek,
        opzegJaar: parsedYear,
        opzegReden: opzeg_reden || 'Geen reden opgegeven',
        uren: abonnement.uren,
        frequentie: abonnement.frequentie
      };
      
      await sendEmail({
        to: user.email,
        subject: 'Opzegging bevestigd - Jouw abonnement',
        html: abonnementOpgezegdKlant(klantEmailData)
      }, correlationId);
      
      console.log('✅ [Opzeg Abonnement] Klant email verzonden');
    } catch (error) {
      console.error('⚠️ [Opzeg Abonnement] Klant email failed:', error.message);
      console.error('⚠️ [Opzeg Abonnement] Klant email error stack:', error.stack);
    }

    // Email naar schoonmaker (indien toegewezen)
    if (schoonmaker) {
      console.log(`📧 [Opzeg Abonnement] Sending schoonmaker email to: ${schoonmaker.email}`);
      try {
        const schoonmakerEmailData = {
          schoonmakerNaam: schoonmaker.voornaam,
          klantNaam: `${user.voornaam} ${user.achternaam}`,
          klantAdres: volledigAdres,
          klantTelefoon: user.telefoon || null,
          abonnementId: id,
          opzegWeek: parsedWeek,
          opzegJaar: parsedYear,
          opzegReden: opzeg_reden || 'Geen reden opgegeven',
          uren: abonnement.uren,
          frequentie: abonnement.frequentie
        };
        
        await sendEmail({
          to: schoonmaker.email,
          subject: `Klant opgezegd: ${user.voornaam} ${user.achternaam}`,
          html: abonnementOpgezegdSchoonmaker(schoonmakerEmailData)
        }, correlationId);
        
        console.log('✅ [Opzeg Abonnement] Schoonmaker email verzonden');
      } catch (error) {
        console.error('⚠️ [Opzeg Abonnement] Schoonmaker email failed:', error.message);
        console.error('⚠️ [Opzeg Abonnement] Schoonmaker email error stack:', error.stack);
      }
    } else {
      console.log('ℹ️ [Opzeg Abonnement] Schoonmaker email skipped - geen schoonmaker toegewezen');
    }

    // Email naar admin
    console.log(`📧 [Opzeg Abonnement] Sending admin email to: ${emailConfig.notificationsEmail}`);
    try {
      const adminEmailData = {
        klantNaam: `${user.voornaam} ${user.achternaam}`,
        klantEmail: user.email,
        klantTelefoon: user.telefoon || null,
        schoonmakerNaam: schoonmaker ? `${schoonmaker.voornaam} ${schoonmaker.achternaam}` : 'Nog niet toegewezen',
        klantAdres: volledigAdres,
        abonnementId: id,
        opzegWeek: parsedWeek,
        opzegJaar: parsedYear,
        opzegReden: opzeg_reden || 'Geen reden opgegeven',
        uren: abonnement.uren,
        frequentie: abonnement.frequentie,
        bundleCents: abonnement.bundle_amount_cents,
        startdatum: abonnement.startdatum
      };
      
      await sendEmail({
        to: emailConfig.notificationsEmail,
        subject: `⚠️ Churn Alert - ${user.voornaam} ${user.achternaam}`,
        html: abonnementOpgezegdAdmin(adminEmailData)
      }, correlationId);
      
      console.log('✅ [Opzeg Abonnement] Admin email verzonden');
    } catch (error) {
      console.error('⚠️ [Opzeg Abonnement] Admin email failed:', error.message);
      console.error('⚠️ [Opzeg Abonnement] Admin email error stack:', error.stack);
    }

    return res.status(200).json({
      correlationId,
      message: 'Opzegging succesvol verwerkt',
      data: {
        id,
        opzeg_week: parsedWeek,
        opzeg_jaar: parsedYear,
        canceled_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ [Opzeg Abonnement] Error:', error);
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'dashboard/klant/opzeg-abonnement',
      action: 'error',
      error: error.message,
      userId
    }));

    return res.status(500).json({
      correlationId,
      error: 'Er is een probleem opgetreden bij het verwerken van de opzegging'
    });
  }
}

// Export met auth middleware - alleen klanten toegestaan
export default withAuth(opzegAbonnementHandler, { roles: ['klant'] });
