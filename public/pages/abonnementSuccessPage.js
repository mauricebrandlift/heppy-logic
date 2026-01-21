/**
 * Abonnement Success Page Logic
 * 
 * Features:
 * - Load payment details from URL params
 * - Conditioneel SEPA setup tonen (alleen bij iDEAL/non-SEPA payment methods)
 * - SEPA mandate authorization flow
 * - Display abonnement info
 */

import { apiClient } from '../utils/api/client.js';

// State
let stripe = null;
let paymentIntentData = null;
let abonnementId = null; // Opgehaald uit betalingen tabel
let setupIntentClientSecret = null;
let ibanElement = null;

/**
 * Initialize page
 */
async function init() {
  console.log('[AbonnementSuccess] Initializing...');
  
  // Initialize Stripe
  if (!window.Stripe) {
    console.error('[AbonnementSuccess] Stripe library niet geladen');
    showError('Betaalprovider kan niet geladen worden. Herlaad de pagina.');
    return;
  }
  stripe = window.Stripe(window.STRIPE_PUBLISHABLE_KEY || 'pk_test_51QqKNJQ0RBkv5CKzAT1RCHUrdWQ5bPVFoKpqhGLOWePjm1o6J7bYXr5IyLtdZtCLGGrm7C8IUc1NjkWa0S4zC3jU00gVL2koW5');
  
  try {
    // Get URL params
    const urlParams = new URLSearchParams(window.location.search);
    const paymentIntentClientSecret = urlParams.get('payment_intent_client_secret');
    const paymentIntentId = urlParams.get('payment_intent') || urlParams.get('pi');
    
    console.log('[AbonnementSuccess] URL params:', {
      payment_intent_client_secret: paymentIntentClientSecret,
      payment_intent: urlParams.get('payment_intent'),
      pi: urlParams.get('pi'),
      freq: urlParams.get('freq')
    });
    
    if (!paymentIntentClientSecret && !paymentIntentId) {
      throw new Error('Geen betaling informatie gevonden in URL');
    }
    
    // Retrieve PaymentIntent
    let paymentIntent;
    if (paymentIntentClientSecret) {
      const result = await stripe.retrievePaymentIntent(paymentIntentClientSecret);
      paymentIntent = result.paymentIntent;
    } else {
      const response = await apiClient(`/routes/stripe/retrieve-payment-intent?id=${paymentIntentId}`, {
        method: 'GET'
      });
      const { correlationId, ...piData } = response;
      paymentIntent = piData;
    }
    paymentIntentData = paymentIntent;
    
    console.log('[AbonnementSuccess] PaymentIntent retrieved:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      payment_method_types: paymentIntent.payment_method_types,
      metadata: paymentIntent.metadata
    });
    
    // Check status
    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Betaling status is ${paymentIntent.status}, verwacht 'succeeded'`);
    }
    
    // Display all data
    displayPaymentDetails(paymentIntent);
    displayAbonnementDetails(paymentIntent.metadata || {});
    
    // Haal abonnement_id op uit betalingen tabel (webhook heeft deze toegevoegd)
    await fetchAbonnementId(paymentIntent.id);
    
    // Check en toon machtiging
    checkAndShowMachtiging(paymentIntent);
    
    // Hide loading, show content
    hideLoading();
    
  } catch (error) {
    console.error('[AbonnementSuccess] Initialization failed:', error);
    showError(error.message);
  }
}

/**
 * Fetch abonnement_id from betalingen table
 * Retry logic: webhook kan 1-2 seconden duren voordat betaling in database staat
 * @param {string} paymentIntentId - Stripe PaymentIntent ID
 * @param {number} retryCount - Huidige retry poging
 * @param {number} maxRetries - Max aantal retries (3 = 1s + 2s + 4s = 7 seconden totaal)
 */
async function fetchAbonnementId(paymentIntentId, retryCount = 0, maxRetries = 3) {
  console.log('[AbonnementSuccess] Fetching abonnement_id for PaymentIntent:', paymentIntentId);
  
  try {
    const response = await apiClient(`/routes/stripe/get-payment-abonnement?payment_intent_id=${paymentIntentId}`, {
      method: 'GET'
    });
    
    if (response.found && response.abonnement_id) {
      abonnementId = response.abonnement_id;
      console.log('[AbonnementSuccess] ✅ Abonnement ID found:', abonnementId);
      return true;
    } else {
      console.warn('[AbonnementSuccess] ⚠️ Abonnement nog niet aangemaakt - webhook mogelijk nog bezig');
      return false;
    }
  } catch (error) {
    // 404 = betaling nog niet in database, webhook nog bezig
    if (error.status === 404 && retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log(`[AbonnementSuccess] ⏳ Retry ${retryCount + 1}/${maxRetries} over ${delay}ms (webhook processing)...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchAbonnementId(paymentIntentId, retryCount + 1, maxRetries);
    }
    
    console.error('[AbonnementSuccess] Fout bij ophalen abonnement_id na retries:', error);
    return false;
  }
}

