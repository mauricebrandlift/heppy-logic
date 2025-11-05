// public/forms/verhuis/verhuisBetalingForm.js
// Betaalstap: Stripe Elements Payment Element voor verhuis/opleverschoonmaak (eenmalige betaling)

import { formHandler } from '../logic/formHandler.js';
import { loadFlowData, saveFlowData } from '../logic/formStorage.js';
import { apiClient } from '../../utils/api/client.js';

const FORM_NAME = 'vh_betaling-form';
const FORM_SELECTOR = `[data-form-name="${FORM_NAME}"]`;
const SUCCESS_FORM_NAME = 'vh_succes-form';

function goToFormStep(nextFormName) {
  console.log('[VerhBetaling] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[VerhBetaling] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[VerhBetaling] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[VerhBetaling] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[VerhBetaling] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[VerhBetaling] Geen slider navigatie functie gevonden.');
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

export async function initVerhuisBetalingForm() {
  console.log('💳 [VerhBetaling] Initialiseren…');
  
  // Detecteer of we terugkomen van een redirect-based betaalmethode (iDEAL e.d.)
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
      console.error('[VerhBetaling] Fout bij ophalen intent status:', e);
      return null;
    }
  }

  async function handleReturnFromRedirect() {
    console.log('[VerhBetaling] Terugkomst detectie', { redirectStatus, returnedIntentId });
    if (!returnedIntentId) return;
    
    const flow = loadFlowData('verhuis-aanvraag') || {};
    if (!flow.paymentIntentId) {
      flow.paymentIntentId = returnedIntentId;
      saveFlowData('verhuis-aanvraag', flow);
    }
    
    const intent = await retrieveIntentStatus(returnedIntentId);
    if (!intent) {
      console.warn('[VerhBetaling] Geen intent info beschikbaar na redirect.');
      cleanUrlQuery();
      return;
    }
    
    console.log('[VerhBetaling] Intent status na redirect:', intent.status);
    
    if (intent.status === 'succeeded') {
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
        if (!latest) return;
        
        console.log('[VerhBetaling] Polling intent status:', latest.status);
        
        if (latest.status === 'succeeded') {
          clearInterval(interval);
          goToFormStep(SUCCESS_FORM_NAME);
          cleanUrlQuery();
        } else if (['requires_payment_method','canceled','requires_action'].includes(latest.status) || attempts >= maxAttempts) {
          clearInterval(interval);
          const errorEl = document.querySelector('[data-error-for="global"]');
          if (errorEl) errorEl.textContent = 'Betaling nog niet afgerond. Probeer opnieuw.';
          cleanUrlQuery();
        }
      }, 5000);
      return true;
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
  
  const payBtn = formEl.querySelector('[data-form-button="vh_betaling-form"]');
  const akkoordCb = formEl.querySelector('[data-field-name="akkoord_voorwaarden"]');
  const errorEl = formEl.querySelector('[data-error-for="global"]');
  const amountDisplay = formEl.querySelector('[data-element="payment-amount"]');

  // Force reset checkbox (mag nooit prefilled zijn)
  if (akkoordCb) {
    akkoordCb.checked = false;
    console.log('[VerhBetaling] Checkbox gereset naar unchecked');
  }

  // Disable pay button until ready
  if (payBtn) payBtn.disabled = true;

  async function initStripeAndElement() {
    // Toon spinner direct bij start
    const paymentSpinner = document.querySelector('[data-loading-spinner="payment-methods"]');
    if (paymentSpinner) {
      paymentSpinner.classList.remove('hide');
      console.log('[VerhBetaling] 🔄 Payment spinner getoond');
    }
    
    try {
      // Check redirect markers
      if (processingMarker && returnedIntentId) {
        console.log('[VerhBetaling] Processing marker aanwezig, start alleen polling via redirect handler.');
        const handled = await handleReturnFromRedirect();
        if (handled) return;
      }
      
      if (retryMarker && returnedIntentId) {
        console.log('[VerhBetaling] Retry marker aanwezig: haal status op en toon fout indien nodig.');
        const handled = await handleReturnFromRedirect();
      }
      
      if (returnedIntentId && (redirectStatus || urlParams.get('afterPayment'))) {
        const handled = await handleReturnFromRedirect();
        if (handled) {
          console.log('[VerhBetaling] Redirect-flow afgehandeld, skip element init.');
          return;
        }
      }

      const flow = loadFlowData('verhuis-aanvraag') || {};
      
      // Bereken totaalbedrag: uren × prijs_per_uur
      const uren = Number(flow.vh_uren);
      if (!uren || isNaN(uren)) throw new Error('Ongeldig aantal uren');
      
      // Haal prijs config op (wordt later via backend gedaan, maar voor nu nemen we aan dat het in flow staat)
      // In productie komt pricePerHour van de pricing API
      const pricePerHour = 28; // TODO: Haal op via pricing API (verhuis = €28/uur)
      const totalAmountEur = uren * pricePerHour;
      
      if (amountDisplay) amountDisplay.textContent = formatCurrency(totalAmountEur);

      console.log('[VerhBetaling] Flow data voor intent:', { 
        vh_datum: flow.vh_datum,
        vh_uren: flow.vh_uren,
        vh_m2: flow.vh_m2,
        vh_toiletten: flow.vh_toiletten,
        vh_badkamers: flow.vh_badkamers,
        totalAmountEur 
      });

      const publicCfg = await fetchPublicConfig().catch(err => { 
        throw new Error('Config fetch failed: ' + err.message); 
      });
      
      if (!window.Stripe) throw new Error('Stripe.js niet geladen');
      stripeInstance = window.Stripe(publicCfg.publishableKey);

      const idem = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      
      const flowContext = {
        flow: 'verhuis_opleverschoonmaak',
        vh_datum: flow.vh_datum,
        vh_uren: flow.vh_uren,
        vh_m2: flow.vh_m2,
        vh_toiletten: flow.vh_toiletten,
        vh_badkamers: flow.vh_badkamers,
      };

      // Bereken prijs in cents voor metadata
      const totalAmountCents = Math.round(totalAmountEur * 100);

      // Verzamel alle metadata voor webhook processing
      const metadata = {
        // Flow type
        flow: 'verhuis_opleverschoonmaak',
        product_type: 'verhuis_opleverschoonmaak',
        
        // Contact info
        email: flow.emailadres || '',
        voornaam: flow.voornaam || '',
        achternaam: flow.achternaam || '',
        telefoon: flow.telefoonnummer || '',
        
        // Wachtwoord (alleen voor guest users - voor auth user creatie)
        wachtwoord: flow.wachtwoord || '',
        
        // Adres gegevens
        straat: flow.straatnaam || '',
        huisnummer: flow.huisnummer || '',
        toevoeging: flow.toevoeging || '',
        postcode: flow.postcode || '',
        plaats: flow.plaats || '',
        
        // Verhuis/opleverschoonmaak specifiek
        vh_datum: flow.vh_datum || '',
        vh_uren: flow.vh_uren || '',
        vh_m2: flow.vh_m2 || '',
        vh_toiletten: flow.vh_toiletten || '',
        vh_badkamers: flow.vh_badkamers || '',
        
        // Prijs berekening
        total_amount_cents: totalAmountCents.toString(),
        price_per_hour: pricePerHour.toString(),
        
        // Schoonmaker keuze
        schoonmaker_id: (() => {
          if (flow.schoonmakerKeuze && flow.schoonmakerKeuze !== 'geenVoorkeur') {
            return flow.schoonmakerKeuze;
          }
          
          if (flow.schoonmakerKeuze === 'geenVoorkeur') {
            const radio = document.querySelector('input[type="radio"][value="geenVoorkeur"]');
            const autoAssignId = radio?.getAttribute('data-auto-assign-id');
            
            if (autoAssignId) {
              console.log('✅ [VerhBetaling] Geen voorkeur → Auto-assign ID:', autoAssignId);
              return autoAssignId;
            } else {
              console.warn('⚠️ [VerhBetaling] Geen voorkeur geselecteerd maar geen auto-assign ID gevonden');
            }
          }
          
          return '';
        })(),
        
        auto_assigned: flow.schoonmakerKeuze === 'geenVoorkeur' ? 'true' : 'false',
        
        // Reference
        aanvraagId: flow.aanvraagId || '',
      };

      console.log('[VerhBetaling] Metadata voor PaymentIntent:', metadata);

      const intent = await createPaymentIntent({
        amount: totalAmountCents, // Bedrag in centen (verplicht!)
        currency: publicCfg.currency,
        description: `Heppy verhuis/opleverschoonmaak (${uren}u)`,
        customerEmail: flow.emailadres || undefined,
        metadata,
        flowContext,
        clientQuote: {
          uren: Number(flow.vh_uren),
          pricePerHour: pricePerHour,
          totalAmount: totalAmountEur,
        },
      }, idem);

      console.log('[VerhBetaling] Intent response:', intent);

      elementsInstance = stripeInstance.elements({ 
        clientSecret: intent.clientSecret, 
        appearance: { theme: 'stripe' } 
      });
      
      paymentElement = elementsInstance.create('payment');
      const mountEl = document.querySelector('[data-element="stripe-payment-element"]');
      if (!mountEl) throw new Error('Payment element container niet gevonden');
      
      paymentElement.on('ready', () => {
        console.log('[VerhBetaling] Payment Element ready');
        // Verberg spinner zodra payment element klaar is
        if (paymentSpinner) {
          paymentSpinner.classList.add('hide');
          console.log('[VerhBetaling] ✅ Payment spinner verborgen');
        }
      });
      paymentElement.on('loaderror', (e) => {
        console.error('[VerhBetaling] Payment Element loaderror event:', e);
        if (errorEl) errorEl.textContent = 'Laden van betaalcomponent mislukt.';
        // Verberg spinner ook bij error
        if (paymentSpinner) paymentSpinner.classList.add('hide');
      });
      
      paymentElement.mount(mountEl);
      paymentReady = true;

      flow.paymentIntentId = intent.id;
      
      const serverTotalAmount = intent?.amount ? intent.amount / 100 : totalAmountEur;
      if (amountDisplay) amountDisplay.textContent = formatCurrency(serverTotalAmount);

      flow.totalAmount = serverTotalAmount.toFixed(2);
      flow.totalAmountValidated = serverTotalAmount.toFixed(2);

      if (intent?.pricingDetails) {
        flow.serverPricing = intent.pricingDetails;
      }

      saveFlowData('verhuis-aanvraag', flow);

      if (akkoordCb && akkoordCb.checked && payBtn) payBtn.disabled = false;
      console.log('✅ [VerhBetaling] Stripe Payment Element klaar.');
    } catch (err) {
      console.error('❌ [VerhBetaling] Init fout:', err);
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
        console.warn('[VerhBetaling] confirmPayment geblokkeerd: element niet ready', { 
          paymentReady, 
          stripe: !!stripeInstance, 
          elements: !!elementsInstance 
        });
        return;
      }
      
      if (!akkoordCb?.checked) {
        if (errorEl) errorEl.textContent = 'Ga eerst akkoord met de voorwaarden.';
        return;
      }
      
      payBtn.disabled = true;
      if (errorEl) errorEl.textContent = '';
      
      try {
        console.log('[VerhBetaling] confirmPayment start');
        const { error } = await stripeInstance.confirmPayment({
          elements: elementsInstance,
          confirmParams: {
            return_url: window.location.origin + window.location.pathname + '?afterPayment=1'
          },
        });
        
        if (error) {
          console.error('Payment error:', error);
          if (errorEl) errorEl.textContent = error.message || 'Betaling mislukt. Probeer opnieuw.';
          payBtn.disabled = false;
          return;
        }
        
        // Bij redirect-based methoden (iDEAL) komen we hier niet terug
        // Bij instant methoden (kaart zonder 3DS) wel
        const flow = loadFlowData('verhuis-aanvraag') || {};
        if (flow.paymentIntentId) {
          const latest = await retrieveIntentStatus(flow.paymentIntentId);
          if (latest && latest.status === 'succeeded') {
            goToFormStep(SUCCESS_FORM_NAME);
          } else {
            console.log('[VerhBetaling] Geen directe success status na confirm (non redirect).');
          }
        }
      } catch (err) {
        console.error('Confirm error:', err);
        if (errorEl) errorEl.textContent = err.message || 'Onbekende fout bij bevestigen.';
        payBtn.disabled = false;
      }
    });
  }
  
  // 🔙 PREV BUTTON HANDLER - Re-initialiseer vorige stap bij terug navigeren
  setupPrevButtonHandler();
}

