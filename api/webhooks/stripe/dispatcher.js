// Dispatch incoming Stripe events to appropriate handlers
import { STRIPE_EVENTS } from './events.js';
import { handlePaymentIntentSucceeded } from './handlers/paymentIntentSucceeded.js';
import { handlePaymentIntentFailed } from './handlers/paymentIntentFailed.js';

export async function dispatchStripeEvent({ event, correlationId }) {
  console.log(`📨 [Dispatcher] Routing event type: ${event.type} [${correlationId}]`);
  
  try {
    let result;
    switch(event.type){
      case STRIPE_EVENTS.PAYMENT_INTENT_SUCCEEDED:
        console.log(`✅ [Dispatcher] Handling PAYMENT_INTENT_SUCCEEDED [${correlationId}]`);
        result = await handlePaymentIntentSucceeded(event, correlationId);
        break;
      case STRIPE_EVENTS.PAYMENT_INTENT_FAILED:
        console.log(`⚠️ [Dispatcher] Handling PAYMENT_INTENT_FAILED [${correlationId}]`);
        result = await handlePaymentIntentFailed(event, correlationId);
        break;
      default:
        console.log(`ℹ️ [Dispatcher] Unhandled event type: ${event.type} [${correlationId}]`);
        result = { handled:false, type:event.type };
    }
    
    console.log(`✅ [Dispatcher] Handler completed [${correlationId}]`, result);
    return result;
  } catch (error) {
    console.error(`🔥 [Dispatcher] Handler error [${correlationId}]`);
    console.error(`🔥 [Dispatcher] Event type: ${event.type}`);
    console.error(`🔥 [Dispatcher] Error: ${error.message}`);
    console.error(`🔥 [Dispatcher] Stack:`, error.stack);
    throw error; // Re-throw zodat webhook handler het kan afhandelen
  }
}
