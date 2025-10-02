// Handler: payment_intent.succeeded
// Maps metadata and delegates to payment success flow (to be implemented)
import { mapAndNormalizeMetadata, validateMetadata } from '../metadata.js';
import { processSuccessfulPayment } from '../../../flows/payment/processSuccessfulPayment.js';

export async function handlePaymentIntentSucceeded(event, correlationId){
  const pi = event.data.object;
  const metadata = mapAndNormalizeMetadata(pi.metadata || {});
  const val = validateMetadata(metadata);
  if(!val.valid){
    return { handled:false, error:'missing_metadata', missing: val.missing };
  }
  // Delegate to flow (will implement later)
  return await processSuccessfulPayment({ paymentIntent: pi, metadata, correlationId, event });
}
