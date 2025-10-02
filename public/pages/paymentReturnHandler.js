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

    // Helper om naar een form slide te springen (betaling of success)
    function gotoForm(formName) {
      if (typeof window.jumpToSlideByFormName === 'function') {
        setTimeout(()=>window.jumpToSlideByFormName(formName), 30);
      }
    }

    if (status === 'succeeded') {
      const showSuccess = () => {
        const existing = document.querySelector('[data-form-name="abb_succes-form"]');
        if (existing) {
          existing.style.display = '';
          return true;
        }
        // Inject fallback container
        const container = document.createElement('div');
        container.setAttribute('data-form-name','abb_succes-form');
        container.style.padding = '2rem';
        container.style.border = '1px solid #e0e0e0';
        container.style.borderRadius = '8px';
        container.innerHTML = '<h2>Bedankt! 🎉</h2><p>Je betaling is geslaagd.</p><p data-success="bedrag"></p><p data-success="frequentie"></p>';
        document.body.appendChild(container);
        return true;
      };

      const attemptNav = () => {
        if (typeof window.jumpToLastSlide === 'function') {
          const ok = window.jumpToLastSlide();
          if (!ok) showSuccess();
        } else if (!window.jumpToSlideByFormName || !window.jumpToSlideByFormName('abb_succes-form')) {
          showSuccess();
        }
      };
      setTimeout(attemptNav, 30);
      // Schoon query zodat refresh clean is
      window.history.replaceState({}, document.title, cleanUrl);
      return;
    }
    if (status === 'processing') {
      // We willen dat abbBetalingForm.js gaat poll'en -> zorg dat script geladen wordt en houd originele Stripe params (niet verwijderen!)
      try {
        await import('../forms/aanvraag/abbBetalingForm.js').then(m => m?.initAbbBetalingForm && m.initAbbBetalingForm());
      } catch(e) { console.warn('[PaymentReturnEarly] Kon abbBetalingForm niet laden voor processing', e); }
      gotoForm('abb_betaling-form');
      return;
    }
    if (['requires_payment_method','canceled','requires_action'].includes(status)) {
      // Betaling mislukt / extra actie nodig: laad betaal slide voor retry.
      try {
        await import('../forms/aanvraag/abbBetalingForm.js').then(m => m?.initAbbBetalingForm && m.initAbbBetalingForm());
      } catch(e) { console.warn('[PaymentReturnEarly] Kon abbBetalingForm niet laden voor retry', e); }
      gotoForm('abb_betaling-form');
      // Laat parameters staan zodat abbBetalingForm status kan interpreteren en fout tonen
      return;
    }
  } catch (e) {
    console.warn('[PaymentReturnEarly] Fout tijdens early handling', e);
  }
})();