/**
 * Setup prev button handler voor terug navigatie
 * Re-initialiseert stap 4 (overzicht) voordat er terug wordt genavigeerd
 */
let prevButtonHandler = null;

function setupPrevButtonHandler() {
  const prevButton = document.querySelector('[data-form-button-prev="vh_betaling-form"]');
  
  if (!prevButton) {
    console.log('[VerhBetaling] Geen prev button gevonden');
    return;
  }
  
  console.log('[VerhBetaling] Prev button gevonden, event handler toevoegen...');
  
  // Verwijder oude handler indien aanwezig
  if (prevButtonHandler) {
    prevButton.removeEventListener('click', prevButtonHandler);
    console.log('[VerhBetaling] ♻️ Oude prev button handler verwijderd');
  }
  
  // Definieer nieuwe handler
  prevButtonHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[VerhBetaling] 🔙 Prev button clicked - navigeer naar stap 4 (overzicht)');
    
    // Re-initialiseer de VORIGE stap (stap 4 = verhuisOverzichtForm) VOOR navigatie
    import('./verhuisOverzichtForm.js').then(module => {
      console.log('[VerhBetaling] ♻️ Re-init verhuisOverzichtForm voor terug navigatie...');
      module.initVerhuisOverzichtForm();
      
      // NA re-init, ga naar vorige slide
      if (typeof window.moveToPrevSlide === 'function') {
        console.log('[VerhBetaling] Roep window.moveToPrevSlide() aan');
        window.moveToPrevSlide();
      } else {
        console.warn('[VerhBetaling] window.moveToPrevSlide() niet beschikbaar');
      }
    }).catch(err => {
      console.error('[VerhBetaling] ❌ Fout bij re-init verhuisOverzichtForm:', err);
      if (typeof window.moveToPrevSlide === 'function') {
        window.moveToPrevSlide();
      }
    });
  };
  
  // Voeg nieuwe handler toe
  prevButton.addEventListener('click', prevButtonHandler);
  
  console.log('[VerhBetaling] ✅ Prev button handler toegevoegd');
}
