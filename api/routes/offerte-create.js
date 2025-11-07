/**
 * API Route: Offerte Aanvraag Creëren
 * 
 * POST /api/routes/offerte/create
 * 
 * Flow:
 * 1. Guest of ingelogde klant vult offerte aanvraag formulier in
 * 2. Geen betaling vereist (komt later na offerte goedkeuring)
 * 3. Creëer/vind user
 * 4. Creëer adres
 * 5. Creëer opdracht met offerte_status='nog_niet_verstuurd'
 * 6. Verstuur 2 emails: admin + klant (NO schoonmaker email)
 * 7. Return opdracht_id naar frontend
 * 
 * Request Body:
 * {
 *   "type": "bankreiniging",
 *   "voornaam": "Jan",
 *   "achternaam": "Jansen",
 *   "email": "jan@example.com",
 *   "telefoon": "0612345678",
 *   "wachtwoord": "optional_password",  // Alleen voor guest users die account willen
 *   "straat": "Hamerstraat",
 *   "huisnummer": "19",
 *   "postcode": "1021JT",
 *   "plaats": "Amsterdam",
 *   "dagdelenVoorkeur": { "maandag": ["ochtend"], "dinsdag": ["middag"] },
 *   "geenVoorkeurDagdelen": false,
 *   "rbs_banken": 2,
 *   "rbs_stoelen": 4,
 *   "rbs_zitvlakken": 8,
 *   "rbs_kussens": 2,
 *   "rbs_materialen": ["stof", "leer"],
 *   "rbs_specificaties": "Extra aandacht voor vlekken"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "opdracht_id": "uuid"
 * }
 */

