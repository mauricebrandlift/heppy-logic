// Handler: payment_intent.payment_failed
// Process failed payments voor recurring billing met retry logic
import { retryPaymentService } from '../../../services/retryPaymentService.js';

export async function handlePaymentIntentFailed(event, correlationId){
  const pi = event.data.object;
  const metadata = pi.metadata || {};
  
  console.log(`❌ [PaymentIntentFailed] Processing failed payment: ${pi.id} [${correlationId}]`);
  
  // Check if this is a recurring billing payment
  const flow = metadata.flow || 'unknown';
  
  if (flow !== 'recurring_billing' && metadata.type !== 'abonnement_renewal') {
    console.log(`⚠️ [PaymentIntentFailed] Not a recurring billing payment, skipping retry logic [${correlationId}]`);
    return { handled: true, status: 'failed', id: pi.id, skipped: true };
  }
  
  // Extract abonnement_id from metadata
  const abonnementId = metadata.abonnement_id;
  
  if (!abonnementId) {
    console.error(`❌ [PaymentIntentFailed] Missing abonnement_id in metadata [${correlationId}]`);
    return { handled: false, error: 'missing_abonnement_id' };
  }
  
  // Get failure reason from Stripe
  const failureMessage = pi.last_payment_error?.message || 'Unknown error';
  const failureCode = pi.last_payment_error?.code || 'unknown';
  const failureReason = `${failureCode}: ${failureMessage}`;
  
  console.log(`📝 [PaymentIntentFailed] Failure reason: ${failureReason} [${correlationId}]`);
  
  // Process failure with retry service
  try {
    const result = await retryPaymentService.handlePaymentFailure(
      pi.id,
      abonnementId,
      failureReason,
      correlationId
    );
    
    return { 
      handled: true, 
      status: 'failed',
      id: pi.id,
      retryCount: result.retryCount,
      nextRetryDate: result.nextRetryDate,
      paused: result.paused
    };
  } catch (error) {
    console.error(`❌ [PaymentIntentFailed] Error processing failure: ${error.message} [${correlationId}]`);
    return { 
      handled: false, 
      error: error.message,
      id: pi.id
    };
  }
}

