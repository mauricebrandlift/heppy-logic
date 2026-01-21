/**
 * Abonnement Success Page Logic
 * 
 * Features:
 * - Load payment details from URL params
 * - Conditioneel SEPA setup tonen (alleen bij iDEAL/non-SEPA payment methods)
 * - SEPA mandate authorization flow
 * - Display abonnement info
 * - Schoonmaker status
 */

import { apiClient } from '../utils/api/client.js';

// State
let stripe = null;
let paymentIntentData = null;
let abonnementData = null;
let setupIntentClientSecret = null;
let ibanElement = null;

/**
 * Initialize page
 */
async function init() {
  console.log('[AbonnementSuccess] Initializing...');
  
  // Initialize Stripe
  if (!window.Stripe) {
    throw new Error('Stripe library niet geladen. Voeg Stripe.js toe aan je pagina.');
  }
  stripe = window.Stripe(window.STRIPE_PUBLISHABLE_KEY || 'pk_test_51QqKNJQ0RBkv5CKzAT1RCHUrdWQ5bPVFoKpqhGLOWePjm1o6J7bYXr5IyLtdZtCLGGrm7C8IUc1NjkWa0S4zC3jU00gVL2koW5');
  
  // Show loading
  showLoading();
  
  try {
    // Get URL params
    const urlParams = new URLSearchParams(window.location.search);
    const paymentIntentClientSecret = urlParams.get('payment_intent_client_secret');
    const paymentIntentId = urlParams.get('payment_intent') || urlParams.get('pi'); // Support both
    
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
      // Als we alleen ID hebben, gebruik backend endpoint
      const response = await apiClient(`/routes/stripe/retrieve-payment-intent?id=${paymentIntentId}`, {
        method: 'GET'
      });
      // Response bevat PaymentIntent data direct (niet in .paymentIntent property)
      const { correlationId, ...paymentIntentData } = response;
      paymentIntent = paymentIntentData;
    }
    paymentIntentData = paymentIntent;
    
    console.log('[AbonnementSuccess] PaymentIntent retrieved:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      metadata: paymentIntent.metadata
    });
    
    // Check status
    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Betaling status is ${paymentIntent.status}, verwacht 'succeeded'`);
    }
    
    // Display payment details
    displayPaymentDetails(paymentIntent);
    
    // Get abonnement data from metadata (may not be set yet if webhook hasn't processed)
    const abonnementId = paymentIntent.metadata?.abonnement_id;
    console.log('[AbonnementSuccess] Abonnement ID from metadata:', abonnementId);
    
    if (!abonnementId) {
      console.warn('[AbonnementSuccess] ⚠️ Geen abonnement_id in metadata - webhook mogelijk nog niet verwerkt');
      console.log('[AbonnementSuccess] Metadata flow:', paymentIntent.metadata?.flow);
      console.log('[AbonnementSuccess] Metadata aanvraagId:', paymentIntent.metadata?.aanvraagId);
    } else {
      await loadAbonnementData(abonnementId);
    }
    
    // Check if SEPA setup needed
    await checkSepaSetupNeeded(paymentIntent, abonnementId);
    
    // Display schoonmaker info (safe - handles missing metadata)
    displaySchoonmakerInfo(paymentIntent.metadata || {});
    
    // Hide loading, show content
    hideLoading();
    
  } catch (error) {
    console.error('[AbonnementSuccess] Initialization failed:', error);
    showError(error.message);
  }
}

/**
 * Display payment details
 */
function displayPaymentDetails(paymentIntent) {
  const amountEuros = (paymentIntent.amount / 100).toFixed(2);
  
  const amountEl = document.querySelector('[data-payment-amount]');
  const idEl = document.querySelector('[data-payment-id]');
  const methodEl = document.querySelector('[data-payment-method]');
  const invoiceEl = document.querySelector('[data-invoice-number]');
  
  if (amountEl) amountEl.textContent = `€${amountEuros}`;
  if (idEl) idEl.textContent = paymentIntent.id;
  
  // Payment method
  const paymentMethodType = getPaymentMethodType(paymentIntent);
  if (methodEl) methodEl.textContent = paymentMethodType;
  
  // Invoice number (if available in metadata)
  const invoiceNumber = paymentIntent.metadata?.factuur_nummer || 'Wordt gegenereerd...';
  if (invoiceEl) invoiceEl.textContent = invoiceNumber;
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
 * Load abonnement data from backend
 */
async function loadAbonnementData(abonnementId) {
  try {
    console.log('[AbonnementSuccess] loadAbonnementData called with ID:', abonnementId);
    
    // Fetch abonnement details (zou je via een endpoint moeten doen)
    // Voor nu gebruiken we metadata van PaymentIntent
    const metadata = paymentIntentData.metadata;
    console.log('[AbonnementSuccess] Using metadata for abonnement display:', metadata);
    
    const startDateEl = document.querySelector('[data-start-date]');
    const frequencyEl = document.querySelector('[data-frequency]');
    const sessionsEl = document.querySelector('[data-sessions-count]');
    const nextBillingEl = document.querySelector('[data-next-billing]');
    
    if (startDateEl && metadata.startdatum) {
      startDateEl.textContent = formatDate(metadata.startdatum);
    }
    if (frequencyEl && metadata.frequentie) {
      frequencyEl.textContent = getFrequencyLabel(metadata.frequentie);
    }
    if (sessionsEl) {
      sessionsEl.textContent = metadata.sessions_per_4w || '4';
    }
    
    // Next billing (startdatum + 28 dagen)
    if (nextBillingEl && metadata.startdatum) {
      const nextBilling = calculateNextBilling(metadata.startdatum);
      nextBillingEl.textContent = formatDate(nextBilling);
    }
    
    abonnementData = { id: abonnementId, ...metadata };
    console.log('[AbonnementSuccess] Abonnement data loaded successfully');
    
  } catch (error) {
    console.error('[AbonnementSuccess] Failed to load abonnement data:', error);
  }
}

/**
 * Check if SEPA setup is needed
 */
async function checkSepaSetupNeeded(paymentIntent, abonnementId) {
  if (!abonnementId) {
    console.log('[AbonnementSuccess] No abonnement, skip SEPA check');
    return;
  }
  
  const paymentMethodType = paymentIntent.payment_method_types?.[0];
  
  // SEPA setup alleen nodig als NIET betaald met sepa_debit
  const needsSepaSetup = paymentMethodType !== 'sepa_debit';
  
  if (!needsSepaSetup) {
    console.log('[AbonnementSuccess] Paid with SEPA, no setup needed');
    document.querySelector('[data-sepa-success]').style.display = 'block';
    return;
  }
  
  console.log('[AbonnementSuccess] SEPA setup required (paid with', paymentMethodType, ')');
  
  // Update current payment method in SEPA intro
  document.querySelector('[data-current-payment-method]').textContent = getPaymentMethodType(paymentIntent);
  
  // Show SEPA step in next steps
  document.querySelector('[data-sepa-step]').style.display = 'list-item';
  
  // Request SetupIntent from backend
  try {
    const response = await apiClient('/routes/stripe/setup-sepa-mandate', {
      method: 'POST',
      body: JSON.stringify({
        abonnement_id: abonnementId
      })
    });
    
    if (response.already_completed) {
      console.log('[AbonnementSuccess] SEPA already completed');
      document.querySelector('[data-sepa-success]').style.display = 'block';
      return;
    }
    
    if (response.success && response.client_secret) {
      setupIntentClientSecret = response.client_secret;
      showSepaSetup();
    }
    
  } catch (error) {
    console.error('[AbonnementSuccess] SEPA setup check failed:', error);
    // Niet fataal - toon optie om later te doen
    showSepaSetupLater();
  }
}

/**
 * Show SEPA setup section with Stripe IBAN Element
 */
function showSepaSetup() {
  const container = document.querySelector('[data-sepa-setup-container]');
  container.style.display = 'block';
  
  // Pre-fill name if available
  const metadata = paymentIntentData.metadata;
  const nameField = document.querySelector('[data-sepa-name]');
  if (metadata.voornaam && metadata.achternaam) {
    nameField.value = `${metadata.voornaam} ${metadata.achternaam}`;
  }
  
  // Mount Stripe IBAN Element
  const elements = stripe.elements();
  ibanElement = elements.create('iban', {
    supportedCountries: ['SEPA'],
    placeholderCountry: 'NL',
    style: {
      base: {
        fontSize: '16px',
        color: '#32325d',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        '::placeholder': {
          color: '#aab7c4'
        }
      },
      invalid: {
        color: '#fa755a',
        iconColor: '#fa755a'
      }
    }
  });
  
  ibanElement.mount('[data-iban-element]');
  
  // Listen for errors
  ibanElement.on('change', (event) => {
    const errorDiv = document.querySelector('[data-iban-error]');
    if (event.error) {
      errorDiv.textContent = event.error.message;
      errorDiv.style.display = 'block';
    } else {
      errorDiv.style.display = 'none';
    }
  });
  
  // Handle form submit
  const form = document.querySelector('[data-sepa-form]');
  form.addEventListener('submit', handleSepaSubmit);
  
  // Handle skip button (optioneel)
  const skipButton = document.querySelector('[data-sepa-skip-button]');
  if (skipButton) {
    skipButton.style.display = 'inline-block';
    skipButton.addEventListener('click', () => {
      document.querySelector('[data-sepa-setup-container]').style.display = 'none';
      showSepaSetupLater();
    });
  }
}

/**
 * Handle SEPA form submit
 */
async function handleSepaSubmit(event) {
  event.preventDefault();
  
  const submitButton = document.querySelector('[data-sepa-submit-button]');
  const originalText = submitButton.textContent;
  const loadingText = submitButton.getAttribute('data-loading-text') || 'Verwerken...';
  
  submitButton.disabled = true;
  submitButton.textContent = loadingText;
  
  try {
    const accountHolderName = document.querySelector('[data-sepa-name]').value;
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
        abonnement_id: abonnementData?.id
      })
    });
    
    if (response.success) {
      console.log('[AbonnementSuccess] SEPA setup finalized:', response);
      
      // Hide setup form, show success
      document.querySelector('[data-sepa-setup-container]').style.display = 'none';
      document.querySelector('[data-sepa-success]').style.display = 'block';
      document.querySelector('[data-sepa-step]').style.display = 'none';
      
      // Auto redirect na 5 seconden
      setTimeout(() => {
        goToDashboard();
      }, 5000);
    } else {
      throw new Error(response.error || 'SEPA finalization failed');
    }
    
  } catch (error) {
    console.error('[AbonnementSuccess] SEPA finalization failed:', error);
    throw error;
  }
}

/**
 * Show "setup later" message
 */
function showSepaSetupLater() {
  const container = document.querySelector('[data-sepa-setup-container]');
  container.innerHTML = `
    <div data-sepa-later-box>
      <h3>⏱️ Automatische Incasso Later Instellen</h3>
      <p>
        Je kunt automatische incasso op elk moment activeren via je dashboard 
        onder "Abonnement Instellingen".
      </p>
      <p>
        <strong>Let op:</strong> Zonder automatische incasso moet je elke verlenging 
        handmatig betalen via een link in je email.
      </p>
    </div>
  `;
  container.style.display = 'block';
}

/**
 * Display schoonmaker info
 */
function displaySchoonmakerInfo(metadata) {
  console.log('[AbonnementSuccess] displaySchoonmakerInfo called with:', metadata);
  
  if (!metadata) {
    console.warn('[AbonnementSuccess] No metadata provided to displaySchoonmakerInfo');
    return;
  }
  
  const schoonmakerNaam = metadata.schoonmaker_naam;
  console.log('[AbonnementSuccess] Schoonmaker naam from metadata:', schoonmakerNaam);
  
  const assignedEl = document.querySelector('[data-schoonmaker-assigned]');
  const nameEl = document.querySelector('[data-schoonmaker-name]');
  const pendingEl = document.querySelector('[data-schoonmaker-pending]');
  
  if (schoonmakerNaam && schoonmakerNaam !== 'Niet toegewezen') {
    console.log('[AbonnementSuccess] Showing assigned schoonmaker');
    if (assignedEl) assignedEl.style.display = 'block';
    if (nameEl) nameEl.textContent = schoonmakerNaam;
  } else {
    console.log('[AbonnementSuccess] Showing pending schoonmaker');
    if (pendingEl) pendingEl.style.display = 'block';
  }
}

/**
 * Navigate to dashboard
 */
function goToDashboard() {
  window.location.href = '/dashboard-klant';
}

/**
 * Download invoice PDF
 */
async function downloadInvoice() {
  const invoiceUrl = paymentIntentData.metadata?.invoice_pdf_url;
  if (invoiceUrl) {
    window.open(invoiceUrl, '_blank');
  } else {
    alert('Factuur wordt nog gegenereerd. Check je email of dashboard.');
  }
}

/**
 * Show/hide loading state
 */
function showLoading() {
  const successContainer = document.querySelector('[data-success-container]');
  const loadingState = document.querySelector('[data-loading-state]');
  
  if (successContainer) successContainer.style.display = 'none';
  if (loadingState) loadingState.style.display = 'block';
}

function hideLoading() {
  const loadingState = document.querySelector('[data-loading-state]');
  const successContainer = document.querySelector('[data-success-container]');
  
  if (loadingState) loadingState.style.display = 'none';
  if (successContainer) successContainer.style.display = 'block';
}

/**
 * Show error state
 */
function showError(message) {
  const loadingState = document.querySelector('[data-loading-state]');
  const successContainer = document.querySelector('[data-success-container]');
  const errorState = document.querySelector('[data-error-state]');
  const errorMessage = document.querySelector('[data-error-message]');
  
  if (loadingState) loadingState.style.display = 'none';
  if (successContainer) successContainer.style.display = 'none';
  if (errorState) errorState.style.display = 'block';
  if (errorMessage) errorMessage.textContent = message;
  
  console.error('[AbonnementSuccess] Error shown:', message);
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
    'pertweeweek': 'Om de 2 weken',
    'pervierweken': 'Per 4 weken'
  };
  return labels[freq] || freq || '-';
}

/**
 * Utility: Calculate next billing date
 */
function calculateNextBilling(startDate) {
  if (!startDate) return null;
  const start = new Date(startDate);
  const next = new Date(start);
  next.setDate(next.getDate() + 28); // 4 weken
  return next.toISOString().split('T')[0];
}

/**
 * Event Listeners
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize page
  init();
  
  // Dashboard button
  const dashboardBtn = document.querySelector('[data-goto-dashboard]');
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', goToDashboard);
  }
  
  // Invoice download button
  const invoiceBtn = document.querySelector('[data-download-invoice]');
  if (invoiceBtn) {
    invoiceBtn.addEventListener('click', downloadInvoice);
  }
  
  // Retry button (error state)
  const retryBtn = document.querySelector('[data-retry-button]');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }
  
  // Initialize
  init();
});
