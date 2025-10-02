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
  // Detecteer of we terugkomen van een redirect-based betaalmethode (iDEAL e.d.)
  // We tonen de success slide pas NA terugkomst en bevestigde status.
  const urlParams = new URLSearchParams(window.location.search);
  const redirectStatus = urlParams.get('redirect_status');
  const returnedIntentId = urlParams.get('payment_intent');
  const clientSecretFromUrl = urlParams.get('payment_intent_client_secret');

  // Helper om query parameters op te schonen na verwerking
  function cleanUrlQuery() {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  async function retrieveIntentStatus(id) {
    try {
      const res = await apiClient(`/routes/stripe/retrieve-payment-intent?id=${encodeURIComponent(id)}`, { method: 'GET' });
      return res;
    } catch (e) {
      console.error('[AbbBetaling] Fout bij ophalen intent status:', e);
      return null;
    }
  }

  async function handleReturnFromRedirect() {
    console.log('[AbbBetaling] Terugkomst detectie', { redirectStatus, returnedIntentId });
    if (!returnedIntentId) return; // Geen intent id -> geen redirect flow
    // Lees lokale flow (zou intent id moeten bevatten)
    const flow = loadFlowData('abonnement-aanvraag') || {};
    if (!flow.paymentIntentId) {
      flow.paymentIntentId = returnedIntentId; // fallback zodat success module intent kan tonen
      saveFlowData('abonnement-aanvraag', flow);
    }
    // Ophalen actuele status voor zekerheid
    const intent = await retrieveIntentStatus(returnedIntentId);
    if (!intent) {
      console.warn('[AbbBetaling] Geen intent info beschikbaar na redirect.');
      cleanUrlQuery();
      return;
    }
    console.log('[AbbBetaling] Intent status na redirect:', intent.status);
    if (intent.status === 'succeeded') {
      // Ga direct naar success slide (data-form-name="abb_succes-form") als beschikbaar
      if (typeof window.jumpToSlideByFormName === 'function') {
        window.jumpToSlideByFormName('abb_succes-form');
      } else if (typeof window.moveToNextSlide === 'function') {
        // fallback: probeer gewoon één slide verder; aannames: success slide volgt betaling
        window.moveToNextSlide();
      }
      cleanUrlQuery();
      return true;
    }
    if (intent.status === 'processing') {
      // Start polling tot max 60s
      let attempts = 0;
      const maxAttempts = 12; // 12 * 5s = 60s
      const interval = setInterval(async () => {
        attempts++;
        const latest = await retrieveIntentStatus(returnedIntentId);
        if (!latest) return; // probeer volgende ronde
        console.log('[AbbBetaling] Polling intent status:', latest.status);
        if (latest.status === 'succeeded') {
          clearInterval(interval);
          if (typeof window.jumpToSlideByFormName === 'function') {
            window.jumpToSlideByFormName('abb_succes-form');
          } else if (typeof window.moveToNextSlide === 'function') {
            window.moveToNextSlide();
          }
          cleanUrlQuery();
        } else if (['requires_payment_method','canceled','requires_action'].includes(latest.status) || attempts >= maxAttempts) {
          clearInterval(interval);
          // Laat gebruiker opnieuw proberen; we blijven op betaal slide
          const errorEl = document.querySelector('[data-error-for="global"]');
          if (errorEl) errorEl.textContent = 'Betaling nog niet afgerond. Probeer opnieuw.';
          cleanUrlQuery();
        }
      }, 5000);
      return true; // we hebben handling opgestart
    }
    if (['requires_payment_method','canceled','requires_action'].includes(intent.status)) {
      const errorEl = document.querySelector('[data-error-for="global"]');
      if (errorEl) errorEl.textContent = 'Betaling niet gelukt. Je kunt het opnieuw proberen.';
      cleanUrlQuery();
      return true;
    }
    return false;
  }
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
      // Als we terugkomen van redirect en al een intent status hebben afgehandeld, hoef je niet opnieuw element te bouwen.
      if (returnedIntentId && (redirectStatus || urlParams.get('afterPayment'))) {
        const handled = await handleReturnFromRedirect();
        if (handled) {
          console.log('[AbbBetaling] Redirect-flow afgehandeld, skip element init.');
          return;
        }
      }
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
          confirmParams: {
            // Voeg eenvoudige marker toe zodat we weten dat we terugkomen uit betaalredirect
            return_url: window.location.origin + window.location.pathname + '?afterPayment=1'
          },
        });
        if (error) {
          console.error('Payment error:', error);
          if (errorEl) errorEl.textContent = error.message || 'Betaling mislukt. Probeer opnieuw.';
          payBtn.disabled = false;
          return;
        }
        // Bij redirect-based methoden (iDEAL) komen we hier niet terug. Bij instant methoden (kaart zonder 3DS) wel.
        // In dat geval kunnen we direct status ophalen en naar success gaan.
        const flow = loadFlowData('abonnement-aanvraag') || {};
        if (flow.paymentIntentId) {
          const latest = await retrieveIntentStatus(flow.paymentIntentId);
          if (latest && latest.status === 'succeeded') {
            if (typeof window.jumpToSlideByFormName === 'function') {
              window.jumpToSlideByFormName('abb_succes-form');
            } else if (typeof window.moveToNextSlide === 'function') {
              window.moveToNextSlide();
            }
          } else {
            // Anders laten we de gebruiker staan; polling kan handmatig gestart worden (niet kritisch voor kaart payments).
            console.log('[AbbBetaling] Geen directe success status na confirm (non redirect).');
          }
        }
      } catch (err) {
        console.error('Confirm error:', err);
        if (errorEl) errorEl.textContent = err.message || 'Onbekende fout bij bevestigen.';
        payBtn.disabled = false;
      }
    });
  }
}
