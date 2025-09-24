// public/forms/aanvraag/abbBetalingForm.js
// Betaalstap: Stripe Elements Payment Element, zonder externe bundlers

import { formHandler } from '../logic/formHandler.js';
import { loadFlowData, saveFlowData } from '../logic/formStorage.js';

async function fetchPublicConfig() {
  const res = await fetch('/api/routes/stripe/public-config');
  if (!res.ok) throw new Error('Kon Stripe config niet ophalen');
  return res.json();
}

async function createPaymentIntent(payload, idemKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (idemKey) headers['X-Idempotency-Key'] = idemKey;
  const res = await fetch('/api/routes/stripe/create-payment-intent', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Kon PaymentIntent niet maken');
  return data;
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
    submit: {
      action: async () => {
        const flow = loadFlowData('abonnement-aanvraag') || {};
        const amountEur = Number(flow.abb_prijs);
        if (!amountEur || isNaN(amountEur)) throw new Error('Ongeldig bedrag');
        const amountCents = Math.round(amountEur * 100);

        const publicCfg = await fetchPublicConfig();
        // Stripe.js via <script src="https://js.stripe.com/v3"> verwacht globale Stripe
        if (!window.Stripe) throw new Error('Stripe.js niet geladen');
        const stripe = window.Stripe(publicCfg.publishableKey);

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
        const elements = stripe.elements({ clientSecret: intent.clientSecret, appearance: { theme: 'stripe' } });
        const pe = elements.create('payment');
        const mountEl = document.querySelector('[data-element="stripe-payment-element"]');
        if (!mountEl) throw new Error('Payment element container niet gevonden');
        pe.mount(mountEl);

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
      const publicCfg = await fetchPublicConfig();
      const flow = loadFlowData('abonnement-aanvraag') || {};
      if (!window.Stripe) throw new Error('Stripe.js niet geladen');
      const stripe = window.Stripe(publicCfg.publishableKey);
      const elements = stripe.elements({ clientSecret: null }); // wordt geïnfereerd uit gemount element
      const { error } = await stripe.confirmPayment({
        elements,
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
