// public/forms/aanvraag/abbBetalingForm.js
// Betaalstap: Stripe Elements Payment Element, zonder externe bundlers

import { formHandler } from '../logic/formHandler.js';
import { loadFlowData, saveFlowData } from '../logic/formStorage.js';
import { apiClient } from '../../utils/api/client.js';

async function fetchPublicConfig() {
  return await apiClient('/routes/stripe/public-config', { method: 'GET' });
}

async function createPaymentIntent(payload, idemKey) {
  return await apiClient('/routes/stripe/create-payment-intent', {
    method: 'POST',
    headers: idemKey ? { 'X-Idempotency-Key': idemKey } : undefined,
    body: JSON.stringify(payload),
  });
}

let stripeInstance = null;
let elementsInstance = null;
let paymentElement = null;
let paymentReady = false;

function formatCurrency(amount) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
}

export async function initAbbBetalingForm() {
  console.log('💳 [AbbBetaling] Initialiseren…');
  const schema = {
    name: 'abb_betaling-form',
    selector: '[data-form-name="abb_betaling-form"]',
    fields: {
      akkoord_voorwaarden: {
        label: 'Akkoord met voorwaarden',
        inputType: 'checkbox',
        validators: ['required'],
        persist: 'none',
        messages: { required: 'Je moet akkoord gaan met de voorwaarden' },
      },
    },
    submit: { action: async () => {}, onSuccess: () => {} }
  };

  formHandler.init(schema);

  const formEl = document.querySelector(schema.selector);
  if (!formEl) return;
  const payBtn = formEl.querySelector('[data-form-button="abb_betaling-form"]');
  const akkoordCb = formEl.querySelector('[data-field-name="akkoord_voorwaarden"]');
  const errorEl = formEl.querySelector('[data-error-for="global"]');
  const amountDisplay = formEl.querySelector('[data-element="payment-amount"]');

  // Disable pay button until ready
  if (payBtn) payBtn.disabled = true;

  async function initStripeAndElement() {
    try {
      const flow = loadFlowData('abonnement-aanvraag') || {};
      const baseAmountPerSession = Number(flow.abb_prijs);
      if (!baseAmountPerSession || isNaN(baseAmountPerSession)) throw new Error('Ongeldig bedrag');
      const frequentie = flow.frequentie; // 'perweek' | 'pertweeweek'
      const sessionsPer4W = frequentie === 'perweek' ? 4 : 2;
      const bundleAmountEur = baseAmountPerSession * sessionsPer4W;
      if (amountDisplay) amountDisplay.textContent = formatCurrency(bundleAmountEur);

  console.log('[AbbBetaling] Flow data voor intent:', { frequentie, baseAmountPerSession, sessionsPer4W, bundleAmountEur });
  const publicCfg = await fetchPublicConfig().catch(err => { throw new Error('Config fetch failed: ' + err.message); });
      if (!window.Stripe) throw new Error('Stripe.js niet geladen');
      stripeInstance = window.Stripe(publicCfg.publishableKey);

      const idem = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const intent = await createPaymentIntent({
        amount: Math.round(bundleAmountEur * 100),
        currency: publicCfg.currency,
        description: `Heppy abonnement (${sessionsPer4W}x / 4w)` ,
        customerEmail: flow.emailadres || undefined,
        metadata: {
          flow: 'abonnement',
            aanvraagId: flow.aanvraagId || '',
            klantEmail: flow.emailadres || '',
            frequentie: frequentie || '',
            sessionsPerCycle: sessionsPer4W,
            prijsPerSessie: baseAmountPerSession.toFixed(2),
        },
      }, idem);
      console.log('[AbbBetaling] Intent response:', intent);

      elementsInstance = stripeInstance.elements({ clientSecret: intent.clientSecret, appearance: { theme: 'stripe' } });
      paymentElement = elementsInstance.create('payment');
      const mountEl = document.querySelector('[data-element="stripe-payment-element"]');
      if (!mountEl) throw new Error('Payment element container niet gevonden');
      paymentElement.on('ready', () => console.log('[AbbBetaling] Payment Element ready'));
      paymentElement.on('loaderror', (e) => {
        console.error('[AbbBetaling] Payment Element loaderror event:', e);
        if (errorEl) errorEl.textContent = 'Laden van betaalcomponent mislukt.';
      });
      paymentElement.mount(mountEl);
      paymentReady = true;

      flow.paymentIntentId = intent.id;
      flow.bundleAmount = bundleAmountEur.toFixed(2);
      flow.sessionsPer4W = sessionsPer4W;
      saveFlowData('abonnement-aanvraag', flow);

      if (akkoordCb && akkoordCb.checked && payBtn) payBtn.disabled = false;
      console.log('✅ [AbbBetaling] Stripe Payment Element klaar.');
    } catch (err) {
      console.error('❌ [AbbBetaling] Init fout:', err);
      if (errorEl) errorEl.textContent = err.message || 'Kon betaalmodule niet initialiseren.';
    }
  }

  // Start direct initialisatie
  initStripeAndElement();

  // Enable/disable knop op akkoord
  if (akkoordCb) {
    akkoordCb.addEventListener('change', () => {
      if (payBtn) {
        payBtn.disabled = !(akkoordCb.checked && paymentReady);
      }
    });
  }

  if (payBtn) {
    payBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!paymentReady || !stripeInstance || !elementsInstance) {
        console.warn('[AbbBetaling] confirmPayment geblokkeerd: element niet ready', { paymentReady, stripe: !!stripeInstance, elements: !!elementsInstance });
        return;
      }
      if (!akkoordCb?.checked) {
        if (errorEl) errorEl.textContent = 'Ga eerst akkoord met de voorwaarden.';
        return;
      }
      payBtn.disabled = true;
      if (errorEl) errorEl.textContent = '';
      try {
        console.log('[AbbBetaling] confirmPayment start');
        const { error } = await stripeInstance.confirmPayment({
          elements: elementsInstance,
          confirmParams: { return_url: window.location.href },
        });
        if (error) {
          console.error('Payment error:', error);
          if (errorEl) errorEl.textContent = error.message || 'Betaling mislukt. Probeer opnieuw.';
          payBtn.disabled = false;
          return;
        }
        if (typeof window.moveToNextSlide === 'function') window.moveToNextSlide();
      } catch (err) {
        console.error('Confirm error:', err);
        if (errorEl) errorEl.textContent = err.message || 'Onbekende fout bij bevestigen.';
        payBtn.disabled = false;
      }
    });
  }
}