/**
 * Display payment details
 */
function displayPaymentDetails(paymentIntent) {
  console.log('[AbonnementSuccess] Displaying payment details');
  
  const amountEuros = (paymentIntent.amount / 100).toFixed(2).replace('.', ',');
  const paymentMethodType = getPaymentMethodType(paymentIntent);
  const factuurNummer = paymentIntent.metadata?.factuur_nummer || 'Wordt gegenereerd...';
  
  // Vul payment details
  const amountEl = document.querySelector('[data-payment-details="amount"]');
  const factuurnummerEl = document.querySelector('[data-payment-details="factuurnummer"]');
  const methodEl = document.querySelector('[data-payment-details="betaalmethode"]');
  const idEl = document.querySelector('[data-payment-details="betaling_id"]');
  
  if (amountEl) amountEl.textContent = `€${amountEuros}`;
  if (factuurnummerEl) factuurnummerEl.textContent = factuurNummer;
  if (methodEl) methodEl.textContent = paymentMethodType;
  if (idEl) idEl.textContent = paymentIntent.id;
  
  console.log('[AbonnementSuccess] Payment details displayed:', {
    amount: `€${amountEuros}`,
    method: paymentMethodType,
    factuur: factuurNummer
  });
}

/**
 * Display abonnement details
 */
function displayAbonnementDetails(metadata) {
  console.log('[AbonnementSuccess] Displaying abonnement details with metadata:', metadata);
  
  if (!metadata || !metadata.startdatum) {
    console.warn('[AbonnementSuccess] Geen metadata voor abonnement details');
    return;
  }
  
  const startweekEl = document.querySelector('[data-abonnement-details="startweek"]');
  const frequentieEl = document.querySelector('[data-abonnement-details="frequentie"]');
  const sessiesEl = document.querySelector('[data-abonnement-details="sessies"]');
  const volgendeBetEl = document.querySelector('[data-abonnement-details="volgende betaling"]');
  
  if (startweekEl && metadata.startdatum) {
    startweekEl.textContent = formatDate(metadata.startdatum);
  }
  if (frequentieEl && metadata.frequentie) {
    frequentieEl.textContent = getFrequencyLabel(metadata.frequentie);
  }
  if (sessiesEl) {
    sessiesEl.textContent = metadata.sessions_per_4w || '4';
  }
  if (volgendeBetEl && metadata.startdatum) {
    const nextBilling = calculateNextBilling(metadata.startdatum);
    volgendeBetEl.textContent = formatDate(nextBilling);
  }
  
  console.log('[AbonnementSuccess] Abonnement details displayed');
}

/**
 * Check if machtiging row should be shown and handle SEPA setup
 */
async function checkAndShowMachtiging(paymentIntent) {
  console.log('[AbonnementSuccess] Checking machtiging requirement');
  
  const paymentMethodType = paymentIntent.payment_method_types?.[0];
  const machtigingRow = document.querySelector('[data-abonnement="machtiging-row"]');
  
  if (!machtigingRow) {
    console.warn('[AbonnementSuccess] Machtiging row element not found');
    return;
  }
  
  // Toon machtiging row alleen als NIET met sepa_debit betaald
  if (paymentMethodType === 'sepa_debit') {
    console.log('[AbonnementSuccess] Paid with SEPA, hide machtiging row');
    machtigingRow.style.display = 'none';
    return;
  }
  
  console.log('[AbonnementSuccess] Paid with', paymentMethodType, ', show machtiging row');
  machtigingRow.style.display = 'flex'; // Of 'block', afhankelijk van je CSS
  
  // Setup click handler for machtiging button
  const machtigingButton = document.querySelector('[data-abonnement="machtiging-open-button"]');
  if (machtigingButton) {
    machtigingButton.addEventListener('click', (e) => {
      e.preventDefault();
      handleMachtigingClick(paymentIntent);
    });
  }
}

/**
 * Handle machtiging button click - open SEPA setup modal/flow
 */
