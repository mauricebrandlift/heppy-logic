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
let paymentElementMounted = false;

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
    submit: {
      action: async () => {
        const flow = loadFlowData('abonnement-aanvraag') || {};
        const amountEur = Number(flow.abb_prijs);
        if (!amountEur || isNaN(amountEur)) throw new Error('Ongeldig bedrag');
        const amountCents = Math.round(amountEur * 100);

  const publicCfg = await fetchPublicConfig();
  // Stripe.js via <script src="https://js.stripe.com/v3"> verwacht globale Stripe
  if (!window.Stripe) throw new Error('Stripe.js niet geladen');
  stripeInstance = window.Stripe(publicCfg.publishableKey);

        // Maak PaymentIntent
        const idem = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
        const intent = await createPaymentIntent({
          amount: amountCents,
          currency: publicCfg.currency,
          description: 'Heppy abonnement eerste betaling',
          customerEmail: flow.emailadres || undefined,
          metadata: {
            flow: 'abonnement',
            aanvraagId: flow.aanvraagId || '',
            klantEmail: flow.emailadres || '',
          },
        }, idem);

        // Mount Payment Element
        elementsInstance = stripeInstance.elements({ clientSecret: intent.clientSecret, appearance: { theme: 'stripe' } });
        const pe = elementsInstance.create('payment');
        const mountEl = document.querySelector('[data-element="stripe-payment-element"]');
        if (!mountEl) throw new Error('Payment element container niet gevonden');
        pe.mount(mountEl);
        paymentElementMounted = true;

        // Bewaar in flow voor latere referentie
        flow.paymentIntentId = intent.id;
        saveFlowData('abonnement-aanvraag', flow);
      },
      onSuccess: async () => {
        // De daadwerkelijke confirm gebeurt via aparte betaal-knop klik (zelfde submit-knop)
        // Hier geen slide-navigatie; we blijven op de betaalstap tot confirm is afgerond.
      }
    }
  };

  formHandler.init(schema);

  // Bind submit-knop voor confirm flow
  const formEl = document.querySelector(schema.selector);
  const btn = formEl?.querySelector('[data-form-button="abb_betaling-form"]');
  if (!btn) return;
  btn.addEventListener('click', async (e) => {
    // Alleen proberen te bevestigen als element al gemount is (na action)
    try {
      if (!paymentElementMounted || !elementsInstance || !stripeInstance) {
        // Eerste klik bereidt de betaling voor; tweede klik bevestigt
        return;
      }
      const { error } = await stripeInstance.confirmPayment({
        elements: elementsInstance,
        confirmParams: {
          return_url: window.location.href, // We blijven in-page; Stripe kan redirect nodig hebben voor iDEAL
        },
      });
      if (error) {
        console.error('Payment error:', error);
        const errEl = formEl.querySelector('[data-error-for="global"]');
        if (errEl) errEl.textContent = error.message || 'Betaling mislukt. Probeer opnieuw.';
        return;
      }
      // Succes: door naar volgende slide
      if (typeof window.moveToNextSlide === 'function') window.moveToNextSlide();
    } catch (err) {
      console.error('Confirm error:', err);
    }
  });
}
