// public/forms/aanvraag/abbBetalingForm.js
// Betaalstap: Stripe Elements Payment Element, zonder externe bundlers

import { formHandler } from '../logic/formHandler.js';
import { loadFlowData, saveFlowData } from '../logic/formStorage.js';
import { apiClient } from '../../utils/api/client.js';
import { safeTrack, logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';

const FORM_NAME = 'abb_betaling-form';
const FORM_SELECTOR = `[data-form-name="${FORM_NAME}"]`;
const SUCCESS_FORM_NAME = 'abb_succes-form';

function goToFormStep(nextFormName) {
  console.log('[AbbBetaling] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[AbbBetaling] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[AbbBetaling] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[AbbBetaling] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[AbbBetaling] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[AbbBetaling] Geen slider navigatie functie gevonden.');
  return false;
}

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
  
  // Note: Tracking happens on EXIT (after payment intent creation), not on entry
  
  // Detecteer of we terugkomen van een redirect-based betaalmethode (iDEAL e.d.)
  // We tonen de success slide pas NA terugkomst en bevestigde status.
  const urlParams = new URLSearchParams(window.location.search);
  const redirectStatus = urlParams.get('redirect_status');
  const returnedIntentId = urlParams.get('payment_intent');
  const clientSecretFromUrl = urlParams.get('payment_intent_client_secret');
  const processingMarker = urlParams.get('processing');
  const retryMarker = urlParams.get('retry');

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
      goToFormStep(SUCCESS_FORM_NAME);
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
          goToFormStep(SUCCESS_FORM_NAME);
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
    name: FORM_NAME,
    selector: FORM_SELECTOR,
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
      // Indien we door early handler al expliciet in 'processing' of 'retry' zijn beland, blijven params aanwezig.
      if (processingMarker && returnedIntentId) {
        console.log('[AbbBetaling] Processing marker aanwezig, start alleen polling via redirect handler.');
        const handled = await handleReturnFromRedirect();
        if (handled) return; // geen nieuwe intent maken
      }
      if (retryMarker && returnedIntentId) {
        console.log('[AbbBetaling] Retry marker aanwezig: haal status op en toon fout indien nodig.');
        const handled = await handleReturnFromRedirect();
        // handled zorgt voor foutmelding of success; maar gebruiker moet alsnog kunnen betalen -> ga door met aanmaken nieuw intent
      }
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
    const sessionsPer4W = frequentie === 'pertweeweek' ? 2 : 4;
      const bundleAmountEur = baseAmountPerSession * sessionsPer4W;
      if (amountDisplay) amountDisplay.textContent = formatCurrency(bundleAmountEur);

    console.log('[AbbBetaling] Flow data voor intent:', { frequentie, baseAmountPerSession, sessionsPer4W, bundleAmountEur });
    const publicCfg = await fetchPublicConfig().catch(err => { throw new Error('Config fetch failed: ' + err.message); });
      if (!window.Stripe) throw new Error('Stripe.js niet geladen');
      stripeInstance = window.Stripe(publicCfg.publishableKey);

      const idem = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const flowContext = {
        flow: 'abonnement',
        frequentie,
        requestedHours: flow.abb_uren,
        abb_m2: flow.abb_m2,
        abb_toiletten: flow.abb_toiletten,
        abb_badkamers: flow.abb_badkamers,
        abb_min_uren: flow.abb_min_uren,
      };

      // Bereken prijzen in cents voor metadata (backend verwacht dit formaat)
      const prijsPerSessieCents = Math.round(baseAmountPerSession * 100);
      const bundleAmountCents = Math.round(bundleAmountEur * 100);

      // Verzamel alle metadata voor webhook processing
      // Voor ingelogde users: gebruik auth data, voor guests: gebruik form data
      const metadata = {
        // Required fields
        email: flow.emailadres || '',
        prijs_per_sessie_cents: prijsPerSessieCents.toString(),
        bundle_amount_cents: bundleAmountCents.toString(),
        frequentie: frequentie || '',
        
        // Optional maar belangrijk
        voornaam: flow.voornaam || '',
        achternaam: flow.achternaam || '',
        telefoon: flow.telefoonnummer || '', // Let op: frontend gebruikt 'telefoonnummer', backend verwacht 'telefoon'
        
        // Wachtwoord (alleen voor guest users - voor auth user creatie)
        // TODO: In toekomst vervangen door magic link flow voor betere beveiliging
        wachtwoord: flow.wachtwoord || '',
        
        // Adres gegevens
        straat: flow.straatnaam || '',
        huisnummer: flow.huisnummer || '',
        toevoeging: flow.toevoeging || '',
        postcode: flow.postcode || '',
        plaats: flow.plaats || '',
        
        // Opdracht details
        uren: flow.abb_uren || '',
        sessions_per_4w: sessionsPer4W.toString(),
        startdatum: flow.startdatum || '',
        
        // Schoonmaker keuze (kan 'geenVoorkeur' zijn of schoonmaker ID)
        schoonmaker_id: (flow.schoonmakerKeuze && flow.schoonmakerKeuze !== 'geenVoorkeur') ? flow.schoonmakerKeuze : '',
        
        // Dagdelen voorkeuren (JSON string van dagdelen object)
        // Format: {"maandag":["ochtend","middag"],"dinsdag":["avond"]}
        dagdelen: flow.dagdelenVoorkeur ? JSON.stringify(flow.dagdelenVoorkeur) : '',
        
        // Extra metadata voor reference
        flow: 'abonnement',
        aanvraagId: flow.aanvraagId || '',
      };

      console.log('[AbbBetaling] Metadata voor PaymentIntent:', metadata);

      const intent = await createPaymentIntent({
        currency: publicCfg.currency,
        description: `Heppy abonnement (${sessionsPer4W}x / 4w)` ,
        customerEmail: flow.emailadres || undefined,
        metadata,
        flowContext,
        clientQuote: {
          pricePerSession: baseAmountPerSession,
          bundleAmount: bundleAmountEur,
          requestedHours: flow.abb_uren ? Number(flow.abb_uren) : undefined,
        },
      }, idem);
      console.log('[AbbBetaling] Intent response:', intent);
      
      // 🎯 TRACK STEP COMPLETION (non-blocking, critical flow continues regardless)
      safeTrack(() => logStepCompleted('abonnement', 'betaling', 5, {
        payment_intent_id: intent.id,
        bundleAmount: intent?.amount ? intent.amount / 100 : bundleAmountEur,
        sessionsPer4W: sessionsPer4W
      }));

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
      const serverBundleAmount = intent?.amount ? intent.amount / 100 : bundleAmountEur;
      if (amountDisplay) amountDisplay.textContent = formatCurrency(serverBundleAmount);

      flow.sessionsPer4W = intent?.pricingDetails?.sessionsPerCycle || sessionsPer4W;
      flow.bundleAmount = serverBundleAmount.toFixed(2);
      flow.bundleAmountValidated = serverBundleAmount.toFixed(2);

      if (intent?.pricingDetails) {
        const { pricePerSession, requestedHours } = intent.pricingDetails;
        if (typeof pricePerSession === 'number' && !Number.isNaN(pricePerSession)) {
          flow.abb_prijs = pricePerSession.toFixed(2);
        }
        if (typeof requestedHours === 'number' && !Number.isNaN(requestedHours)) {
          flow.abb_uren = requestedHours.toString();
        }
        flow.serverPricing = intent.pricingDetails;
      }

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
            goToFormStep(SUCCESS_FORM_NAME);
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