async function handleMachtigingClick(paymentIntent) {
  console.log('[AbonnementSuccess] Machtiging button clicked');
  console.log('[AbonnementSuccess] Current abonnementId:', abonnementId);
  
  if (!abonnementId) {
    console.warn('[AbonnementSuccess] Geen abonnement_id - probeer opnieuw op te halen');
    
    // Probeer nogmaals op te halen
    await fetchAbonnementId(paymentIntent.id);
    
    if (!abonnementId) {
      console.error('[AbonnementSuccess] Abonnement_id nog steeds niet gevonden');
      alert('Je abonnement wordt nog verwerkt. Probeer het over een minuut opnieuw of stel de machtiging later in via je dashboard onder "Abonnement".');
      return;
    }
  }
  
  try {
    // Request SetupIntent from backend
    const response = await apiClient('/routes/stripe/setup-sepa-mandate', {
      method: 'POST',
      body: JSON.stringify({
        abonnement_id: abonnementId
      })
    });
    
    if (response.already_completed) {
      console.log('[AbonnementSuccess] SEPA already completed');
      alert('Je automatische incasso is al ingesteld!');
      // Hide machtiging row
      const machtigingRow = document.querySelector('[data-abonnement="machtiging-row"]');
      if (machtigingRow) machtigingRow.style.display = 'none';
      return;
    }
    
    if (response.success && response.client_secret) {
      setupIntentClientSecret = response.client_secret;
      showSepaModal(paymentIntent.metadata);
    } else {
      throw new Error('Geen client secret ontvangen van backend');
    }
    
  } catch (error) {
    console.error('[AbonnementSuccess] SEPA setup request failed:', error);
    alert(`Kon automatische incasso niet starten: ${error.message}\n\nJe kunt dit later instellen via je dashboard.`);
  }
}

/**
 * Show SEPA setup modal with Stripe IBAN Element
 */
function showSepaModal(metadata) {
  console.log('[AbonnementSuccess] Opening SEPA modal');
  
  // TODO: Implement modal logic
  // Voor nu: simple implementation - you can extend this with a proper modal
  const container = document.createElement('div');
  container.setAttribute('data-sepa-modal', '');
  container.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;">
      <div style="background: white; padding: 2rem; border-radius: 8px; max-width: 500px; width: 90%;">
        <h3>Automatische Incasso Instellen</h3>
        <p>Vul je IBAN in om automatische incasso in te stellen voor toekomstige betalingen.</p>
        <form data-sepa-form>
          <div style="margin-bottom: 1rem;">
            <label>Naam rekeninghouder</label>
            <input type="text" data-sepa-name value="${metadata?.voornaam || ''} ${metadata?.achternaam || ''}" required style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
          </div>
          <div style="margin-bottom: 1rem;">
            <label>IBAN</label>
            <div data-iban-element style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;"></div>
            <div data-iban-error style="color: red; font-size: 0.875rem; margin-top: 0.25rem; display: none;"></div>
          </div>
          <div style="display: flex; gap: 1rem;">
            <button type="submit" data-sepa-submit style="flex: 1; padding: 0.75rem; background: #5469d4; color: white; border: none; border-radius: 4px; cursor: pointer;">Bevestigen</button>
            <button type="button" data-sepa-close style="padding: 0.75rem; background: #ccc; color: black; border: none; border-radius: 4px; cursor: pointer;">Annuleren</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.appendChild(container);
  
  // Mount Stripe IBAN Element
  const elements = stripe.elements();
  ibanElement = elements.create('iban', {
    supportedCountries: ['SEPA'],
    placeholderCountry: 'NL',
    style: {
      base: {
        fontSize: '16px',
        color: '#32325d',
        '::placeholder': { color: '#aab7c4' }
      },
      invalid: { color: '#fa755a' }
    }
  });
  
  ibanElement.mount('[data-iban-element]');
  
  // Error handling
  ibanElement.on('change', (event) => {
    const errorDiv = container.querySelector('[data-iban-error]');
    if (event.error) {
      errorDiv.textContent = event.error.message;
      errorDiv.style.display = 'block';
    } else {
      errorDiv.style.display = 'none';
    }
  });
  
  // Form submit
  const form = container.querySelector('[data-sepa-form]');
  form.addEventListener('submit', (e) => handleSepaSubmit(e, container));
  
  // Close button
  const closeBtn = container.querySelector('[data-sepa-close]');
  closeBtn.addEventListener('click', () => {
    if (ibanElement) ibanElement.destroy();
    container.remove();
  });
}

/**
 * Handle SEPA form submit
 */
