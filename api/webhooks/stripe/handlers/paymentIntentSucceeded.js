// Handler: payment_intent.succeeded
// Maps metadata and delegates to payment success flow (abonnement, dieptereiniging, verhuis_opleverschoonmaak, or webshop)
import { mapAndNormalizeMetadata, validateMetadata } from '../metadata.js';
import { processSuccessfulPayment } from '../../../flows/payment/processSuccessfulPayment.js';
import { processDieptereinigingPayment } from '../../../flows/payment/processDieptereinigingPayment.js';
import { processVerhuisPayment } from '../../../flows/payment/processVerhuisPayment.js';
import { processWebshopPayment } from '../../../flows/payment/processWebshopPayment.js';

export async function handlePaymentIntentSucceeded(event, correlationId){
  const pi = event.data.object;
  const metadata = mapAndNormalizeMetadata(pi.metadata || {});
  
  // Detect flow type
  const flow = metadata.flow || 'abonnement'; // Default to abonnement for backwards compatibility
  
  console.log(`📦 [PaymentIntentSucceeded] Detected flow: ${flow} [${correlationId}]`);
  
  // Webshop orders - handle via dedicated processor
  if (flow === 'webshop') {
    console.log(`🛒 [PaymentIntentSucceeded] Routing to webshop flow [${correlationId}]`);
    return await processWebshopPayment({ paymentIntent: pi, metadata, correlationId, event });
  }
  
  // Validate metadata based on flow
  const val = validateMetadata(metadata, flow);
  if(!val.valid){
    console.error(`❌ [PaymentIntentSucceeded] Metadata validation failed [${correlationId}]`, {
      flow,
      missing: val.missing
    });
    return { handled:false, error:'missing_metadata', missing: val.missing, flow };
  }
  
  // Delegate to appropriate flow handler
  if (flow === 'dieptereiniging') {
    console.log(`🧹 [PaymentIntentSucceeded] Routing to dieptereiniging flow [${correlationId}]`);
    return await processDieptereinigingPayment({ paymentIntent: pi, metadata, correlationId, event });
  } else if (flow === 'verhuis_opleverschoonmaak') {
    console.log(`🚚 [PaymentIntentSucceeded] Routing to verhuis/opleverschoonmaak flow [${correlationId}]`);
    return await processVerhuisPayment({ paymentIntent: pi, metadata, correlationId, event });
  } else {
    console.log(`📅 [PaymentIntentSucceeded] Routing to abonnement flow [${correlationId}]`);
    return await processSuccessfulPayment({ paymentIntent: pi, metadata, correlationId, event });
  }
}
