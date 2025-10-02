// public/pages/paymentReturnHandler.js
// Vroege redirect-afhandeling vóór individuele form init zodat we niet onnodig op stap 1 blijven.
import { loadFlowData, saveFlowData } from '../forms/logic/formStorage.js';
import { apiClient } from '../utils/api/client.js';
import '../utils/slides.js';

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
      // Jump direct naar success slide; success module vult content later.
      if (typeof window.jumpToSlideByFormName === 'function') {
        // Delay klein zodat slider DOM bestaat
        setTimeout(()=>window.jumpToSlideByFormName('abb_succes-form'), 30);
      }
      window.history.replaceState({}, document.title, cleanUrl);
      return;
    }
    if (status === 'processing') {
      // Laat betaalstap init doorgaan; betalingscript zal polling doen.
      window.history.replaceState({}, document.title, cleanUrl + '?processing=1');
      return;
    }
    if (['requires_payment_method','canceled','requires_action'].includes(status)) {
      // We blijven op betaalstap (die wordt later geladen). Eventueel marker voor fout.
      window.history.replaceState({}, document.title, cleanUrl + '?retry=1');
      return;
    }
  } catch (e) {
    console.warn('[PaymentReturnEarly] Fout tijdens early handling', e);
  }
})();
