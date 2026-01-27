// api/routes/dashboard/klant/pauze-abonnement.js
/**
 * Pauzeren van abonnement
 * Alleen eigen abonnementen toegestaan
 * Minimum vooraf: 1 week
 * Maximum pauze: 8 weken (ook bij overlappende pauzes)
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { withAuth } from '../../../utils/authMiddleware.js';
import { sendEmail } from '../../../services/emailService.js';
import { 
  abonnementGepauzeerdKlant,
  abonnementGepauzeerdSchoonmaker,
  abonnementGepauzeerdAdmin
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

/**
 * Bereken aantal weken tussen twee weeknummers (kan jaar grens overschrijden)
 */
function weeksBetween(startWeek, startYear, endWeek, endYear) {
  const startDate = getStartDateOfISOWeek(startWeek, startYear);
  const endDate = getStartDateOfISOWeek(endWeek, endYear);
  const diffMs = endDate - startDate;
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks;
}

async function pauzeAbonnementHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `pauze-abonnement-${Date.now()}`;
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
    const { 
      id, 
      pauze_start_weeknr,
      pauze_start_jaar,
      eerste_schoonmaak_week,
      eerste_schoonmaak_jaar,
      pauze_reden 
    } = req.body;

    // Validatie: verplichte velden
    if (!id) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/pauze-abonnement',
        action: 'missing_id',
        userId
      }));
      return res.status(400).json({
        correlationId,
        error: 'Abonnement ID is verplicht'
      });
    }

    if (!pauze_start_weeknr || !pauze_start_jaar) {
      return res.status(400).json({
        correlationId,
        error: 'Startweek pauze is verplicht'
      });
    }

    if (!eerste_schoonmaak_week || !eerste_schoonmaak_jaar) {
      return res.status(400).json({
        correlationId,
        error: 'Eerste schoonmaak week is verplicht'
      });
    }

    // Parse weeknummers
    const startWeek = parseInt(pauze_start_weeknr, 10);
    const startJaar = parseInt(pauze_start_jaar, 10);
    const eersteWeek = parseInt(eerste_schoonmaak_week, 10);
    const eersteJaar = parseInt(eerste_schoonmaak_jaar, 10);

    if (isNaN(startWeek) || startWeek < 1 || startWeek > 53) {
      return res.status(400).json({
        correlationId,
        error: 'Ongeldig weeknummer voor startweek'
      });
    }

    if (isNaN(eersteWeek) || eersteWeek < 1 || eersteWeek > 53) {
      return res.status(400).json({
        correlationId,
        error: 'Ongeldig weeknummer voor eerste schoonmaak'
      });
    }

    // Validatie: eerste week moet na start week zijn
    const startDate = getStartDateOfISOWeek(startWeek, startJaar);
    const eersteDate = getStartDateOfISOWeek(eersteWeek, eersteJaar);
    
    if (eersteDate <= startDate) {
      return res.status(400).json({
        correlationId,
        error: 'Eerste schoonmaak week moet na startweek pauze zijn'
      });
    }

    // Bereken pauze duur in weken
    const pauseDuration = weeksBetween(startWeek, startJaar, eersteWeek, eersteJaar);
    
    if (pauseDuration > 8) {
      return res.status(400).json({
        correlationId,
        error: 'Je kunt maximaal 8 weken pauzeren'
      });
    }

    // Haal abonnement op + check ownership (gebruik gebruiker_id zoals opzeg-abonnement)
    const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${id}&gebruiker_id=eq.${userId}&select=*`;
    
    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/pauze-abonnement',
      action: 'fetching_abonnement',
      url: abonnementUrl,
      userId
    }));

    const abonnementResponse = await httpClient(abonnementUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`
      }
    });

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/pauze-abonnement',
      action: 'abonnement_fetch_response',
      status: abonnementResponse.status,
      ok: abonnementResponse.ok
    }));

    if (!abonnementResponse.ok) {
      const errorText = await abonnementResponse.text();
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        route: 'dashboard/klant/pauze-abonnement',
        action: 'abonnement_fetch_failed',
        status: abonnementResponse.status,
        error: errorText
      }));
      throw new Error('Kan abonnement niet ophalen');
    }

    const abonnementen = await abonnementResponse.json();

    if (!abonnementen || abonnementen.length === 0) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/pauze-abonnement',
        action: 'abonnement_not_found',
        abonnementId: id,
        userId
      }));
      return res.status(404).json({
        correlationId,
        error: 'Abonnement niet gevonden'
      });
    }

    const abonnement = abonnementen[0];

    // Ownership is al gevalideerd door gebruiker_id in query

    // Check of abonnement al opgezegd is
    if (abonnement.canceled_at) {
      return res.status(400).json({
        correlationId,
        error: 'Dit abonnement is al opgezegd'
      });
    }

    // Extra pauzes toevoegen is toegestaan (max 8 weken totaal)
    // Check bestaande pauzes + totale pauze duur validatie (max 8 weken inclusief nieuwe)
    // Haal alle pauzes op waar eerste_schoonmaak_week in de toekomst ligt
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentWeek = getISOWeek(now);
    
    const existingPausesUrl = `${supabaseConfig.url}/rest/v1/abonnement_pauzes?abonnement_id=eq.${id}&select=*`;
    const existingPausesResponse = await httpClient(existingPausesUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!existingPausesResponse.ok) {
      throw new Error('Kan bestaande pauzes niet ophalen');
    }

    const allPauzes = await existingPausesResponse.json();
    
    // Filter toekomstige pauzes (eerste_schoonmaak_week >= huidige week)
    const existingPauzes = allPauzes.filter(p => {
      if (p.eerste_schoonmaak_jaar > currentYear) return true;
      if (p.eerste_schoonmaak_jaar === currentYear && p.eerste_schoonmaak_week >= currentWeek) return true;
      return false;
    });

    // Bereken totale pauze duur (bestaande + nieuwe)
    let totalPauzeWeken = pauseDuration;
    
    if (existingPauzes && existingPauzes.length > 0) {
      for (const existingPauze of existingPauzes) {
        const existingWeeks = weeksBetween(
          existingPauze.pauze_start_weeknr,
          existingPauze.pauze_start_jaar,
          existingPauze.eerste_schoonmaak_week,
          existingPauze.eerste_schoonmaak_jaar
        );
        totalPauzeWeken += existingWeeks;
      }
    }

    if (totalPauzeWeken > 8) {
      return res.status(400).json({
        correlationId,
        error: `Totale pauze duur (inclusief bestaande pauzes) mag niet meer dan 8 weken zijn. Je hebt nog ${8 - (totalPauzeWeken - pauseDuration)} weken beschikbaar.`
      });
    }

    // Insert naar abonnement_pauzes met weeknummers
    const pauzeData = {
      abonnement_id: id,
      pauze_start_weeknr: startWeek,
      pauze_start_jaar: startJaar,
      eerste_schoonmaak_week: eersteWeek,
      eerste_schoonmaak_jaar: eersteJaar,
      reden: pauze_reden || null
    };

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/pauze-abonnement',
      action: 'inserting_pauze',
      pauzeData
    }));

    const insertPauzeUrl = `${supabaseConfig.url}/rest/v1/abonnement_pauzes`;
    const insertPauzeResponse = await httpClient(insertPauzeUrl, {
      method: 'POST',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(pauzeData)
    });

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/pauze-abonnement',
      action: 'insert_pauze_response',
      status: insertPauzeResponse.status,
      ok: insertPauzeResponse.ok
    }));

    if (!insertPauzeResponse.ok) {
      const errorText = await insertPauzeResponse.text();
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        route: 'dashboard/klant/pauze-abonnement',
        action: 'insert_pauze_failed',
        status: insertPauzeResponse.status,
        error: errorText
      }));
      throw new Error('Kan pauze niet toevoegen');
    }

    // Update abonnement status naar 'gepauzeerd' (alleen als nog niet gepauzeerd)
    if (abonnement.status !== 'gepauzeerd') {
      const updateAbonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${id}`;
      const updateAbonnementResponse = await httpClient(updateAbonnementUrl, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ status: 'gepauzeerd' })
      });

      if (!updateAbonnementResponse.ok) {
        throw new Error('Kan abonnement status niet updaten');
      }
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/pauze-abonnement',
      action: 'abonnement_gepauzeerd',
      abonnementId: id,
      userId,
      pauzeStartWeek: startWeek,
      pauzeStartJaar: startJaar,
      eersteSchoonmaakWeek: eersteWeek,
      eersteSchoonmaakJaar: eersteJaar,
      pauseDuration: `${pauseDuration} weken`
    }));

    // Haal klant gegevens op voor email
    const klantUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${userId}&select=email,voornaam,achternaam`;
    
    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/pauze-abonnement',
      action: 'fetching_klant',
      url: klantUrl,
      userId
    }));

    const klantResponse = await httpClient(klantUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`
      }
    });

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/pauze-abonnement',
      action: 'klant_fetch_response',
      status: klantResponse.status,
      ok: klantResponse.ok
    }));

    if (!klantResponse.ok) {
      const errorText = await klantResponse.text();
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        route: 'dashboard/klant/pauze-abonnement',
        action: 'klant_fetch_failed',
        status: klantResponse.status,
        error: errorText
      }));
      throw new Error('Kan klant gegevens niet ophalen');
    }

    const klanten = await klantResponse.json();
    const klant = klanten?.[0];

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/pauze-abonnement',
      action: 'klant_data_parsed',
      hasKlant: !!klant,
      klantEmail: klant?.email
    }));

    // Email data voor klant
    const klantEmailData = {
      voornaam: klant?.voornaam || 'Klant',
      achternaam: klant?.achternaam || '',
      frequentie: abonnement.frequentie,
      uren: abonnement.uren,
      pauzeStartWeek: startWeek,
      pauzeStartJaar: startJaar,
      eersteSchoonmaakWeek: eersteWeek,
      eersteSchoonmaakJaar: eersteJaar,
      reden: pauze_reden || 'Niet opgegeven'
    };

    // Verstuur email naar klant
    await sendEmail({
      to: klant?.email,
      subject: 'Je abonnement is gepauzeerd',
      html: abonnementGepauzeerdKlant(klantEmailData)
    });

    // Als schoonmaker toegewezen, stuur ook email
    if (abonnement.schoonmaker_id) {
      const schoonmakerUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${abonnement.schoonmaker_id}&select=email,voornaam,achternaam`;
      const schoonmakerResponse = await httpClient(schoonmakerUrl, {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (schoonmakerResponse.ok) {
        const schoonmakers = await schoonmakerResponse.json();
        const schoonmaker = schoonmakers?.[0];
        const schoonmakerEmailData = {
          voornaam: schoonmaker.voornaam || 'Schoonmaker',
          achternaam: schoonmaker.achternaam || '',
          klant_naam: `${klant?.voornaam || ''} ${klant?.achternaam || ''}`.trim(),
          frequentie: abonnement.frequentie,
          uren: abonnement.uren,
          startweek: parsedStartWeek,
          startyear: parsedStartYear,
          eindweek: parsedEindWeek,
          eindjaar: parsedEindYear,
          reden: pauze_reden || 'Niet opgegeven'
        };

        await sendEmail({
          to: schoonmaker.email,
          subject: 'Abonnement van klant gepauzeerd',
          html: abonnementGepauzeerdSchoonmaker(schoonmakerEmailData)
        });
      }
    }

    // Verstuur email naar admin
    const adminEmailData = {
      klant_naam: `${klant?.voornaam || ''} ${klant?.achternaam || ''}`.trim(),
      klant_email: klant?.email || 'Onbekend',
      abonnement_id: id,
      frequentie: abonnement.frequentie,
      uren: abonnement.uren,
      startweek: parsedStartWeek,
      startyear: parsedStartYear,
      eindweek: parsedEindWeek,
      eindjaar: parsedEindYear,
      reden: pauze_reden || 'Niet opgegeven'
    };

    await sendEmail({
      to: 'info@heppy.nl',
      subject: `Abonnement gepauzeerd - ${klant?.voornaam} ${klant?.achternaam}`,
      html: abonnementGepauzeerdAdmin(adminEmailData)
    });

    return res.status(200).json({
      correlationId,
      message: 'Abonnement succesvol gepauzeerd',
      data: {
        abonnement_id: id,
        startweek: parsedStartWeek,
        startyear: parsedStartYear,
        eindweek: parsedEindWeek,
        eindjaar: parsedEindYear,
        startdatum,
        einddatum
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'dashboard/klant/pauze-abonnement',
      action: 'error',
      error: error.message,
      stack: error.stack
    }));

    return res.status(500).json({
      correlationId,
      error: 'Er is een fout opgetreden bij het pauzeren van je abonnement'
    });
  }
}

export default withAuth(pauzeAbonnementHandler);
