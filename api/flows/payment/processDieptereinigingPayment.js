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
      
      // Prepare gegevens JSON
      const gegevens = {
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
        adres_id: address.id,
        type: 'dieptereiniging',
        status: 'aangevraagd',
        gewenste_datum: drDatum,
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
    try {
      const schoonmakerId = metadata.schoonmaker_id === 'geenVoorkeur' ? null : metadata.schoonmaker_id;
      const autoAssigned = metadata.auto_assigned === 'true';
      
      schoonmaakMatch = await schoonmaakMatchService.create({
        opdrachtId: opdracht.id,  // Use opdrachtId instead of aanvraagId
        schoonmakerId: schoonmakerId,
        autoAssigned: autoAssigned
      }, correlationId);
      
      console.log(`✅ [ProcessDieptereiniging] Schoonmaak match created`, {
        match_id: schoonmaakMatch.id,
        schoonmaker_id: schoonmakerId || 'none',
        auto_assigned: autoAssigned
      });
      
      await auditService.log('schoonmaak_match', opdracht.id, 'created', user.id, { 
        schoonmaker_id: schoonmakerId || 'geen voorkeur',
        opdracht_id: opdracht.id,
        auto_assigned: autoAssigned
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

    // TODO: Email templates for dieptereiniging (Stap 4)
    console.log(`📧 [ProcessDieptereiniging] Email templates coming in Stap 4...`);

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
