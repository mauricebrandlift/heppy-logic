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
import * as voorkeursDagdelenService from '../../services/voorkeursDagdelenService.js';
import * as schoonmaakMatchService from '../../services/schoonmaakMatchService.js';
import { trackingService } from '../../services/trackingService.js';

export async function processSuccessfulPayment({ paymentIntent, metadata, correlationId, event }){
  console.log(`💰 [ProcessSuccessfulPayment] ========== START ========== [${correlationId}]`);
  console.log(`💰 [ProcessSuccessfulPayment] Payment Intent ID: ${paymentIntent.id}`);
  console.log(`💰 [ProcessSuccessfulPayment] Amount: ${paymentIntent.amount} ${paymentIntent.currency}`);
  console.log(`💰 [ProcessSuccessfulPayment] Metadata:`, JSON.stringify(metadata, null, 2));
  
  try {
    // Intake naar betaald
    console.log(`📝 [ProcessSuccessfulPayment] Updating intake status...`);
    try {
      await intakeService.updateStatus(paymentIntent.id, 'betaald', correlationId);
      console.log(`✅ [ProcessSuccessfulPayment] Intake status updated`);
    } catch (error) {
      console.error(`❌ [ProcessSuccessfulPayment] FAILED: Intake update error [${correlationId}]`, {
        error: error.message,
        stack: error.stack,
        paymentIntentId: paymentIntent.id
      });
      throw new Error(`Intake update failed: ${error.message}`);
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
    try {
      const schoonmakerId = metadata.schoonmaker_id === 'geenVoorkeur' ? null : metadata.schoonmaker_id;
      await schoonmaakMatchService.create({
        aanvraagId: aanvraag.id,
        schoonmakerId: schoonmakerId,
        abonnementId: abonnement.id
      }, correlationId);
      console.log(`✅ [ProcessSuccessfulPayment] Schoonmaak match created`);
      await auditService.log('schoonmaak_match', aanvraag.id, 'created', user.id, { 
        schoonmaker_id: schoonmakerId || 'geen voorkeur',
        abonnement_id: abonnement.id
      }, correlationId);
    } catch (error) {
      console.error(`❌ [ProcessSuccessfulPayment] FAILED: Match creation error [${correlationId}]`, {
        error: error.message,
        stack: error.stack,
        aanvraagId: aanvraag.id,
        schoonmakerId: metadata.schoonmaker_id
      });
      throw new Error(`Match creation failed: ${error.message}`);
    }

    // Voltooi tracking sessie (als sessionId in metadata aanwezig is)
    if (metadata.tracking_session_id) {
      console.log(`📊 [ProcessSuccessfulPayment] Completing tracking session...`);
      try {
        await trackingService.completeSession({
          sessionId: metadata.tracking_session_id,
          aanvraagId: aanvraag.id
        }, correlationId);
        console.log(`✅ [ProcessSuccessfulPayment] Tracking session completed`);
      } catch (error) {
        console.warn(`⚠️ [ProcessSuccessfulPayment] Failed to complete tracking session: ${error.message}`);
        // Non-fatal
      }
    }

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
