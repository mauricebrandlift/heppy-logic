// public/pages/paymentReturnHandler.js
// Vroege redirect-afhandeling vóór individuele form init zodat we niet onnodig op stap 1 blijven.
import { loadFlowData, saveFlowData } from '../forms/logic/formStorage.js';
import { apiClient } from '../utils/api/client.js';
import { safeTrack, logStepCompleted } from '../utils/tracking/simpleFunnelTracker.js';

(async function handlePaymentReturnEarly(){
  try {
    const params = new URLSearchParams(window.location.search);
    const intentId = params.get('payment_intent');
    const redirectStatus = params.get('redirect_status');
    const marker = params.get('afterPayment');
    if (!intentId && !marker && !redirectStatus) return; // geen redirect context

    const flow = loadFlowData('abonnement-aanvraag') || {};
    if (!flow.paymentIntentId && intentId) {
      flow.paymentIntentId = intentId;
      saveFlowData('abonnement-aanvraag', flow);
    }

    if (!intentId) return; // zonder intent geen status

    const res = await apiClient(`/routes/stripe/retrieve-payment-intent?id=${encodeURIComponent(intentId)}`, { method: 'GET' });
    const status = res?.status;
    console.log('[PaymentReturnEarly] Status:', status);
    const cleanUrl = window.location.origin + window.location.pathname; // alleen path


    if (status === 'succeeded') {
      // 🎯 TRACK COMPLETION - Step 6 with is_completion = true
      await safeTrack(() => logStepCompleted('abonnement', 'success', 6, {
        is_completion: true,
        payment_intent_id: intentId
      }));
      
      // Redirect naar dedicated succes pagina
      const base = window.location.origin;
      const flow = loadFlowData('abonnement-aanvraag') || {};
      const intentParam = encodeURIComponent(intentId);
      // Meegeven van eventueel minimale info voor client-side bevestiging
      const extra = flow.frequentie ? `&freq=${encodeURIComponent(flow.frequentie)}` : '';
      window.location.replace(`${base}/aanvragen/succes/abonnement?pi=${intentParam}${extra}`);
      return; // Stop verdere verwerking
    }
    if (status === 'processing') {
      // Laat bestaande flow doorgaan: user komt terug op betaal stap en polling in betaalmodule.
      return; // Geen redirect; user blijft waar hij is.
    }
    if (['requires_payment_method','canceled','requires_action'].includes(status)) {
      // Laat user terugvallen op betaal stap zonder redirect.
      return;
    }
  } catch (e) {
    console.warn('[PaymentReturnEarly] Fout tijdens early handling', e);
  }
})();