async function handleSepaSubmit(event, modalContainer) {
  event.preventDefault();
  
  const submitButton = modalContainer.querySelector('[data-sepa-submit]');
  const originalText = submitButton.textContent;
  
  submitButton.disabled = true;
  submitButton.textContent = 'Verwerken...';
  
  try {
    const accountHolderName = modalContainer.querySelector('[data-sepa-name]').value;
    const email = paymentIntentData.metadata?.email || '';
    
    // Confirm SEPA setup with Stripe
    const { setupIntent, error } = await stripe.confirmSepaDebitSetup(
      setupIntentClientSecret,
      {
        payment_method: {
          sepa_debit: ibanElement,
          billing_details: {
            name: accountHolderName,
            email: email
          }
        }
      }
    );
    
    if (error) {
      throw new Error(error.message);
    }
    
    if (setupIntent.status !== 'succeeded') {
      throw new Error(`Setup status: ${setupIntent.status}`);
    }
    
    console.log('[AbonnementSuccess] SEPA SetupIntent succeeded:', setupIntent.id);
    
    // Finalize bij backend
    await finalizeSepaSetup(setupIntent.id);
    
    // Close modal
    if (ibanElement) ibanElement.destroy();
    modalContainer.remove();
    
    // Hide machtiging row
    const machtigingRow = document.querySelector('[data-abonnement="machtiging-row"]');
    if (machtigingRow) machtigingRow.style.display = 'none';
    
    alert('✅ Automatische incasso succesvol ingesteld!');
    
  } catch (error) {
    console.error('[AbonnementSuccess] SEPA setup failed:', error);
    alert(`SEPA setup mislukt: ${error.message}\n\nProbeer het opnieuw of stel later in via je dashboard.`);
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
}

/**
 * Finalize SEPA setup at backend
 */
async function finalizeSepaSetup(setupIntentId) {
  try {
    const response = await apiClient('/routes/stripe/confirm-sepa-setup', {
      method: 'POST',
      body: JSON.stringify({
        setup_intent_id: setupIntentId,
        abonnement_id: abonnementId
      })
    });
    
    if (!response.success) {
      throw new Error(response.error || 'SEPA finalization failed');
    }
    
    console.log('[AbonnementSuccess] SEPA setup finalized:', response);
    
  } catch (error) {
    console.error('[AbonnementSuccess] SEPA finalization failed:', error);
    throw error;
  }
}

/**
 * Get human-readable payment method type
 */
function getPaymentMethodType(paymentIntent) {
  const type = paymentIntent.payment_method_types?.[0] || 'unknown';
  
  const typeMap = {
    'ideal': 'iDEAL',
    'card': 'Creditcard',
    'sepa_debit': 'SEPA Incasso',
    'bancontact': 'Bancontact'
  };
  
  return typeMap[type] || type;
}

/**
 * Show/hide loading and content states
 */
function showLoading() {
  const loadingState = document.querySelector('[data-loading-state]');
  const contentState = document.querySelector('[data-content-state]');
  
  if (loadingState) loadingState.style.display = 'flex';
  if (contentState) contentState.style.display = 'none';
}

function hideLoading() {
  const loadingState = document.querySelector('[data-loading-state]');
  const contentState = document.querySelector('[data-content-state]');
  
  if (loadingState) loadingState.style.display = 'none';
  if (contentState) contentState.style.display = 'block';
}

/**
 * Show error state
 */
function showError(message) {
  const loadingState = document.querySelector('[data-loading-state]');
  const contentState = document.querySelector('[data-content-state]');
  
  if (loadingState) loadingState.style.display = 'none';
  if (contentState) contentState.style.display = 'none';
  
  console.error('[AbonnementSuccess] Error:', message);
  alert(`Er is een fout opgetreden: ${message}`);
  
  // Optionally redirect to homepage or dashboard
  setTimeout(() => {
    window.location.href = '/dashboard-klant';
  }, 3000);
}

/**
 * Utility: Format date
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('nl-NL', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
}

/**
 * Utility: Get frequency label
 */
function getFrequencyLabel(freq) {
  const labels = {
    'weekly': 'Wekelijks',
    'perweek': 'Wekelijks',
    'pertweeweek': 'Om de 2 weken',
    'pervierweken': 'Per 4 weken'
  };
  return labels[freq] || freq || '-';
}

/**
 * Utility: Calculate next billing date
 */
function calculateNextBilling(startdatum) {
  if (!startdatum) return null;
  
  const start = new Date(startdatum);
  const next = new Date(start);
  next.setDate(next.getDate() + 28); // 28 dagen = 4 weken
  
  return next;
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