import { userService } from '../services/userService.js';
import { addressService } from '../services/addressService.js';
import { auditService } from '../services/auditService.js';
import { sendEmail } from '../services/emailService.js';
import { supabaseConfig, emailConfig } from '../config/index.js';
import { handleErrorResponse } from '../utils/errorHandler.js';
import { 
  nieuweBankReinigingAdmin, 
  bankReinigingBevestigingKlant,
  nieuweTapijtReinigingAdmin,
  tapijtReinigingBevestigingKlant
} from '../templates/emails/index.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Correlation ID voor tracing
  const correlationId = req.headers['x-correlation-id'] || `offerte-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`📋 [OfferteCreate] ========== START ========== [${correlationId}]`);
  console.log(`📋 [OfferteCreate] Request body:`, JSON.stringify(req.body, null, 2));

  try {
    const {
      type,
      voornaam,
      achternaam,
      email,
      telefoon,
      wachtwoord,
      straat,
      huisnummer,
      toevoeging,
      postcode,
      plaats,
      dagdelenVoorkeur,
      geenVoorkeurDagdelen,
      // Bank & Stoelen reiniging velden
      rbs_banken,
      rbs_stoelen,
      rbs_zitvlakken,
      rbs_kussens,
      rbs_materialen,
      rbs_specificaties,
      // Tapijt reiniging velden
      rt_totaal_m2,
      rt_opties,
      rt_opties_allergie,
      rt_opties_ontgeuren_urine,
      rt_opties_ontgeuren_overig
    } = req.body;

    // Validatie
    if (!type || !email || !voornaam || !achternaam || !straat || !huisnummer || !postcode || !plaats) {
      console.error(`❌ [OfferteCreate] Validation failed: missing required fields [${correlationId}]`);
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR',
        message: 'Verplichte velden ontbreken' 
      });
    }

    // Alleen bankreiniging en tapijt types toegestaan voorlopig
    if (type !== 'bankreiniging' && type !== 'tapijt') {
      console.error(`❌ [OfferteCreate] Unsupported type: ${type} [${correlationId}]`);
      return res.status(400).json({ 
        error: 'UNSUPPORTED_TYPE',
        message: 'Ongeldig offerte type' 
      });
    }

    // STAP 1: User aanmaken of vinden
    console.log(`👤 [OfferteCreate] Creating/finding user for email: ${email}`);
    let user;
    try {
      const metadata = {
        email,
        voornaam,
        achternaam,
        telefoon: telefoon || null,
        wachtwoord: wachtwoord || null  // Optioneel voor offerte
      };
      
      user = await userService.findOrCreateByEmail(metadata, correlationId);
      console.log(`✅ [OfferteCreate] User ${user.created ? 'created' : 'found'}: ${user.id}`);
      await auditService.log('user_profile', user.id, user.created ? 'created' : 'reused', user.id, { email, type: 'offerte' }, correlationId);
    } catch (error) {
      console.error(`❌ [OfferteCreate] User creation failed [${correlationId}]:`, error.message);
      throw new Error(`User creation failed: ${error.message}`);
    }

    // STAP 2: Adres aanmaken
    console.log(`📍 [OfferteCreate] Creating address...`);
    let address;
    try {
      const addressMetadata = {
        straat,
        huisnummer,
        toevoeging: toevoeging || null,
        postcode,
        plaats
      };
      
      address = await addressService.create(addressMetadata, correlationId);
      console.log(`✅ [OfferteCreate] Address created: ${address.id}`);
      
      // Update user_profiles.adres_id
      await userService.updateAdresId(user.id, address.id, correlationId);
      console.log(`✅ [OfferteCreate] user_profiles.adres_id updated`);
    } catch (error) {
      console.error(`❌ [OfferteCreate] Address creation failed [${correlationId}]:`, error.message);
      throw new Error(`Address creation failed: ${error.message}`);
    }

    // STAP 3: Opdracht aanmaken met offerte_status
    console.log(`📋 [OfferteCreate] Creating opdracht (${type})...`);
    let opdracht;
    try {
      // Prepare gegevens JSON based on type
      let gegevens = {
        // Klant gegevens
        email,
        voornaam,
        achternaam,
        telefoon: telefoon || null,
        // Adres gegevens
        straat,
        huisnummer,
        toevoeging: toevoeging || null,
        postcode,
        plaats,
        adres_id: address.id,
        // Dagdelen voorkeur
        dagdelenVoorkeur: dagdelenVoorkeur || null,
        geenVoorkeurDagdelen: geenVoorkeurDagdelen || false
      };

      // Add type-specific fields
      if (type === 'bankreiniging') {
        gegevens = {
          ...gegevens,
          rbs_banken: parseInt(rbs_banken) || 0,
          rbs_stoelen: parseInt(rbs_stoelen) || 0,
          rbs_zitvlakken: parseInt(rbs_zitvlakken) || 0,
          rbs_kussens: parseInt(rbs_kussens) || 0,
          rbs_materialen: rbs_materialen || [],
          rbs_specificaties: rbs_specificaties || null
        };
      } else if (type === 'tapijt') {
        gegevens = {
          ...gegevens,
          rt_totaal_m2: parseInt(rt_totaal_m2) || 0,
          rt_opties: rt_opties || [],
          rt_opties_allergie: rt_opties_allergie || false,
          rt_opties_ontgeuren_urine: rt_opties_ontgeuren_urine || false,
          rt_opties_ontgeuren_overig: rt_opties_ontgeuren_overig || false
        };
      }

      const opdrachtPayload = {
        gebruiker_id: user.id,
        schoonmaker_id: null,  // Wordt later toegewezen door admin
        type: type,
        status: 'aangevraagd',
        offerte_status: 'nog_niet_verstuurd',  // ⭐ BELANGRIJK: Admin moet offerte maken
        gewenste_datum: null,  // Geen specifieke datum bij offerte aanvraag
        totaalbedrag: null,  // Wordt bepaald na offerte
        betaalstatus: null,  // Nog niet betaald (komt na offerte acceptatie)
        gegevens: gegevens
      };
      
      const supabaseUrl = `${supabaseConfig.url}/rest/v1/opdrachten`;
      const response = await fetch(supabaseUrl, {
        method: 'POST',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(opdrachtPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Opdracht creation failed: ${response.status} - ${errorText}`);
      }

      const opdrachtData = await response.json();
      opdracht = opdrachtData[0];
      
      console.log(`✅ [OfferteCreate] Opdracht created: ${opdracht.id}`);
      await auditService.log('opdrachten', opdracht.id, 'created', user.id, { type, offerte_status: 'nog_niet_verstuurd' }, correlationId);
      
    } catch (error) {
      console.error(`❌ [OfferteCreate] Opdracht creation failed [${correlationId}]:`, error.message);
      throw new Error(`Opdracht creation failed: ${error.message}`);
    }

    // STAP 4: Emails versturen
    console.log(`📧 [OfferteCreate] Sending email notifications...`);
    
    // Prepare email data based on type
    let emailData;
    let adminSubject;
    let clientSubject;
    let adminTemplate;
    let clientTemplate;

    if (type === 'bankreiniging') {
      emailData = {
        klantNaam: `${voornaam} ${achternaam}`,
        klantEmail: email,
        klantTelefoon: telefoon || '—',
        plaats: plaats,
        adres: `${straat} ${huisnummer}${toevoeging ? toevoeging : ''}`,
        postcode: postcode,
        dagdelenVoorkeur: dagdelenVoorkeur,
        geenVoorkeurDagdelen: geenVoorkeurDagdelen || false,
        aantalBanken: parseInt(rbs_banken) || 0,
        aantalStoelen: parseInt(rbs_stoelen) || 0,
        aantalZitvlakken: parseInt(rbs_zitvlakken) || 0,
        aantalKussens: parseInt(rbs_kussens) || 0,
        materialen: rbs_materialen || [],
        specificaties: rbs_specificaties || null,
        opdrachtId: opdracht.id
      };
      adminSubject = '🆕 Nieuwe Bank & Stoelen Reiniging Offerte Aanvraag';
      clientSubject = '✅ Offerte Aanvraag Ontvangen - Bank & Stoelen Reiniging';
      adminTemplate = nieuweBankReinigingAdmin;
      clientTemplate = bankReinigingBevestigingKlant;
    } else if (type === 'tapijt') {
      emailData = {
        klantNaam: `${voornaam} ${achternaam}`,
        klantEmail: email,
        klantTelefoon: telefoon || '—',
        plaats: plaats,
        adres: `${straat} ${huisnummer}${toevoeging ? toevoeging : ''}`,
        postcode: postcode,
        dagdelenVoorkeur: dagdelenVoorkeur,
        geenVoorkeurDagdelen: geenVoorkeurDagdelen || false,
        totaalM2: parseInt(rt_totaal_m2) || 0,
        opties: rt_opties || [],
        opdrachtId: opdracht.id
      };
      adminSubject = '🆕 Nieuwe Tapijt Reiniging Offerte Aanvraag';
      clientSubject = '✅ Offerte Aanvraag Ontvangen - Tapijt Reiniging';
      adminTemplate = nieuweTapijtReinigingAdmin;
      clientTemplate = tapijtReinigingBevestigingKlant;
    }

    // 4a. Admin notification email
    try {
      await sendEmail({
        to: emailConfig.notificationsEmail,
        subject: adminSubject,
        html: adminTemplate(emailData)
      }, correlationId);
      console.log(`✅ [OfferteCreate] Admin notification email sent to ${emailConfig.notificationsEmail}`);
    } catch (error) {
      console.error(`⚠️ [OfferteCreate] Failed to send admin email [${correlationId}]:`, error.message);
      // Don't throw - continue with client email
    }

    // Delay tussen emails (rate limit protection: max 2 per second)
    await new Promise(resolve => setTimeout(resolve, 600));

    // 4b. Client confirmation email
    try {
      await sendEmail({
        to: email,
        subject: clientSubject,
        html: clientTemplate(emailData)
      }, correlationId);
      console.log(`✅ [OfferteCreate] Client confirmation email sent to ${email}`);
    } catch (error) {
      console.error(`⚠️ [OfferteCreate] Failed to send client email [${correlationId}]:`, error.message);
      // Don't throw - this is not critical
    }

    console.log(`🎉 [OfferteCreate] ========== SUCCESS ========== [${correlationId}]`);
    return res.status(200).json({ 
      success: true, 
      opdracht_id: opdracht.id 
    });
    
  } catch (error) {
    console.error(`🔥 [OfferteCreate] ========== CRITICAL FAILURE ========== [${correlationId}]`);
    console.error(`🔥 [OfferteCreate] Error: ${error.message}`);
    console.error(`🔥 [OfferteCreate] Stack:`, error.stack);
    
    return handleErrorResponse(res, error, 500, correlationId);
  }
}
