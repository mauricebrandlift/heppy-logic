// Flow: processDieptereinigingPayment
// Orchestrates post-payment creation for dieptereiniging orders
// Similar to processSuccessfulPayment but creates opdrachten instead of abonnement

import { userService } from '../../services/userService.js';
import { addressService } from '../../services/addressService.js';
import { betalingService } from '../../services/betalingService.js';
import { auditService } from '../../services/auditService.js';
import * as schoonmaakMatchService from '../../services/schoonmaakMatchService.js';
import { sendEmail } from '../../services/emailService.js';
import { emailConfig } from '../../config/index.js';
import { 
  nieuweDieptereinigingAdmin, 
  dieptereinigingBevestigingKlant, 
  dieptereinigingToegewezenSchoonmaker 
} from '../../templates/emails/index.js';

export async function processDieptereinigingPayment({ paymentIntent, metadata, correlationId, event }) {
  console.log(`💰 [ProcessDieptereiniging] ========== START ========== [${correlationId}]`);
  console.log(`💰 [ProcessDieptereiniging] Payment Intent ID: ${paymentIntent.id}`);
  console.log(`💰 [ProcessDieptereiniging] Amount: ${paymentIntent.amount} ${paymentIntent.currency}`);
  console.log(`💰 [ProcessDieptereiniging] Metadata:`, JSON.stringify(metadata, null, 2));
  
  try {
    // Idempotency: betaling bestaat al?
    console.log(`🔍 [ProcessDieptereiniging] Checking for existing payment...`);
    let existingPayment;
    try {
      existingPayment = await betalingService.findByStripePaymentId(paymentIntent.id, correlationId);
    } catch (error) {
      console.error(`❌ [ProcessDieptereiniging] FAILED: Could not check existing payment [${correlationId}]`, {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Payment lookup failed: ${error.message}`);
    }
    
    if (existingPayment && existingPayment.opdracht_id) {
      console.log(`⚠️ [ProcessDieptereiniging] Duplicate payment detected, skipping [${paymentIntent.id}]`);
      return { handled: true, duplicate: true, intent: paymentIntent.id, opdracht_id: existingPayment.opdracht_id };
    }
    console.log(`✅ [ProcessDieptereiniging] No duplicate found, continuing...`);

    // User
    console.log(`👤 [ProcessDieptereiniging] Creating/finding user for email: ${metadata.email}`);
    let user;
    try {
      user = await userService.findOrCreateByEmail(metadata, correlationId);
      console.log(`✅ [ProcessDieptereiniging] User ${user.created ? 'created' : 'found'}: ${user.id}`);
      await auditService.log('user_profile', user.id, user.created ? 'created' : 'reused', user.id, { email: metadata.email }, correlationId);
    } catch (error) {
      console.error(`❌ [ProcessDieptereiniging] FAILED: User creation error [${correlationId}]`, {
        error: error.message,
        stack: error.stack,
        metadata: { email: metadata.email, voornaam: metadata.voornaam, achternaam: metadata.achternaam }
      });
      throw new Error(`User creation failed: ${error.message}`);
    }

    // Address
    console.log(`📍 [ProcessDieptereiniging] Creating address...`);
    let address;
    try {
      address = await addressService.create(metadata, correlationId);
      console.log(`✅ [ProcessDieptereiniging] Address created: ${address.id}`);
      
      // Update user_profiles.adres_id
      await userService.updateAdresId(user.id, address.id, correlationId);
      console.log(`✅ [ProcessDieptereiniging] user_profiles.adres_id updated`);
    } catch (error) {
      console.error(`❌ [ProcessDieptereiniging] FAILED: Address creation error [${correlationId}]`, {
        error: error.message,
        stack: error.stack,
        metadata: { straat: metadata.straat, huisnummer: metadata.huisnummer, postcode: metadata.postcode, plaats: metadata.plaats }
      });
      throw new Error(`Address creation failed: ${error.message}`);
    }

    // Opdracht (dieptereiniging order)
    console.log(`📋 [ProcessDieptereiniging] Creating opdracht (dieptereiniging)...`);
    let opdracht;
    try {
      // Parse dr_ metadata
      const drUren = parseFloat(metadata.dr_uren) || 0;
      const drM2 = parseInt(metadata.dr_m2) || 0;
      const drToiletten = parseInt(metadata.dr_toiletten) || 0;
      const drBadkamers = parseInt(metadata.dr_badkamers) || 0;
      const drDatum = metadata.dr_datum || null;
      
      // Bereken totaalbedrag in euros
      const totaalbedrag = (paymentIntent.amount / 100).toFixed(2);
      
      // Prepare gegevens JSON (inclusief adres_id EN klant gegevens voor emails later)
      const gegevens = {
        // Klant gegevens (voor emails bij approve/reject)
        email: metadata.email,
        voornaam: metadata.voornaam,
        achternaam: metadata.achternaam,
        telefoon: metadata.telefoon || null,
        // Adres gegevens
        straat: metadata.straat,
        huisnummer: metadata.huisnummer,
        postcode: metadata.postcode,
        plaats: metadata.plaats,
        adres_id: address.id,  // Store for reference (user_profiles.adres_id has the actual FK)
        // Dieptereiniging specifieke data
        dr_uren: drUren,
        dr_m2: drM2,
        dr_toiletten: drToiletten,
        dr_badkamers: drBadkamers,
        calc_price_per_hour: parseFloat(metadata.calc_price_per_hour) || null,
        calc_total_amount_eur: parseFloat(metadata.calc_total_amount_eur) || null
      };

      // Insert into opdrachten table
      const { supabaseConfig } = await import('../../config/index.js');
      const supabaseUrl = `${supabaseConfig.url}/rest/v1/opdrachten`;
      
      const opdrachtPayload = {
        gebruiker_id: user.id,
        schoonmaker_id: null,  // Only set after schoonmaker accepts (via approve endpoint)
        // Note: opdrachten table has no adres_id column; adres linked via user_profiles.adres_id
        type: 'dieptereiniging',
        status: 'aangevraagd',
        gewenste_datum: drDatum,
        totaalbedrag: totaalbedrag,
        betaalstatus: 'betaald',  // Payment already succeeded
        gegevens: gegevens
      };
      
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
      
      console.log(`✅ [ProcessDieptereiniging] Opdracht created: ${opdracht.id}`);
      await auditService.log('opdrachten', opdracht.id, 'created', user.id, { intent: paymentIntent.id, type: 'dieptereiniging' }, correlationId);
      
    } catch (error) {
      console.error(`❌ [ProcessDieptereiniging] FAILED: Opdracht creation error [${correlationId}]`, {
        error: error.message,
        stack: error.stack,
        userId: user.id,
        addressId: address.id
      });
      throw new Error(`Opdracht creation failed: ${error.message}`);
    }

    // Betaling koppelen / maken
    console.log(`💳 [ProcessDieptereiniging] Creating/linking payment record...`);
    let betaling;
    try {
      betaling = await betalingService.linkOrCreate({
        stripeId: paymentIntent.id,
        userId: user.id,
        opdrachtId: opdracht.id,  // Link to opdracht instead of abonnement
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: 'betaald',
        stripe_status: paymentIntent.status,
        betaalmethode: paymentIntent.payment_method || null
      }, correlationId);
      console.log(`✅ [ProcessDieptereiniging] Payment ${betaling.updated ? 'updated' : 'created'}: ${betaling.id}`);
      await auditService.log('betaling', betaling.id, betaling.updated ? 'updated' : 'created', user.id, { amount_cents: paymentIntent.amount }, correlationId);
      
    } catch (error) {
      console.error(`❌ [ProcessDieptereiniging] FAILED: Payment record creation error [${correlationId}]`, {
        error: error.message,
        stack: error.stack,
        stripeId: paymentIntent.id,
        userId: user.id,
        opdrachtId: opdracht.id
      });
      throw new Error(`Payment record creation failed: ${error.message}`);
    }

    // Schoonmaak match opslaan (schoonmaker koppeling)
    console.log(`🤝 [ProcessDieptereiniging] Creating schoonmaak match...`);
    let schoonmaakMatch;
    let finalSchoonmakerId = null;
    let finalAutoAssigned = false;
    
    try {
      // Handle schoonmaker_id: can be undefined, 'geenVoorkeur', 'undefined' (string), or valid UUID
      const rawSchoonmakerId = metadata.schoonmaker_id;
      const isGeenVoorkeur = (!rawSchoonmakerId || rawSchoonmakerId === 'geenVoorkeur' || rawSchoonmakerId === 'undefined');
      
      if (isGeenVoorkeur) {
        // Auto-assign eerste beschikbare schoonmaker
        console.log(`🤖 [ProcessDieptereiniging] Geen voorkeur - auto-assigning eerste beschikbare schoonmaker...`);
        
        try {
          const { supabaseConfig } = await import('../../config/index.js');
          const supabaseUrl = `${supabaseConfig.url}/rest/v1/user_profiles?rol=eq.schoonmaker&select=id,voornaam,achternaam,email&limit=1`;
          const response = await fetch(supabaseUrl, {
            method: 'GET',
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${supabaseConfig.anonKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const schoonmakers = await response.json();
            if (schoonmakers && schoonmakers.length > 0) {
              finalSchoonmakerId = schoonmakers[0].id;
              finalAutoAssigned = true;
              console.log(`✅ [ProcessDieptereiniging] Auto-assigned schoonmaker: ${schoonmakers[0].voornaam} ${schoonmakers[0].achternaam} (${finalSchoonmakerId})`);
            } else {
              console.warn(`⚠️ [ProcessDieptereiniging] No schoonmaker found for auto-assignment`);
            }
          } else {
            console.error(`❌ [ProcessDieptereiniging] Failed to fetch schoonmaker for auto-assignment: ${response.status}`);
          }
        } catch (autoAssignError) {
          console.error(`❌ [ProcessDieptereiniging] Auto-assignment failed:`, autoAssignError.message);
          // Continue without schoonmaker - admin kan later toewijzen
        }
      } else {
        // Klant heeft specifieke schoonmaker gekozen
        finalSchoonmakerId = rawSchoonmakerId;
        finalAutoAssigned = metadata.auto_assigned === 'true';
      }
      
      schoonmaakMatch = await schoonmaakMatchService.create({
        opdrachtId: opdracht.id,
        schoonmakerId: finalSchoonmakerId,
        autoAssigned: finalAutoAssigned
      }, correlationId);
      
      console.log(`✅ [ProcessDieptereiniging] Schoonmaak match created`, {
        match_id: schoonmaakMatch.id,
        schoonmaker_id: finalSchoonmakerId || 'none',
        auto_assigned: finalAutoAssigned
      });
      
      await auditService.log('schoonmaak_match', opdracht.id, 'created', user.id, { 
        schoonmaker_id: finalSchoonmakerId || 'geen voorkeur',
        opdracht_id: opdracht.id,
        auto_assigned: finalAutoAssigned
      }, correlationId);
      
    } catch (error) {
      console.error(`❌ [ProcessDieptereiniging] FAILED: Match creation error [${correlationId}]`, {
        error: error.message,
        stack: error.stack,
        opdrachtId: opdracht.id,
        schoonmakerId: metadata.schoonmaker_id
      });
      throw new Error(`Match creation failed: ${error.message}`);
    }

    // Prepare email data for admin and client notifications
    // Note: Schoonmaker email is sent later when they accept the opdracht (via approve endpoint)
    console.log(`📧 [ProcessDieptereiniging] Sending email notifications...`);
    
    const emailData = {
      klantNaam: `${metadata.voornaam} ${metadata.achternaam}`,
      klantEmail: metadata.email,
      plaats: metadata.plaats,
      adres: `${metadata.straat} ${metadata.huisnummer}`,
      postcode: metadata.postcode,
      uren: parseFloat(metadata.dr_uren),
      m2: metadata.dr_m2 ? parseInt(metadata.dr_m2) : null,
      toiletten: metadata.dr_toiletten ? parseInt(metadata.dr_toiletten) : null,
      badkamers: metadata.dr_badkamers ? parseInt(metadata.dr_badkamers) : null,
      gewensteDatum: metadata.dr_datum,
      schoonmakerNaam: null,  // Not assigned yet
      autoAssigned: false,
      bedrag: paymentIntent.amount / 100, // Convert cents to euros
      betalingId: paymentIntent.id,
      opdrachtId: opdracht.id,
      matchId: schoonmaakMatch.id
    };

    // 1. Send admin notification email
    try {
      await sendEmail({
        to: emailConfig.notificationsEmail,
        subject: '🆕 Nieuwe Dieptereiniging Opdracht Ontvangen',
        html: nieuweDieptereinigingAdmin(emailData)
      });
      console.log(`✅ [ProcessDieptereiniging] Admin notification email sent`);
    } catch (error) {
      console.error(`⚠️ [ProcessDieptereiniging] Failed to send admin email:`, error.message);
      // Don't throw - continue with other emails
    }

    // Delay tussen emails (rate limit protection: max 2 per second)
    await new Promise(resolve => setTimeout(resolve, 600));

    // 2. Send client confirmation email
    try {
      await sendEmail({
        to: metadata.email,
        subject: '✅ Betaling Ontvangen - Dieptereiniging',
        html: dieptereinigingBevestigingKlant(emailData)
      });
      console.log(`✅ [ProcessDieptereiniging] Client confirmation email sent to ${metadata.email}`);
    } catch (error) {
      console.error(`⚠️ [ProcessDieptereiniging] Failed to send client email:`, error.message);
      // Don't throw - this is not critical
    }

    // Delay tussen emails (rate limit protection: max 2 per second)
    await new Promise(resolve => setTimeout(resolve, 600));

    // 3. Send schoonmaker assignment email (if schoonmaker assigned OR auto-assigned)
    if (finalSchoonmakerId) {
      console.log(`📧 [ProcessDieptereiniging] Sending email to schoonmaker${finalAutoAssigned ? ' (auto-assigned)' : ''}: ${finalSchoonmakerId}`);
      try {
        // Haal schoonmaker gegevens op
        const { supabaseConfig } = await import('../../config/index.js');
        const supabaseUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${finalSchoonmakerId}&select=*`;
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
        
        if (schoonmakerResponse && schoonmakerResponse.email) {
          const schoonmakerNaam = `${schoonmakerResponse.voornaam || ''} ${schoonmakerResponse.achternaam || ''}`.trim();
          
          await sendEmail({
            to: schoonmakerResponse.email,
            subject: `🧹 Nieuwe Dieptereiniging Opdracht - ${emailData.klantNaam}`,
            html: dieptereinigingToegewezenSchoonmaker({
              ...emailData,
              schoonmakerNaam,
              schoonmakerEmail: schoonmakerResponse.email
            })
          });
          
          console.log(`✅ [ProcessDieptereiniging] Schoonmaker email sent to ${schoonmakerResponse.email}`);
        } else {
          console.warn(`⚠️ [ProcessDieptereiniging] Schoonmaker email not found [${correlationId}]`, {
            schoonmakerId: finalSchoonmakerId
          });
        }
      } catch (emailError) {
        console.error(`⚠️ [ProcessDieptereiniging] Schoonmaker email failed (non-critical) [${correlationId}]`, {
          error: emailError.message,
          schoonmakerId: finalSchoonmakerId
        });
        // Email failure mag flow niet breken
      }
    } else {
      console.log(`ℹ️ [ProcessDieptereiniging] No schoonmaker assigned (auto-assignment failed), skipping schoonmaker email`);
    }

    console.log(`🎉 [ProcessDieptereiniging] ========== SUCCESS ========== [${correlationId}]`);
    return { handled: true, intent: paymentIntent.id, opdracht_id: opdracht.id };
    
  } catch (error) {
    console.error(`🔥 [ProcessDieptereiniging] ========== CRITICAL FAILURE ========== [${correlationId}]`);
    console.error(`🔥 [ProcessDieptereiniging] Payment Intent: ${paymentIntent.id}`);
    console.error(`🔥 [ProcessDieptereiniging] Error: ${error.message}`);
    console.error(`🔥 [ProcessDieptereiniging] Stack:`, error.stack);
    console.error(`🔥 [ProcessDieptereiniging] Full metadata:`, JSON.stringify(metadata, null, 2));
    
    throw error;
  }
}
