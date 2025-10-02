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
  // Intake naar betaald
  await intakeService.updateStatus(paymentIntent.id, 'betaald', correlationId);

  // Idempotency: betaling bestaat al?
  const existingPayment = await betalingService.findByStripePaymentId(paymentIntent.id, correlationId);
  if (existingPayment && existingPayment.abonnement_id){
    return { handled:true, duplicate:true, intent: paymentIntent.id, abonnement_id: existingPayment.abonnement_id };
  }

  // User
  const user = await userService.findOrCreateByEmail(metadata, correlationId);
  await auditService.log('user_profile', user.id, user.created?'created':'reused', user.id, { email: metadata.email }, correlationId);

  // Address
  const address = await addressService.create(metadata, correlationId);

  // Aanvraag
  const aanvraag = await aanvraagService.create(metadata, address.id, correlationId);
  await auditService.log('schoonmaak_aanvraag', aanvraag.id, 'created', user.id, { intent: paymentIntent.id }, correlationId);

  // Abonnement
  const abonnement = await abonnementService.create(metadata, user.id, aanvraag.id, correlationId);
  await auditService.log('abonnement', abonnement.id, 'created', user.id, { intent: paymentIntent.id }, correlationId);

  // Betaling koppelen / maken
  const betaling = await betalingService.linkOrCreate({
    stripeId: paymentIntent.id,
    userId: user.id,
    abonnementId: abonnement.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: 'betaald',
    stripe_status: paymentIntent.status
  }, correlationId);
  await auditService.log('betaling', betaling.id, betaling.updated?'updated':'created', user.id, { amount_cents: paymentIntent.amount }, correlationId);

  return { handled:true, intent: paymentIntent.id, abonnement_id: abonnement.id };
}
