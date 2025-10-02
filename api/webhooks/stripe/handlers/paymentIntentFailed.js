// Handler: payment_intent.payment_failed
// For now only returns handled marker; flow may be added later.
export async function handlePaymentIntentFailed(event, correlationId){
  const pi = event.data.object;
  return { handled:true, status:'failed', id: pi.id };
}
