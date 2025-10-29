// Flow: processSuccessfulPayment
// Orchestrates post-payment creation (user, address, aanvraag, abonnement, betaling, audit)
// NOTE: Implementation is placeholder; real logic will call services.
import { userService } from '../../services/userService.js';
import { addressService } from '../../services/addressService.js';
import { aanvraagService } from '../../services/aanvraagService.js';
import { abonnementService } from '../../services/abonnementService.js';
import { betalingService } from '../../services/betalingService.js';
import { auditService } from '../../services/auditService.js';
import { intakeService } from '../../services/intakeService.js';
import { voorkeursDagdelenService } from '../../services/voorkeursDagdelenService.js';
import * as schoonmaakMatchService from '../../services/schoonmaakMatchService.js';
import { sendEmail } from '../../services/emailService.js';
import { emailConfig } from '../../config/index.js';
import { 
  nieuweAanvraagAdmin, 
  betalingBevestigingKlant,
  matchToegewezenSchoonmaker 
} from '../../templates/emails/index.js';

export async function processSuccessfulPayment({ paymentIntent, metadata, correlationId, event }){
  console.log(`💰 [ProcessSuccessfulPayment] ========== START ========== [${correlationId}]`);
  console.log(`💰 [ProcessSuccessfulPayment] Payment Intent ID: ${paymentIntent.id}`);
  console.log(`💰 [ProcessSuccessfulPayment] Amount: ${paymentIntent.amount} ${paymentIntent.currency}`);
  console.log(`💰 [ProcessSuccessfulPayment] Metadata:`, JSON.stringify(metadata, null, 2));
  
  try {
    // NOTE: Oude tracking systeem verwijderd - nu gebruikt frontend simpleFunnelTracker.js
    
    // Intake naar betaald (optioneel - alleen voor intake flow, niet voor direct formulier orders)
    console.log(`📝 [ProcessSuccessfulPayment] Checking for intake record...`);
    try {
      await intakeService.updateStatus(paymentIntent.id, 'betaald', correlationId);
      console.log(`✅ [ProcessSuccessfulPayment] Intake status updated`);
    } catch (error) {
      // Intake is optioneel - niet alle orders komen via intake flow (sommige direct via formulier)
      console.log(`ℹ️ [ProcessSuccessfulPayment] No intake record found (skip, non-critical) [${correlationId}]`);
    }

    // Idempotency: betaling bestaat al?
    console.log(`🔍 [ProcessSuccessfulPayment] Checking for existing payment...`);
    let existingPayment;
    try {
      existingPayment = await betalingService.findByStripePaymentId(paymentIntent.id, correlationId);
    } catch (error) {
      console.error(`❌ [ProcessSuccessfulPayment] FAILED: Could not check existing payment [${correlationId}]`, {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Payment lookup failed: ${error.message}`);
    }
    
    if (existingPayment && existingPayment.abonnement_id){
      console.log(`⚠️ [ProcessSuccessfulPayment] Duplicate payment detected, skipping [${paymentIntent.id}]`);
      return { handled:true, duplicate:true, intent: paymentIntent.id, abonnement_id: existingPayment.abonnement_id };
    }
    console.log(`✅ [ProcessSuccessfulPayment] No duplicate found, continuing...`);

    // User
    console.log(`👤 [ProcessSuccessfulPayment] Creating/finding user for email: ${metadata.email}`);
    let user;
    try {
      user = await userService.findOrCreateByEmail(metadata, correlationId);
      console.log(`✅ [ProcessSuccessfulPayment] User ${user.created ? 'created' : 'found'}: ${user.id}`);
      await auditService.log('user_profile', user.id, user.created?'created':'reused', user.id, { email: metadata.email }, correlationId);
    } catch (error) {
      console.error(`❌ [ProcessSuccessfulPayment] FAILED: User creation error [${correlationId}]`, {
        error: error.message,
        stack: error.stack,
        metadata: { email: metadata.email, voornaam: metadata.voornaam, achternaam: metadata.achternaam }
      });
      throw new Error(`User creation failed: ${error.message}`);
    }

    // Address
    console.log(`📍 [ProcessSuccessfulPayment] Creating address...`);
    let address;
    try {
      address = await addressService.create(metadata, correlationId);
      console.log(`✅ [ProcessSuccessfulPayment] Address created: ${address.id}`);
      
      // Update user_profiles.adres_id nu we address hebben
      await userService.updateAdresId(user.id, address.id, correlationId);
      console.log(`✅ [ProcessSuccessfulPayment] user_profiles.adres_id updated`);
    } catch (error) {
      console.error(`❌ [ProcessSuccessfulPayment] FAILED: Address creation error [${correlationId}]`, {
        error: error.message,
        stack: error.stack,
        metadata: { straat: metadata.straat, huisnummer: metadata.huisnummer, postcode: metadata.postcode, plaats: metadata.plaats }
      });
      throw new Error(`Address creation failed: ${error.message}`);
    }

    // Aanvraag
    console.log(`📋 [ProcessSuccessfulPayment] Creating schoonmaak_aanvraag...`);
    let aanvraag;
    try {
      aanvraag = await aanvraagService.create(metadata, address.id, correlationId);
      console.log(`✅ [ProcessSuccessfulPayment] Aanvraag created: ${aanvraag.id}`);
      await auditService.log('schoonmaak_aanvraag', aanvraag.id, 'created', user.id, { intent: paymentIntent.id }, correlationId);
      
      // 📧 EMAIL TRIGGER 1: Nieuwe aanvraag → Admin
      console.log(`📧 [ProcessSuccessfulPayment] Sending email to admin (nieuwe aanvraag)...`);
      try {
        const schoonmakerNaam = metadata.schoonmaker_naam || null;
        const autoAssigned = metadata.auto_assigned === 'true';
        
        // User data komt uit metadata (niet uit user object - die heeft alleen id)
        const klantNaam = `${metadata.voornaam || ''} ${metadata.achternaam || ''}`.trim();
        
        const adminEmailHtml = nieuweAanvraagAdmin({
          klantNaam,
          klantEmail: metadata.email,
          plaats: metadata.plaats,
          uren: parseInt(metadata.uren || metadata.gewenste_uren) || 0,
          dagdelen: metadata.dagdelen || [],
          startdatum: metadata.startdatum,
          schoonmakerNaam,
          autoAssigned,
          aanvraagId: aanvraag.id,
          bedrag: paymentIntent.amount / 100 // Cents naar euros
        });
        
        await sendEmail({
          to: emailConfig.notificationsEmail,
          subject: `🆕 Nieuwe Aanvraag - ${klantNaam} (${metadata.plaats})`,
          html: adminEmailHtml
        }, correlationId);
        
        console.log(`✅ [ProcessSuccessfulPayment] Admin email verzonden`);
      } catch (emailError) {
        console.error(`⚠️ [ProcessSuccessfulPayment] Admin email failed (non-critical) [${correlationId}]`, {
          error: emailError.message
        });
        // Email failure mag flow niet breken
      }
      
    } catch (error) {
      console.error(`❌ [ProcessSuccessfulPayment] FAILED: Aanvraag creation error [${correlationId}]`, {
        error: error.message,
        stack: error.stack,
        userId: user.id,
        addressId: address.id
      });
      throw new Error(`Aanvraag creation failed: ${error.message}`);
    }

    // Abonnement
    console.log(`📅 [ProcessSuccessfulPayment] Creating abonnement...`);
    let abonnement;
    try {
      abonnement = await abonnementService.create(metadata, user.id, aanvraag.id, correlationId);
      console.log(`✅ [ProcessSuccessfulPayment] Abonnement created: ${abonnement.id}`);
      await auditService.log('abonnement', abonnement.id, 'created', user.id, { intent: paymentIntent.id }, correlationId);
    } catch (error) {
      console.error(`❌ [ProcessSuccessfulPayment] FAILED: Abonnement creation error [${correlationId}]`, {
        error: error.message,
        stack: error.stack,
        userId: user.id,
        aanvraagId: aanvraag.id
      });
      throw new Error(`Abonnement creation failed: ${error.message}`);
    }

    // Betaling koppelen / maken
    console.log(`💳 [ProcessSuccessfulPayment] Creating/linking payment record...`);
    let betaling;
    try {
      betaling = await betalingService.linkOrCreate({
        stripeId: paymentIntent.id,
        userId: user.id,
        abonnementId: abonnement.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: 'betaald',
        stripe_status: paymentIntent.status,
        betaalmethode: paymentIntent.payment_method || null
      }, correlationId);
      console.log(`✅ [ProcessSuccessfulPayment] Payment ${betaling.updated ? 'updated' : 'created'}: ${betaling.id}`);
      await auditService.log('betaling', betaling.id, betaling.updated?'updated':'created', user.id, { amount_cents: paymentIntent.amount }, correlationId);
      
      // 📧 EMAIL TRIGGER 2: Betaling bevestiging → Klant
      console.log(`📧 [ProcessSuccessfulPayment] Sending email to klant (betaling bevestiging)...`);
      try {
        const schoonmakerNaam = metadata.schoonmaker_naam || null;
        const autoAssigned = metadata.auto_assigned === 'true';
        const klantNaam = `${metadata.voornaam || ''} ${metadata.achternaam || ''}`.trim();
        
        const klantEmailHtml = betalingBevestigingKlant({
          klantNaam,
          plaats: metadata.plaats,
          uren: parseInt(metadata.uren || metadata.gewenste_uren) || 0,
          dagdelen: metadata.dagdelen || [],
          startdatum: metadata.startdatum,
          schoonmakerNaam,
          autoAssigned,
          bedrag: paymentIntent.amount / 100, // Cents naar euros
          betalingId: paymentIntent.id
        });
        
        await sendEmail({
          to: metadata.email,
          subject: '✅ Betaling Bevestiging - Heppy Schoonmaak',
          html: klantEmailHtml
        }, correlationId);
        
        console.log(`✅ [ProcessSuccessfulPayment] Klant email verzonden naar ${metadata.email}`);
      } catch (emailError) {
        console.error(`⚠️ [ProcessSuccessfulPayment] Klant email failed (non-critical) [${correlationId}]`, {
          error: emailError.message
        });
        // Email failure mag flow niet breken
      }
      
    } catch (error) {
      console.error(`❌ [ProcessSuccessfulPayment] FAILED: Payment record creation error [${correlationId}]`, {
        error: error.message,
        stack: error.stack,
        stripeId: paymentIntent.id,
        userId: user.id,
        abonnementId: abonnement.id
      });
      throw new Error(`Payment record creation failed: ${error.message}`);
    }

    // Voorkeurs dagdelen opslaan (indien aanwezig in metadata)
    if (metadata.dagdelen) {
      console.log(`📅 [ProcessSuccessfulPayment] Saving voorkeurs_dagdelen...`);
      try {
        // Dagdelen komt als JSON string vanuit frontend
        let dagdelenObject = metadata.dagdelen;
        if (typeof metadata.dagdelen === 'string') {
          try {
            dagdelenObject = JSON.parse(metadata.dagdelen);
          } catch (parseError) {
            console.error(`⚠️ [ProcessSuccessfulPayment] Could not parse dagdelen JSON [${correlationId}]`, metadata.dagdelen);
            dagdelenObject = null;
          }
        }
        
        if (dagdelenObject && typeof dagdelenObject === 'object' && Object.keys(dagdelenObject).length > 0) {
          await voorkeursDagdelenService.create({
            gebruikerId: user.id,
            dagdelen: dagdelenObject
          }, correlationId);
          console.log(`✅ [ProcessSuccessfulPayment] Voorkeurs_dagdelen saved`);
          await auditService.log('voorkeurs_dagdelen', user.id, 'created', user.id, { dagdelen: dagdelenObject }, correlationId);
        } else {
          console.log(`ℹ️ [ProcessSuccessfulPayment] Dagdelen is empty or invalid, skipping`);
        }
      } catch (error) {
        // Niet-fataal: log maar gooi geen error
        console.error(`⚠️ [ProcessSuccessfulPayment] WARNING: Dagdelen save failed [${correlationId}]`, {
          error: error.message,
          stack: error.stack,
          userId: user.id,
          dagdelen: metadata.dagdelen
        });
        // Continue zonder te falen - dagdelen is nice-to-have
      }
    } else {
      console.log(`ℹ️ [ProcessSuccessfulPayment] No dagdelen in metadata, skipping`);
    }

    // Schoonmaak match opslaan (schoonmaker koppeling)
    console.log(`🤝 [ProcessSuccessfulPayment] Creating schoonmaak match...`);
    let schoonmaakMatch;
    try {
      const schoonmakerId = metadata.schoonmaker_id === 'geenVoorkeur' ? null : metadata.schoonmaker_id;
      const autoAssigned = metadata.auto_assigned === 'true'; // String naar boolean
      
      schoonmaakMatch = await schoonmaakMatchService.create({
        aanvraagId: aanvraag.id,
        schoonmakerId: schoonmakerId,
        abonnementId: abonnement.id,
        autoAssigned: autoAssigned  // ✨ Track "geen voorkeur" selectie
      }, correlationId);
      
      console.log(`✅ [ProcessSuccessfulPayment] Schoonmaak match created`, {
        match_id: schoonmaakMatch.id,
        schoonmaker_id: schoonmakerId || 'none',
        auto_assigned: autoAssigned
      });
      
      await auditService.log('schoonmaak_match', aanvraag.id, 'created', user.id, { 
        schoonmaker_id: schoonmakerId || 'geen voorkeur',
        abonnement_id: abonnement.id,
        auto_assigned: autoAssigned
      }, correlationId);
      
      // 📧 EMAIL TRIGGER 3: Match toegewezen → Schoonmaker (alleen als schoonmaker bekend is)
      if (schoonmakerId) {
        console.log(`📧 [ProcessSuccessfulPayment] Sending email to schoonmaker (match toegewezen)...`);
        try {
          // Haal schoonmaker gegevens op via directe Supabase query
          const { supabaseConfig } = await import('../../config/index.js');
          const supabaseUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${schoonmakerId}&select=*`;
          const response = await fetch(supabaseUrl, {
            method: 'GET',
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${supabaseConfig.anonKey}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch schoonmaker: ${response.status}`);
          }

          const schoonmakerData = await response.json();
          const schoonmakerResponse = schoonmakerData[0];
          
          // Klant naam uit metadata
          const klantNaam = `${metadata.voornaam || ''} ${metadata.achternaam || ''}`.trim();
          
          if (schoonmakerResponse && schoonmakerResponse.email) {
            const schoonmakerEmailHtml = matchToegewezenSchoonmaker({
              schoonmakerNaam: `${schoonmakerResponse.voornaam || ''} ${schoonmakerResponse.achternaam || ''}`.trim(),
              klantNaam,
              adres: `${address.straat} ${address.huisnummer}${address.toevoeging || ''}`,
              plaats: address.plaats,
              postcode: address.postcode,
              uren: parseInt(metadata.uren || metadata.gewenste_uren) || 0,
              dagdelen: metadata.dagdelen || [],
              startdatum: metadata.startdatum,
              autoAssigned,
              aanvraagId: aanvraag.id,
              matchId: schoonmaakMatch.id // Gebruik echte match ID
            });
            
            await sendEmail({
              to: schoonmakerResponse.email,
              subject: `🎉 Nieuwe Aanvraag Voor U - ${klantNaam}`,
              html: schoonmakerEmailHtml
            }, correlationId);
            
            console.log(`✅ [ProcessSuccessfulPayment] Schoonmaker email verzonden naar ${schoonmakerResponse.email}`);
          } else {
            console.warn(`⚠️ [ProcessSuccessfulPayment] Schoonmaker email niet gevonden [${correlationId}]`, {
              schoonmakerId
            });
          }
        } catch (emailError) {
          console.error(`⚠️ [ProcessSuccessfulPayment] Schoonmaker email failed (non-critical) [${correlationId}]`, {
            error: emailError.message,
            schoonmakerId
          });
          // Email failure mag flow niet breken
        }
      } else {
        console.log(`ℹ️ [ProcessSuccessfulPayment] Geen schoonmaker geselecteerd, skip email naar schoonmaker`);
      }
      
    } catch (error) {
      console.error(`❌ [ProcessSuccessfulPayment] FAILED: Match creation error [${correlationId}]`, {
        error: error.message,
        stack: error.stack,
        aanvraagId: aanvraag.id,
        schoonmakerId: metadata.schoonmaker_id
      });
      throw new Error(`Match creation failed: ${error.message}`);
    }

    // NOTE: Tracking wordt nu volledig door frontend simpleFunnelTracker.js afgehandeld
    // Geen backend tracking sessies meer nodig

    console.log(`🎉 [ProcessSuccessfulPayment] ========== SUCCESS ========== [${correlationId}]`);
    return { handled:true, intent: paymentIntent.id, abonnement_id: abonnement.id };
    
  } catch (error) {
    // Top-level error catch - dit zou ALTIJD moeten loggen
    console.error(`🔥 [ProcessSuccessfulPayment] ========== CRITICAL FAILURE ========== [${correlationId}]`);
    console.error(`🔥 [ProcessSuccessfulPayment] Payment Intent: ${paymentIntent.id}`);
    console.error(`🔥 [ProcessSuccessfulPayment] Error: ${error.message}`);
    console.error(`🔥 [ProcessSuccessfulPayment] Stack:`, error.stack);
    console.error(`🔥 [ProcessSuccessfulPayment] Full metadata:`, JSON.stringify(metadata, null, 2));
    
    // Re-throw zodat webhook handler het kan afhandelen
    throw error;
  }
}
