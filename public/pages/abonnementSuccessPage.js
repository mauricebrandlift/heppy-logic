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
    const paymentIntentId = urlParams.get('payment_intent');
    
    if (!paymentIntentClientSecret && !paymentIntentId) {
      throw new Error('Geen betaling informatie gevonden in URL');
    }
    
    // Retrieve PaymentIntent
    const { paymentIntent } = await stripe.retrievePaymentIntent(paymentIntentClientSecret);
    paymentIntentData = paymentIntent;
    
    console.log('[AbonnementSuccess] PaymentIntent:', paymentIntent);
    
    // Check status
    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Betaling status is ${paymentIntent.status}, verwacht 'succeeded'`);
    }
    
    // Display payment details
    displayPaymentDetails(paymentIntent);
    
    // Get abonnement data from metadata
    const abonnementId = paymentIntent.metadata?.abonnement_id;
    if (!abonnementId) {
      console.warn('[AbonnementSuccess] Geen abonnement_id in metadata');
    } else {
      await loadAbonnementData(abonnementId);
    }
    
    // Check if SEPA setup needed
    await checkSepaSetupNeeded(paymentIntent, abonnementId);
    
    // Display schoonmaker info
    displaySchoonmakerInfo(paymentIntent.metadata);
    
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
  
  document.querySelector('[data-payment-amount]').textContent = `€${amountEuros}`;
  document.querySelector('[data-payment-id]').textContent = paymentIntent.id;
  
  // Payment method
  const paymentMethodType = getPaymentMethodType(paymentIntent);
  document.querySelector('[data-payment-method]').textContent = paymentMethodType;
  
  // Invoice number (if available in metadata)
  const invoiceNumber = paymentIntent.metadata?.factuur_nummer || 'Wordt gegenereerd...';
  document.querySelector('[data-invoice-number]').textContent = invoiceNumber;
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
    // Fetch abonnement details (zou je via een endpoint moeten doen)
    // Voor nu gebruiken we metadata van PaymentIntent
    const metadata = paymentIntentData.metadata;
    
    document.querySelector('[data-start-date]').textContent = formatDate(metadata.startdatum);
    document.querySelector('[data-frequency]').textContent = getFrequencyLabel(metadata.frequentie);
    document.querySelector('[data-sessions-count]').textContent = metadata.sessions_per_4w || '4';
    
    // Next billing (startdatum + 28 dagen)
    const nextBilling = calculateNextBilling(metadata.startdatum);
    document.querySelector('[data-next-billing]').textContent = formatDate(nextBilling);
    
    abonnementData = { id: abonnementId, ...metadata };
    
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
  const schoonmakerNaam = metadata.schoonmaker_naam;
  
  if (schoonmakerNaam && schoonmakerNaam !== 'Niet toegewezen') {
    document.querySelector('[data-schoonmaker-assigned]').style.display = 'block';
    document.querySelector('[data-schoonmaker-name]').textContent = schoonmakerNaam;
  } else {
    document.querySelector('[data-schoonmaker-pending]').style.display = 'block';
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
  document.querySelector('[data-success-container]').style.display = 'none';
  document.querySelector('[data-loading-state]').style.display = 'block';
}

function hideLoading() {
  document.querySelector('[data-loading-state]').style.display = 'none';
  document.querySelector('[data-success-container]').style.display = 'block';
}

/**
 * Show error state
 */
function showError(message) {
  document.querySelector('[data-loading-state]').style.display = 'none';
  document.querySelector('[data-success-container]').style.display = 'none';
  document.querySelector('[data-error-state]').style.display = 'block';
  document.querySelector('[data-error-message]').textContent = message;
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
