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

export async function processSuccessfulPayment({ paymentIntent, metadata, correlationId, event }){
  console.log(`💰 [ProcessSuccessfulPayment] ========== START ========== [${correlationId}]`);
  console.log(`💰 [ProcessSuccessfulPayment] Payment Intent ID: ${paymentIntent.id}`);
  console.log(`💰 [ProcessSuccessfulPayment] Amount: ${paymentIntent.amount} ${paymentIntent.currency}`);
  console.log(`💰 [ProcessSuccessfulPayment] Metadata:`, JSON.stringify(metadata, null, 2));
  
  // Intake naar betaald
  console.log(`📝 [ProcessSuccessfulPayment] Updating intake status...`);
  await intakeService.updateStatus(paymentIntent.id, 'betaald', correlationId);
  console.log(`✅ [ProcessSuccessfulPayment] Intake status updated`);

  // Idempotency: betaling bestaat al?
  console.log(`🔍 [ProcessSuccessfulPayment] Checking for existing payment...`);
  const existingPayment = await betalingService.findByStripePaymentId(paymentIntent.id, correlationId);
  if (existingPayment && existingPayment.abonnement_id){
    console.log(`⚠️ [ProcessSuccessfulPayment] Duplicate payment detected, skipping [${paymentIntent.id}]`);
    return { handled:true, duplicate:true, intent: paymentIntent.id, abonnement_id: existingPayment.abonnement_id };
  }
  console.log(`✅ [ProcessSuccessfulPayment] No duplicate found, continuing...`);

  // User
  console.log(`👤 [ProcessSuccessfulPayment] Creating/finding user for email: ${metadata.email}`);
  const user = await userService.findOrCreateByEmail(metadata, correlationId);
  console.log(`✅ [ProcessSuccessfulPayment] User ${user.created ? 'created' : 'found'}: ${user.id}`);
  await auditService.log('user_profile', user.id, user.created?'created':'reused', user.id, { email: metadata.email }, correlationId);

  // Address
  console.log(`📍 [ProcessSuccessfulPayment] Creating address...`);
  const address = await addressService.create(metadata, correlationId);
  console.log(`✅ [ProcessSuccessfulPayment] Address created: ${address.id}`);

  // Aanvraag
  console.log(`📋 [ProcessSuccessfulPayment] Creating schoonmaak_aanvraag...`);
  const aanvraag = await aanvraagService.create(metadata, address.id, correlationId);
  console.log(`✅ [ProcessSuccessfulPayment] Aanvraag created: ${aanvraag.id}`);
  await auditService.log('schoonmaak_aanvraag', aanvraag.id, 'created', user.id, { intent: paymentIntent.id }, correlationId);

  // Abonnement
  console.log(`📅 [ProcessSuccessfulPayment] Creating abonnement...`);
  const abonnement = await abonnementService.create(metadata, user.id, aanvraag.id, correlationId);
  console.log(`✅ [ProcessSuccessfulPayment] Abonnement created: ${abonnement.id}`);
  await auditService.log('abonnement', abonnement.id, 'created', user.id, { intent: paymentIntent.id }, correlationId);

  // Betaling koppelen / maken
  console.log(`💳 [ProcessSuccessfulPayment] Creating/linking payment record...`);
  const betaling = await betalingService.linkOrCreate({
    stripeId: paymentIntent.id,
    userId: user.id,
    abonnementId: abonnement.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: 'betaald',
    stripe_status: paymentIntent.status
  }, correlationId);
  console.log(`✅ [ProcessSuccessfulPayment] Payment ${betaling.updated ? 'updated' : 'created'}: ${betaling.id}`);
  await auditService.log('betaling', betaling.id, betaling.updated?'updated':'created', user.id, { amount_cents: paymentIntent.amount }, correlationId);

  console.log(`🎉 [ProcessSuccessfulPayment] ========== SUCCESS ========== [${correlationId}]`);
  return { handled:true, intent: paymentIntent.id, abonnement_id: abonnement.id };
}
