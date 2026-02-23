// api/routes/dashboard/schoonmaker/stop-abonnement.js
/**
 * Schoonmaker stopt met schoonmaken bij klant
 * Registreert in schoonmaker_stopgeschiedenis en ontkoppelt schoonmaker van abonnement
 * Opzegtermijn: 2 weken
 */

import { supabaseConfig, emailConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { withAuth } from '../../../utils/authMiddleware.js';
import { sendEmail } from '../../../services/emailService.js';

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

async function stopAbonnementHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `sm-stop-abonnement-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);
  const schoonmakerId = req.user.id;
  const authToken = req.headers.authorization?.split(' ')[1];

  try {
    const { id, opzeg_weeknr, opzeg_jaar, opzeg_reden } = req.body;

    // === VALIDATIE ===
    if (!id) {
      return res.status(400).json({ correlationId, error: 'Abonnement ID is verplicht' });
    }
    if (!opzeg_weeknr) {
      return res.status(400).json({ correlationId, error: 'Weeknummer is verplicht' });
    }
    if (!opzeg_jaar) {
      return res.status(400).json({ correlationId, error: 'Jaar is verplicht' });
    }
    if (!opzeg_reden || !opzeg_reden.trim()) {
      return res.status(400).json({ correlationId, error: 'Reden is verplicht' });
    }

    const parsedWeek = parseInt(opzeg_weeknr, 10);
    const parsedYear = parseInt(opzeg_jaar, 10);

    if (isNaN(parsedWeek) || parsedWeek < 1 || parsedWeek > 53) {
      return res.status(400).json({ correlationId, error: 'Ongeldig weeknummer' });
    }
    if (isNaN(parsedYear) || parsedYear < 2024 || parsedYear > 2030) {
      return res.status(400).json({ correlationId, error: 'Ongeldig jaar' });
    }

    // === VALIDEER OPZEGTERMIJN (MINIMUM 2 WEKEN) ===
    const now = new Date();
    const currentWeek = getISOWeek(now);
    const currentYear = now.getFullYear();
    const weeksCurrentYear = weeksInISOYear(currentYear);

    let minWeek = currentWeek + 2;
    let minYear = currentYear;
    if (minWeek > weeksCurrentYear) {
      minWeek -= weeksCurrentYear;
      minYear += 1;
    }

    const chosenDate = getStartDateOfISOWeek(parsedWeek, parsedYear);
    const minDate = getStartDateOfISOWeek(minWeek, minYear);

    if (chosenDate < minDate) {
      return res.status(400).json({
        correlationId,
        error: 'INVALID_WEEK',
        details: `Je kunt pas stoppen vanaf week ${minWeek} (${minYear}). Opzegtermijn is minimaal 2 weken.`
      });
    }

    console.log(`🔄 [SM Stop Abonnement] Verwerken stop voor abonnement ${id} door schoonmaker ${schoonmakerId} [${correlationId}]`);

    // === HAAL ABONNEMENT OP (check dat schoonmaker_id matcht) ===
    const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${id}&schoonmaker_id=eq.${schoonmakerId}&select=id,status,gebruiker_id,uren,frequentie,schoonmaker_id`;

    const abonnementResponse = await httpClient(abonnementUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    }, correlationId);

    if (!abonnementResponse.ok) {
      throw new Error('Kan abonnement niet ophalen');
    }

    const abonnementen = await abonnementResponse.json();

    if (!abonnementen || abonnementen.length === 0) {
      return res.status(404).json({ correlationId, error: 'Abonnement niet gevonden' });
    }

    const abonnement = abonnementen[0];

    // Check of abonnement nog actief is
    if (abonnement.status === 'gestopt') {
      return res.status(400).json({ correlationId, error: 'Dit abonnement is al gestopt' });
    }

    // === SCHRIJF NAAR SCHOONMAKER_STOPGESCHIEDENIS ===
    console.log(`🔄 [SM Stop Abonnement] Writing to schoonmaker_stopgeschiedenis [${correlationId}]`);

    const stopUrl = `${supabaseConfig.url}/rest/v1/schoonmaker_stopgeschiedenis`;

    const stopResponse = await httpClient(stopUrl, {
      method: 'POST',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        abonnement_id: id,
        schoonmaker_id: schoonmakerId,
        reden: opzeg_reden.trim(),
        opzeg_week: parsedWeek,
        opzeg_jaar: parsedYear
      })
    }, correlationId);

    if (!stopResponse.ok) {
      const errorText = await stopResponse.text();
      console.error(`❌ [SM Stop Abonnement] Failed to write stop record [${correlationId}]`, errorText);
      throw new Error('Kon stopverzoek niet registreren');
    }

    // Schoonmaker_id wordt NIET direct op null gezet.
    // De cron job 'manage-schoonmaker-stops' verwerkt dit na de opzeg_week.
    console.log(`✅ [SM Stop Abonnement] Stop geregistreerd, schoonmaker behoudt toegang tot week ${parsedWeek} (${parsedYear}) [${correlationId}]`);

    // === HAAL GEGEVENS OP VOOR EMAILS ===
    // Schoonmaker profiel
    const smUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${schoonmakerId}&select=voornaam,achternaam,email`;
    const smResponse = await httpClient(smUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    }, correlationId);
    const smProfiles = await smResponse.json();
    const smProfile = smProfiles[0] || {};

    // Klant profiel
    const klantUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${abonnement.gebruiker_id}&select=voornaam,achternaam,email,telefoon,adres_id,adressen:adres_id(straat,huisnummer,toevoeging,postcode,plaats)`;
    const klantResponse = await httpClient(klantUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    }, correlationId);
    const klanten = await klantResponse.json();
    const klant = klanten[0] || {};
    const adres = klant.adressen;
    const volledigAdres = adres
      ? `${adres.straat} ${adres.huisnummer}${adres.toevoeging || ''}, ${adres.postcode} ${adres.plaats}`
      : 'Adres niet beschikbaar';

    // === VERZEND EMAIL NAAR ADMIN ===
    console.log(`📧 [SM Stop Abonnement] Sending admin email [${correlationId}]`);
    try {
      await sendEmail({
        to: emailConfig.notificationsEmail,
        subject: `⚠️ Schoonmaker gestopt - ${smProfile.voornaam} ${smProfile.achternaam}`,
        html: `
          <h2>⚠️ Schoonmaker is gestopt met abonnement</h2>
          <p><strong>Schoonmaker:</strong> ${smProfile.voornaam} ${smProfile.achternaam} (${smProfile.email})</p>
          <p><strong>Klant:</strong> ${klant.voornaam} ${klant.achternaam} (${klant.email})</p>
          <p><strong>Adres:</strong> ${volledigAdres}</p>
          <p><strong>Abonnement:</strong> ${abonnement.uren} uur, ${abonnement.frequentie}</p>
          <p><strong>Laatste week:</strong> Week ${parsedWeek} (${parsedYear})</p>
          <p><strong>Reden:</strong> ${opzeg_reden}</p>
          <hr>
          <p>⚡ <strong>Actie vereist:</strong> Wijs een nieuwe schoonmaker toe aan dit abonnement.</p>
          <p>Abonnement ID: <code>${id}</code></p>
        `
      }, correlationId);
      console.log(`✅ [SM Stop Abonnement] Admin email verzonden [${correlationId}]`);
    } catch (error) {
      console.error(`⚠️ [SM Stop Abonnement] Admin email failed [${correlationId}]`, error.message);
    }

    // === VERZEND EMAIL NAAR KLANT ===
    console.log(`📧 [SM Stop Abonnement] Sending klant email [${correlationId}]`);
    try {
      await sendEmail({
        to: klant.email,
        subject: 'Wijziging in jouw schoonmaak abonnement',
        html: `
          <h2>Wijziging in jouw abonnement</h2>
          <p>Beste ${klant.voornaam},</p>
          <p>Helaas heeft jouw schoonmaker ${smProfile.voornaam} aangegeven te stoppen met schoonmaken op jouw adres. De laatste schoonmaak is in week ${parsedWeek} (${parsedYear}).</p>
          <p>Geen zorgen, wij gaan direct op zoek naar een geschikte nieuwe schoonmaker voor je! Je ontvangt bericht zodra we iemand voor je gevonden hebben.</p>
          <p>In de tussentijd kun je bij vragen altijd contact met ons opnemen.</p>
          <p>Met vriendelijke groet,<br>Het Heppy team</p>
        `
      }, correlationId);
      console.log(`✅ [SM Stop Abonnement] Klant email verzonden [${correlationId}]`);
    } catch (error) {
      console.error(`⚠️ [SM Stop Abonnement] Klant email failed [${correlationId}]`, error.message);
    }

    return res.status(200).json({
      correlationId,
      message: 'Stopverzoek succesvol verwerkt',
      data: {
        id,
        opzeg_week: parsedWeek,
        opzeg_jaar: parsedYear
      }
    });

  } catch (error) {
    console.error(`❌ [SM Stop Abonnement] Error [${correlationId}]`, error.message);
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'dashboard/schoonmaker/stop-abonnement',
      action: 'error',
      error: error.message,
      schoonmakerId
    }));

    return res.status(500).json({
      correlationId,
      error: 'Er is een probleem opgetreden bij het verwerken van het stopverzoek'
    });
  }
}

// Export met auth middleware - alleen schoonmakers toegestaan
export default withAuth(stopAbonnementHandler, { roles: ['schoonmaker'] });
