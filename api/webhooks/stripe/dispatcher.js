// Dispatch incoming Stripe events to appropriate handlers
import { STRIPE_EVENTS } from './events.js';
import { handlePaymentIntentSucceeded } from './handlers/paymentIntentSucceeded.js';
import { handlePaymentIntentFailed } from './handlers/paymentIntentFailed.js';

export async function dispatchStripeEvent({ event, correlationId }) {
  switch(event.type){
    case STRIPE_EVENTS.PAYMENT_INTENT_SUCCEEDED:
      return handlePaymentIntentSucceeded(event, correlationId);
    case STRIPE_EVENTS.PAYMENT_INTENT_FAILED:
      return handlePaymentIntentFailed(event, correlationId);
    default:
      return { handled:false, type:event.type };
  }
}
