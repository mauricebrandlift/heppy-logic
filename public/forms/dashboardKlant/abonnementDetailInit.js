// public/forms/dashboardKlant/abonnementDetailInit.js
/**
 * Dashboard Abonnement Detail initialisatie voor klanten
 * Haalt abonnement details op en toont op de pagina
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';
import { hideAllSuccessMessages, showError as showFormError, hideError, showLoader, hideLoader } from '../ui/formUi.js';
import { initInvoiceButton } from '../../utils/invoiceHelper.js';

// State voor SEPA modal
let currentAbonnementId = null;
let currentUserEmail = null; // Voor SEPA setup
let currentUserAddress = null; // Voor SEPA billing_details
let stripe = null;
let setupIntentClientSecret = null;
let ibanElement = null;

/**
 * Formatteer datum naar NL formaat
 */
function formatDatum(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('nl-NL', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
}

/**
 * Haal jaar uit datum
 */
function getJaarFromDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.getFullYear();
}

/**
 * Haal weeknummer uit datum (ISO week)
 */
function getWeeknummerFromDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  
  // ISO week berekening
  const tempDate = new Date(date.valueOf());
  const dayNum = (date.getDay() + 6) % 7;
  tempDate.setDate(tempDate.getDate() - dayNum + 3);
  const firstThursday = tempDate.valueOf();
  tempDate.setMonth(0, 1);
  if (tempDate.getDay() !== 4) {
    tempDate.setMonth(0, 1 + ((4 - tempDate.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - tempDate) / 604800000);
}

/**
 * Formatteer frequentie voor weergave
 */
function formatFrequentie(frequentie) {
  const mapping = {
    'weekly': '1x per week',
    'perweek': '1x per week',
    'pertweeweek': '1x per 2 weken',
    'pervierweken': '1x per 4 weken',
    'eenmalig': 'Eenmalig'
  };
  return mapping[frequentie] || frequentie;
}

/**
 * Formatteer status voor weergave
 */
function formatStatus(status) {
  const mapping = {
    'wachtrij': 'Wachtrij',
    'actief': 'Actief',
    'gepauzeerd': 'Gepauzeerd',
    'gestopt': 'Gestopt',
    'opgezegd': 'Opgezegd'
  };
  return mapping[status] || status;
}

/**
 * Voeg status class toe aan element
 */
function addStatusClass(element, status) {
  if (!element) return;
  
  const statusClassMap = {
    'actief': 'is-active',
    'wachtrij': 'is-pending',
    'gepauzeerd': 'is-unactive',
    'gestopt': 'is-unactive',
    'opgezegd': 'is-unactive'
  };
  
  const statusClass = statusClassMap[status] || 'is-pending';
  element.classList.add(statusClass);
}

/**
 * Formatteer bedrag in centen naar euros
 */
function formatBedrag(cents) {
  if (!cents && cents !== 0) return '-';
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

/**
 * Render facturen lijst voor dit abonnement
 */
function populateFacturen(facturen) {
  const template = document.querySelector('[data-factuur-item]');
  
  if (!template) {
    console.warn('[Abonnement Detail] Factuur item template niet gevonden');
    return;
  }
  
  const parent = template.parentElement;
  
  // Clear bestaande items (behalve template met lege ID)
  const existingItems = parent.querySelectorAll('[data-factuur-item]:not([data-factuur-item=""])');
  existingItems.forEach(item => item.remove());
  
  if (!facturen || facturen.length === 0) {
    console.log('[Abonnement Detail] Geen facturen om weer te geven');
    return;
  }
  
  facturen.forEach(factuur => {
    const clone = template.cloneNode(true);
    clone.setAttribute('data-factuur-item-id', factuur.id);
    clone.style.display = '';
    
    // Factuurnummer
    const nummerEl = clone.querySelector('[data-factuur-nummer]');
    if (nummerEl) nummerEl.textContent = factuur.factuur_nummer || '-';
    
    // Type (altijd "Abonnement" voor deze pagina)
    const typeEl = clone.querySelector('[data-factuur-type]');
    if (typeEl) typeEl.textContent = 'Abonnement';
    
    // Periode - bereken uit regels
    const periodeTitle = clone.querySelector('[data-factuur-periode-title]');
    const periodeDatum = clone.querySelector('[data-factuur-periode-datum]');
    
    if (periodeTitle) periodeTitle.textContent = 'Periode';
    
    try {
      const regels = typeof factuur.regels === 'string' ? JSON.parse(factuur.regels) : factuur.regels;
      if (regels && regels.length > 0 && regels[0].periode) {
        const startDate = new Date(regels[0].periode.start);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 27); // 4 weken = 28 dagen
        
        if (periodeDatum) {
          periodeDatum.textContent = `${startDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        }
      } else {
        // Fallback naar factuurdatum maand/jaar
        if (periodeDatum) {
          const date = new Date(factuur.factuurdatum);
          periodeDatum.textContent = date.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
        }
      }
    } catch (e) {
      // Fallback naar factuurdatum maand/jaar
      if (periodeDatum) {
        const date = new Date(factuur.factuurdatum);
        periodeDatum.textContent = date.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
      }
    }
    
    // Details (omschrijving)
    const detailsEl = clone.querySelector('[data-factuur-details]');
    if (detailsEl) {
      detailsEl.textContent = factuur.omschrijving || 'Schoonmaakabonnement';
    }
    
    // Bedrag (alleen getal, € staat al in HTML)
    const bedragEl = clone.querySelector('[data-factuur-bedrag]');
    if (bedragEl) bedragEl.textContent = (factuur.amount_cents / 100).toFixed(2).replace('.', ',');
    
    // Status
    const statusEl = clone.querySelector('[data-factuur-status]');
    if (statusEl) {
      const statusText = statusEl.querySelector('.text-size-small');
      if (statusText) {
        const statusMapping = {
          'paid': 'Betaald',
          'open': 'Open',
          'draft': 'Concept',
          'void': 'Geannuleerd',
          'uncollectible': 'Oninbaar',
          'betaald': 'Betaald',
          'openstaand': 'Open'
        };
        statusText.textContent = statusMapping[factuur.status] || factuur.status;
      }
      
      // Status classes (zelfde als facturenInit.js)
      const statusClassMap = {
        'paid': 'is-active',
        'betaald': 'is-active',
        'open': 'is-pending',
        'openstaand': 'is-pending',
        'draft': 'is-pending',
        'void': 'is-unactive',
        'uncollectible': 'is-unactive'
      };
      const statusClass = statusClassMap[factuur.status] || 'is-pending';
      statusEl.classList.add(statusClass);
    }
    
    // Invoice download button
    const buttonEl = clone.querySelector('[data-invoice-button]');
    if (buttonEl && factuur.stripe_invoice_id) {
      buttonEl.setAttribute('data-invoice-id', factuur.stripe_invoice_id);
      buttonEl.style.display = '';
    } else if (buttonEl) {
      buttonEl.style.display = 'none';
    }
    
    parent.appendChild(clone);
  });
  
  // Hide template
  template.style.display = 'none';
  
  // Initialize invoice buttons
  initInvoiceButton();
  
  console.log(`✅ [Abonnement Detail] ${facturen.length} facturen gerenderd`);
}

/**
 * Render SEPA incasso sectie
 */
function populateSepaSection(sepa) {
  const heeftMandaat = document.querySelector('[data-sepa-state="heeft-mandaat"]');
  const geenMandaat = document.querySelector('[data-sepa-state="geen-mandaat"]');
  
  if (!heeftMandaat || !geenMandaat) {
    console.warn('[Abonnement Detail] SEPA state containers niet gevonden');
    return;
  }
  
  // Toon/verberg states op basis van setup_completed
  if (sepa.setup_completed) {
    heeftMandaat.style.display = 'block';
    geenMandaat.style.display = 'none';
    
    // Populate IBAN laatste 4 cijfers
    const ibanEl = heeftMandaat.querySelector('[data-sepa-iban-laatste4]');
    if (ibanEl && sepa.iban_last4) {
      ibanEl.textContent = `NL••••${sepa.iban_last4}`;
    } else if (ibanEl) {
      ibanEl.textContent = 'NL••••••••';
    }
    
    // Populate actief sinds datum
    const actiefSindsEl = heeftMandaat.querySelector('[data-sepa-actief-sinds]');
    if (actiefSindsEl && sepa.actief_sinds) {
      const date = new Date(sepa.actief_sinds);
      actiefSindsEl.textContent = date.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    
    // Attach click handler voor wijzig button
    const wijzigBtn = heeftMandaat.querySelector('[data-sepa-wijzig-button]');
    if (wijzigBtn) {
      wijzigBtn.addEventListener('click', handleSepaWijzigen);
    }
    
    console.log('✅ [Abonnement Detail] SEPA status: Actief');
  } else {
    heeftMandaat.style.display = 'none';
    geenMandaat.style.display = 'block';
    
    // Attach click handler voor setup button
    const setupBtn = geenMandaat.querySelector('[data-sepa-setup-button]');
    if (setupBtn) {
      setupBtn.addEventListener('click', handleSepaSetup);
    }
    
    console.log('⚠️ [Abonnement Detail] SEPA status: Niet actief');
  }
}

/**
 * Handle SEPA setup button click
 */
async function handleSepaSetup() {
  console.log('[Abonnement Detail] SEPA setup button clicked');
  
  if (!currentAbonnementId) {
    console.error('[Abonnement Detail] Geen abonnement ID beschikbaar');
    alert('Fout: geen abonnement ID. Herlaad de pagina.');
    return;
  }
  
  // Initialize Stripe if not done yet
  if (!stripe) {
    try {
      if (!window.Stripe) {
        throw new Error('Stripe library niet geladen');
      }
      const stripeConfig = await apiClient('/routes/stripe/public-config', { method: 'GET' });
      if (!stripeConfig || !stripeConfig.publishableKey) {
        throw new Error('Stripe configuratie niet gevonden');
      }
      stripe = window.Stripe(stripeConfig.publishableKey);
      console.log('[Abonnement Detail] ✅ Stripe initialized');
    } catch (error) {
      console.error('[Abonnement Detail] Stripe initialization failed:', error);
      alert('Betaalprovider kon niet geladen worden. Herlaad de pagina.');
      return;
    }
  }
  
  try {
    // Request SetupIntent from backend
    const response = await apiClient('/routes/stripe/setup-sepa-mandate', {
      method: 'POST',
      body: JSON.stringify({
        abonnement_id: currentAbonnementId
      })
    });
    
    if (response.already_completed) {
      console.log('[Abonnement Detail] SEPA already completed');
      alert('Automatische incasso is al ingesteld voor dit abonnement.');
      // Reload page to show updated status
      window.location.reload();
      return;
    }
    
    if (response.success && response.client_secret) {
      setupIntentClientSecret = response.client_secret;
      currentUserAddress = response.address || null; // Store voor SEPA confirm
      showSepaModal();
    } else {
      throw new Error('Geen client secret ontvangen van backend');
    }
    
  } catch (error) {
    console.error('[Abonnement Detail] SEPA setup request failed:', error.message);
    alert('Fout bij het starten van SEPA setup. Probeer het opnieuw.');
  }
}

/**
 * Show SEPA setup modal with Stripe IBAN Element
 * Uses Webflow modal: [data-modal-wrapper="sepa"]
 */
function showSepaModal() {
  console.log('[Abonnement Detail] Opening SEPA modal');
  
  const modal = document.querySelector('[data-modal-wrapper="sepa"]');
  if (!modal) {
    console.error('[Abonnement Detail] SEPA modal not found in DOM');
    alert('SEPA modal niet gevonden in de pagina.');
    return;
  }

  // Pre-fill name field (from current user data if available)
  const nameField = modal.querySelector('[data-modal-field="sepa-name"]');
  // Name will be filled by user

  // Hide IBAN input field (Stripe Element will replace it)
  const ibanInput = modal.querySelector('[data-modal-field="sepa-iban"]');
  if (ibanInput) ibanInput.style.display = 'none';

  // Mount Stripe IBAN Element in parent container
  const ibanContainer = ibanInput?.parentElement;
  if (!ibanContainer) {
    console.error('[Abonnement Detail] IBAN container not found');
    return;
  }

  // Create Stripe Element container
  let stripeElementDiv = modal.querySelector('[data-element="stripe-iban-element"]');
  if (!stripeElementDiv) {
    stripeElementDiv = document.createElement('div');
    stripeElementDiv.setAttribute('data-element', 'stripe-iban-element');
    stripeElementDiv.className = 'form_input w-input'; // Match Webflow styling
    ibanInput.insertAdjacentElement('afterend', stripeElementDiv);
  }

  // Create Stripe IBAN Element
  const elements = stripe.elements();
  ibanElement = elements.create('iban', {
    supportedCountries: ['SEPA'],
    placeholderCountry: 'NL',
    style: {
      base: {
        fontSize: '16px',
        color: '#32325d',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        '::placeholder': { color: '#aab7c4' }
      },
      invalid: { color: '#fa755a' }
    }
  });

  ibanElement.mount('[data-element="stripe-iban-element"]');

  // IBAN validation errors + button state
  const ibanError = modal.querySelector('[data-modal-error="sepa-iban"]');
  const submitButton = modal.querySelector('[data-modal-submit="sepa"]');
  
  // Initially disable submit button until IBAN is valid
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.classList.add('is-disabled');
    submitButton.style.pointerEvents = 'none';
  }
  
  ibanElement.on('change', (event) => {
    if (event.error) {
      showFormError(ibanError, event.error.message);
      // Disable button on error
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.classList.add('is-disabled');
        submitButton.style.pointerEvents = 'none';
      }
    } else {
      hideError(ibanError);
      // Enable button when IBAN is valid and complete
      if (event.complete && submitButton) {
        submitButton.disabled = false;
        submitButton.classList.remove('is-disabled');
        submitButton.style.pointerEvents = '';
        console.log('[Abonnement Detail] ✅ Submit button enabled (IBAN valid)');
      } else if (submitButton) {
        // Incomplete but no error - keep disabled
        submitButton.disabled = true;
        submitButton.classList.add('is-disabled');
        submitButton.style.pointerEvents = 'none';
      }
    }
  });

  // Submit button click handler (DIV button pattern)
  const submitHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleSepaModalSubmit(modal);
  };
  submitButton?.removeEventListener('click', submitHandler); // Prevent duplicates
  submitButton?.addEventListener('click', submitHandler);

  // Close button handler
  const closeBtn = modal.querySelector('[data-modal-close="sepa"]');
  const closeHandler = () => {
    if (ibanElement) {
      ibanElement.destroy();
      ibanElement = null;
    }
    modal.style.display = 'none';
  };
  closeBtn?.removeEventListener('click', closeHandler);
  closeBtn?.addEventListener('click', closeHandler);

  // Show modal
  modal.style.display = 'flex';
}

/**
 * Handle SEPA modal form submit
 */
async function handleSepaModalSubmit(modal) {
  const submitButton = modal.querySelector('[data-modal-submit="sepa"]');
  const form = modal.querySelector('form');
  const successWrapper = modal.querySelector('[data-modal-succes="sepa"]');
  const errorWrapper = modal.querySelector('[data-modal-error="error"]');
  const generalError = modal.querySelector('[data-modal-error="general"]');
  
  // Show loading state
  showLoader(submitButton);

  // Hide previous errors
  hideError(generalError);
  if (errorWrapper) errorWrapper.style.display = 'none';
  
  try {
    const accountHolderName = modal.querySelector('[data-modal-field="sepa-name"]')?.value;
    
    if (!accountHolderName) {
      throw new Error('Vul de naam van de rekeninghouder in');
    }
    
    // Use email from page data (stored on init)
    const email = currentUserEmail || '';
    
    if (!email) {
      throw new Error('Email adres niet gevonden. Herlaad de pagina.');
    }
    
    // Confirm SEPA setup with Stripe
    const { setupIntent, error } = await stripe.confirmSepaDebitSetup(
      setupIntentClientSecret,
      {
        payment_method: {
          sepa_debit: ibanElement,
          billing_details: {
            name: accountHolderName,
            email: email,
            address: currentUserAddress || undefined
          }
        }
      }
    );
    
    if (error) {
      // Sanitize Stripe error (remove API keys)
      const sanitizedMessage = error.message?.replace(/pk_test_[a-zA-Z0-9]+/g, '[API_KEY]') || 'Er is een fout opgetreden';
      console.error('[Abonnement Detail] Stripe SEPA error:', sanitizedMessage);
      throw new Error('Kon IBAN niet valideren. Controleer je IBAN en probeer opnieuw.');
    }
    
    if (setupIntent.status !== 'succeeded') {
      console.warn('[Abonnement Detail] SetupIntent status:', setupIntent.status);
      throw new Error('Automatische incasso kon niet worden voltooid');
    }
    
    console.log('[Abonnement Detail] SEPA SetupIntent succeeded:', setupIntent.id);
    
    // Finalize bij backend
    await finalizeSepaSetup(setupIntent.id);
    
    // Show success, hide form
    if (form) form.style.display = 'none';
    if (successWrapper) successWrapper.style.display = 'block';
    
    // Close modal and reload page after 2 seconds
    setTimeout(() => {
      if (ibanElement) {
        ibanElement.destroy();
        ibanElement = null;
      }
      modal.style.display = 'none';
      
      // Reset form for next time
      if (form) form.style.display = 'block';
      if (successWrapper) successWrapper.style.display = 'none';
      
      // Reload page to show updated SEPA status
      window.location.reload();
    }, 2000);
    
  } catch (error) {
    // Log sanitized error
    const sanitizedError = String(error.message || error).replace(/pk_test_[a-zA-Z0-9]+/g, '[API_KEY]');
    console.error('[Abonnement Detail] SEPA setup failed:', sanitizedError);
    
    // Show user-friendly error in modal
    showFormError(generalError, error.message || 'Er is een fout opgetreden. Probeer het opnieuw.');
    if (errorWrapper) {
      const errorText = errorWrapper.querySelector('.form_field-error-message');
      if (errorText) errorText.textContent = error.message || 'Er is een fout opgetreden';
      errorWrapper.style.display = 'block';
    }
    
    // Re-enable submit button
    hideLoader(submitButton);
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
        abonnement_id: currentAbonnementId
      })
    });
    
    if (!response.success) {
      throw new Error(response.error || 'SEPA finalization failed');
    }
    
    console.log('[Abonnement Detail] SEPA setup finalized:', response);
    
  } catch (error) {
    console.error('[Abonnement Detail] SEPA finalization failed:', error);
    throw error;
  }
}

/**
 * Handle SEPA wijzigen button click
 */
async function handleSepaWijzigen() {
  console.log('[Abonnement Detail] SEPA wijzig button clicked');
  
  if (!currentAbonnementId) {
    console.error('[Abonnement Detail] Geen abonnement ID beschikbaar');
    alert('Fout: geen abonnement ID. Herlaad de pagina.');
    return;
  }
  
  // Initialize Stripe if not done yet
  if (!stripe) {
    try {
      if (!window.Stripe) {
        throw new Error('Stripe library niet geladen');
      }
      const stripeConfig = await apiClient('/routes/stripe/public-config', { method: 'GET' });
      if (!stripeConfig || !stripeConfig.publishableKey) {
        throw new Error('Stripe configuratie niet gevonden');
      }
      stripe = window.Stripe(stripeConfig.publishableKey);
      console.log('[Abonnement Detail] ✅ Stripe initialized');
    } catch (error) {
      console.error('[Abonnement Detail] Stripe initialization failed:', error);
      alert('Betaalprovider kon niet geladen worden. Herlaad de pagina.');
      return;
    }
  }
  
  try {
    // Request SetupIntent from backend (force_update=true voor wijzigen)
    const response = await apiClient('/routes/stripe/setup-sepa-mandate', {
      method: 'POST',
      body: JSON.stringify({
        abonnement_id: currentAbonnementId,
        force_update: true
      })
    });
    
    if (response.success && response.client_secret) {
      setupIntentClientSecret = response.client_secret;
      currentUserAddress = response.address || null; // Store voor SEPA confirm
      showSepaModal();
    } else {
      throw new Error('Geen client secret ontvangen van backend');
    }
    
  } catch (error) {
    console.error('[Abonnement Detail] SEPA wijzig request failed:', error.message);
    alert('Fout bij het starten van rekeningnummer wijziging. Probeer het opnieuw.');
  }
}

/**
 * Bereken volgende factuur datum op basis van startdatum en frequentie
 */
function berekenVolgendeFactuur(startdatum, frequentie, sessionsPerCycle) {
  if (!startdatum) return null;
  
  const start = new Date(startdatum);
  const nu = new Date();
  
  // Bepaal dagen tussen facturen op basis van frequentie
  let dagenTussenFacturen;
  if (frequentie === 'weekly' || frequentie === 'perweek') {
    dagenTussenFacturen = 28; // 4 weken cycle
  } else if (frequentie === 'pertweeweek') {
    dagenTussenFacturen = 28; // 4 weken cycle (2x per cycle)
  } else if (frequentie === 'pervierweken') {
    dagenTussenFacturen = 28; // 4 weken cycle
  } else {
    dagenTussenFacturen = 28; // Default 4 weken
  }
  
  // Bereken hoeveel cycles zijn verstreken sinds start
  const dagenVerstreken = Math.floor((nu - start) / (1000 * 60 * 60 * 24));
  const cyclesVerstreken = Math.floor(dagenVerstreken / dagenTussenFacturen);
  
  // Bereken volgende factuur datum
  const volgendeFactuur = new Date(start);
  volgendeFactuur.setDate(volgendeFactuur.getDate() + ((cyclesVerstreken + 1) * dagenTussenFacturen));
  
  return volgendeFactuur;
}

/**
 * Toon/verberg loading state
 */
function showLoading() {
  const loadingState = document.querySelector('[data-loading-state]');
  const contentState = document.querySelector('[data-content-state]');
  
  if (loadingState) loadingState.style.display = 'block';
  if (contentState) contentState.style.display = 'none';
}

function hideLoading() {
  const loadingState = document.querySelector('[data-loading-state]');
  const contentState = document.querySelector('[data-content-state]');
  
  if (loadingState) loadingState.style.display = 'none';
  if (contentState) contentState.style.display = 'block';
}

/**
 * Toon error message
 */
function showError(message) {
  const loadingState = document.querySelector('[data-loading-state]');
  const contentState = document.querySelector('[data-content-state]');
  const errorContainer = document.querySelector('[data-dashboard-error]');
  
  // Verberg loading en content
  if (loadingState) loadingState.style.display = 'none';
  if (contentState) contentState.style.display = 'none';
  
  // Toon error
  if (errorContainer) {
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
  }
}

/**
 * Vul abonnement header details in
 */
function populateAbonnementHeader(data) {
  // Abonnement nummer (ID laatste 8 chars)
  const nummerEl = document.querySelector('[data-abo-nummer]');
  if (nummerEl && data.id) {
    nummerEl.textContent = `ABO-${data.id.slice(-8).toUpperCase()}`;
  }

  // Start jaar en week
  const startJaarEl = document.querySelector('[data-abo-start-jaar]');
  const startWeekEl = document.querySelector('[data-abo-start-week]');
  
  if (startJaarEl) startJaarEl.textContent = getJaarFromDate(data.startdatum);
  if (startWeekEl) startWeekEl.textContent = `Week ${getWeeknummerFromDate(data.startdatum)}`;

  // Status
  const statusEl = document.querySelector('[data-abo-status]');
  if (statusEl) {
    statusEl.textContent = formatStatus(data.status);
    addStatusClass(statusEl, data.status);
  }

  // Adres
  if (data.adres) {
    const adresEl = document.querySelector('[data-abo-adres]');
    const postcodeEl = document.querySelector('[data-abo-postcode-plaats]');
    
    if (adresEl) {
      const adres = `${data.adres.straat} ${data.adres.huisnummer}${data.adres.toevoeging ? ' ' + data.adres.toevoeging : ''}`;
      adresEl.textContent = adres;
    }
    if (postcodeEl) {
      postcodeEl.textContent = `${data.adres.postcode} ${data.adres.plaats}`;
    }
  }

  // Huidige details
  const frequentieEl = document.querySelector('[data-abo-frequentie]');
  const urenEl = document.querySelector('[data-abo-uren]');
  const kostenEl = document.querySelector('[data-abo-kosten]');
  const prijsPerSessieEl = document.querySelector('[data-abo-prijs-per-sessie]');
  const volgendeFactuurEl = document.querySelector('[data-abo-volgende-factuur]');

  if (frequentieEl) frequentieEl.textContent = formatFrequentie(data.frequentie);
  if (urenEl) urenEl.textContent = `${data.uren} uur`;
  if (kostenEl && data.bundle_amount_cents) {
    kostenEl.textContent = formatBedrag(data.bundle_amount_cents);
  }
  
  // Prijs per sessie
  if (prijsPerSessieEl && data.prijs_per_sessie_cents) {
    prijsPerSessieEl.textContent = formatBedrag(data.prijs_per_sessie_cents);
  }
  
  // Volgende factuur (alleen bij actieve abonnementen)
  if (volgendeFactuurEl && data.status === 'actief' && data.startdatum) {
    const volgendeFactuur = berekenVolgendeFactuur(data.startdatum, data.frequentie, data.sessions_per_4w);
    if (volgendeFactuur) {
      volgendeFactuurEl.textContent = formatDatum(volgendeFactuur.toISOString());
    }
  } else if (volgendeFactuurEl) {
    volgendeFactuurEl.textContent = '-';
  }
}

/**
 * Vul schoonmaker sectie in
 */
function populateSchoonmakerSection(data) {
  const schoonmakerSection = document.querySelector('[data-schoonmaker-section]');
  const geenSchoonmakerSection = document.querySelector('[data-geen-schoonmaker-section]');

  if (!data.schoonmaker || !data.schoonmaker.id) {
    // Geen schoonmaker toegewezen
    if (schoonmakerSection) schoonmakerSection.style.display = 'none';
    if (geenSchoonmakerSection) geenSchoonmakerSection.style.display = 'block';
    return;
  }

  // Wel schoonmaker toegewezen
  if (schoonmakerSection) schoonmakerSection.style.display = 'block';
  if (geenSchoonmakerSection) geenSchoonmakerSection.style.display = 'none';

  const schoonmaker = data.schoonmaker;

  // Naam
  const naamEl = document.querySelector('[data-schoonmaker-naam]');
  if (naamEl) {
    naamEl.textContent = `${schoonmaker.voornaam} ${schoonmaker.achternaam}`;
  }

  // Foto
  const fotoEl = document.querySelector('[data-schoonmaker-foto]');
  if (fotoEl && schoonmaker.profielfoto) {
    fotoEl.src = schoonmaker.profielfoto;
    fotoEl.alt = `${schoonmaker.voornaam} ${schoonmaker.achternaam}`;
  }

  // Bio (optioneel)
  const bioEl = document.querySelector('[data-schoonmaker-bio]');
  if (bioEl && schoonmaker.bio) {
    bioEl.textContent = schoonmaker.bio;
    bioEl.style.display = 'block';
  } else if (bioEl) {
    bioEl.style.display = 'none';
  }

  // Contact info
  const emailEl = document.querySelector('[data-schoonmaker-email]');
  const telefoonEl = document.querySelector('[data-schoonmaker-telefoon]');

  if (emailEl && schoonmaker.email) emailEl.textContent = schoonmaker.email;
  if (telefoonEl && schoonmaker.telefoon) telefoonEl.textContent = schoonmaker.telefoon;

  // Profiel bekijken button
  const profielBtn = document.querySelector('[data-schoonmaker-profiel-btn]');
  if (profielBtn) {
    profielBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Later: Navigeer naar schoonmaker profiel pagina
      window.location.href = `/dashboard/klant/schoonmaker-profiel?id=${schoonmaker.id}&context=mijn-schoonmaker`;
    });
  }
}

/**
 * Initialiseer wijzigingen sectie (frequentie en uren wijzigen)
 */
function initializeWijzigingenSection(data) {
  const wijzigingWrapper = document.querySelector('[data-abonnementen-wijziging-form-wrapper]');
  
  // Verberg wijziging formulier als abonnement is opgezegd
  if (data.canceled_at) {
    console.log('ℹ️ [Abonnement Detail] Abonnement opgezegd - wijziging formulier verbergen');
    if (wijzigingWrapper) wijzigingWrapper.style.display = 'none';
    return;
  }
  
  // Toon wijziging formulier voor actieve abonnementen
  if (wijzigingWrapper) wijzigingWrapper.style.display = 'block';
  
  // EERST: Maak hidden input aan VOORDAT formHandler initialiseert
  const formElement = document.querySelector('[data-form-name="abb_change-form"]');
  if (!formElement) {
    console.error('[Abonnement Detail] Form element niet gevonden');
    return;
  }

  let urenInput = formElement.querySelector('input[data-field-name="uren"]');
  if (!urenInput) {
    urenInput = document.createElement('input');
    urenInput.type = 'hidden';
    urenInput.setAttribute('data-field-name', 'uren');
    urenInput.value = data.uren;
    formElement.appendChild(urenInput);
    console.log('[Abonnement Detail] Hidden uren input aangemaakt met waarde:', data.uren);
  }

  import('../logic/formHandler.js').then(({ formHandler }) => {
    import('../schemas/formSchemas.js').then(({ getFormSchema }) => {
      const schema = getFormSchema('abb_change-form');
      if (!schema) {
        console.error('[Abonnement Detail] Schema abb_change-form niet gevonden');
        return;
      }

      // Prefill data vanuit abonnement
      // Converteer uren naar number voor correcte vergelijking
      const initialData = {
        frequentie: data.frequentie,
        uren: parseFloat(data.uren)
      };

      // Custom submit action
      schema.submit = {
        action: async (formData) => {
          const authState = authClient.getAuthState();
          const response = await apiClient('/routes/dashboard/klant/update-abonnement', {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${authState.access_token}` },
            body: {
              id: data.id,
              frequentie: formData.frequentie,
              uren: formData.uren
            }
          });

          return { message: 'Abonnement succesvol bijgewerkt' };
        },
        onSuccess: () => {
          const formName = 'abb_change-form';
          formHandler.showSuccessState(formName, {
            messageAttribute: formName,
            hideForm: false,
            scrollIntoView: false
          });
          
          // Auto-hide success message after 5 seconds
          setTimeout(() => {
            const successEl = document.querySelector(`[data-success-message="${formName}"]`);
            if (successEl) successEl.style.display = 'none';
          }, 5000);

          // Reload page data om nieuwe waarden te tonen
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      };

      // Initialize form met change tracking
      formHandler.init(schema, initialData, { requireChanges: true });

      // Setup uren +/- buttons (geef urenInput door)
      setupUrenButtons(data, urenInput);
    });
  });
}

/**
 * Setup uren increment/decrement buttons
 */
function setupUrenButtons(data, urenInput) {
  const urenUpBtn = document.querySelector('[data-btn="uren_up"]');
  const urenDownBtn = document.querySelector('[data-btn="uren_down"]');
  const urenDisplay = document.querySelector('[data-field-total="calculate_form_abb_uren"]');
  const minUrenDisplay = document.querySelector('[data-abo-adres="min-uren"]');
  const urenError = document.querySelector('[data-error-for="uren"]');

  if (!urenUpBtn || !urenDownBtn || !urenDisplay || !urenInput) {
    console.warn('[Abonnement Detail] Uren buttons, display of input niet gevonden');
    return;
  }

  // Set initial values
  let currentUren = parseFloat(data.uren) || 3;
  const minimumUren = parseFloat(data.minimum_uren) || 3;

  urenDisplay.textContent = formatUren(currentUren);
  if (minUrenDisplay) minUrenDisplay.textContent = formatUren(minimumUren);

  // Set initial prijs
  const prijsDisplay = document.querySelector('[data-field-total="calculate_form_abb_prijs"]');
  if (prijsDisplay && data.prijs_per_sessie_cents) {
    const initieleprijs = data.prijs_per_sessie_cents / 100;
    prijsDisplay.textContent = initieleprijs.toFixed(2).replace('.', ',');
  }

  // Clear any existing errors
  if (urenError) {
    urenError.style.display = 'none';
  }

  // Bereken en update prijs
  const updatePrijsDisplay = (uren) => {
    const prijsDisplay = document.querySelector('[data-field-total="calculate_form_abb_prijs"]');
    if (!prijsDisplay || !data.prijs_per_sessie_cents) return;

    // Bereken prijs per uur
    const prijsPerUur = data.prijs_per_sessie_cents / (parseFloat(data.uren) || 1);
    const nieuwePrijs = (uren * prijsPerUur) / 100;
    
    prijsDisplay.textContent = nieuwePrijs.toFixed(2).replace('.', ',');
  };

  // Update hidden input voor formHandler
  const updateHiddenInput = (value) => {
    console.log('[Uren Button] Updating uren to:', value, 'type:', typeof value);
    
    // Update hidden input value
    urenInput.value = value;
    
    // Trigger change event voor formHandler
    const event = new Event('change', { bubbles: true });
    urenInput.dispatchEvent(event);
    
    import('../logic/formHandler.js').then(({ formHandler }) => {
      formHandler.runWithFormContext('abb_change-form', () => {
        console.log('[Uren Button] Before update - formData.uren:', formHandler.formData.uren, 'originalData.uren:', formHandler.originalData?.uren);
        
        // Store als number voor correcte vergelijking
        formHandler.formData.uren = value;
        
        console.log('[Uren Button] After update - formData.uren:', formHandler.formData.uren, 'originalData.uren:', formHandler.originalData?.uren);
        console.log('[Uren Button] Has changes?', formHandler._hasChanges());
        
        formHandler.updateSubmitState();
      });
    });
    
    // Update prijs display
    updatePrijsDisplay(value);
  };

  // Increment button
  urenUpBtn.addEventListener('click', (e) => {
    e.preventDefault();
    currentUren += 0.5;
    urenDisplay.textContent = formatUren(currentUren);
    
    // Clear error if present
    if (urenError) {
      urenError.style.display = 'none';
    }

    updateHiddenInput(currentUren);
  });

  // Decrement button
  urenDownBtn.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Check minimum
    if (currentUren - 0.5 < minimumUren) {
      // Show error
      if (urenError) {
        urenError.textContent = `Het minimum aantal uren is ${formatUren(minimumUren)} uur`;
        urenError.style.display = 'block';
      }
      return;
    }

    currentUren -= 0.5;
    urenDisplay.textContent = formatUren(currentUren);
    
    // Clear error
    if (urenError) {
      urenError.style.display = 'none';
    }

    updateHiddenInput(currentUren);
  });
}

/**
 * Formatteer uren voor display (zonder .0)
 */
function formatUren(uren) {
  if (typeof uren !== 'number' || isNaN(uren)) {
    return '0';
  }
  const normalized = Math.round((uren + Number.EPSILON) * 2) / 2;
  const formatted = normalized % 1 === 0 ? normalized.toFixed(0) : normalized.toFixed(1);
  return formatted.replace('.0', '');
}

/**
 * Initialiseer opzeggen sectie
 */
async function initializeOpzeggenSection(data) {
  console.log('🚫 [Abonnement Detail] Initialiseren opzeg sectie...');

  const actiefState = document.querySelector('[data-abonnementen-opzeg-state="is-actief"]');
  const opgezegtState = document.querySelector('[data-abonnementen-opzeg-state="is-opgezegd"]');
  
  // Check of abonnement al is opgezegd
  if (data.canceled_at) {
    console.log('ℹ️ [Abonnement Detail] Abonnement is al opgezegd:', data.canceled_at);
    
    // Toggle states
    if (actiefState) actiefState.style.display = 'none';
    if (opgezegtState) opgezegtState.style.display = 'block';
    
    // Vul opzeg informatie in
    const opzegInfo = document.querySelector('[data-opzeg-info]');
    if (opzegInfo) {
      const datum = new Date(data.canceled_at);
      const dag = String(datum.getDate()).padStart(2, '0');
      const maand = String(datum.getMonth() + 1).padStart(2, '0');
      const jaar = datum.getFullYear();
      const datumStr = `${dag}-${maand}-${jaar}`;
      
      let html = `<strong>Opzegdatum:</strong> ${datumStr}`;
      if (data.cancellation_reason) {
        html += `<br><strong>Reden:</strong> ${data.cancellation_reason}`;
      }
      
      opzegInfo.innerHTML = html;
    }
    
    return;
  }

  // Abonnement is actief - toon formulier
  if (actiefState) actiefState.style.display = 'block';
  if (opgezegtState) opgezegtState.style.display = 'none';

  const formElement = document.querySelector('[data-form-name="abb_opzeg-form"]');
  if (!formElement) {
    console.warn('⚠️ [Abonnement Detail] Opzeg formulier niet gevonden in DOM');
    return;
  }

  // Lazy load formHandler en dependencies
  const [
    { formHandler },
    { getFormSchema },
    { initWeekSelectTrigger }
  ] = await Promise.all([
    import('../logic/formHandler.js'),
    import('../schemas/formSchemas.js'),
    import('../logic/formTriggers.js')
  ]);

  const schema = getFormSchema('abb_opzeg-form');
  if (!schema) {
    console.error('❌ [Abonnement Detail] Schema voor abb_opzeg-form niet gevonden');
    return;
  }

  // Custom submit action
  schema.submit = {
    action: async (formData) => {
      console.log('📤 [Abonnement Detail] Submitting opzegging...', formData);

      // Haal jaar op uit hidden dataset attribuut (gezet door initWeekSelectTrigger)
      const weekInput = formElement.querySelector('[data-field-name="opzeg_weeknr"]');
      const opzeg_jaar = weekInput?.dataset.weekYear || new Date().getFullYear();

      const authState = authClient.getAuthState();
      const response = await apiClient('/routes/dashboard/klant/opzeg-abonnement', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: {
          id: data.id,
          opzeg_weeknr: formData.opzeg_weeknr,
          opzeg_jaar: opzeg_jaar,
          opzeg_reden: formData.opzeg_reden || ''
        }
      });

      console.log('✅ [Abonnement Detail] Opzegging succesvol:', response);
      return { message: 'Abonnement succesvol opgezegd' };
    },
    onSuccess: () => {
      const formName = 'abb_opzeg-form';
      formHandler.showSuccessState(formName, {
        messageAttribute: formName,
        hideForm: false,
        scrollIntoView: false
      });
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        const successEl = document.querySelector(`[data-success-message="${formName}"]`);
        if (successEl) successEl.style.display = 'none';
      }, 5000);

      // Reload page na 2 seconden om nieuwe status te tonen
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };

  // Initialize formHandler
  formHandler.init(schema);

  // Initialiseer week selector met 2 weken termijn en 26 weken vooruit
  initWeekSelectTrigger(formHandler, {
    weekField: 'opzeg_weeknr',
    infoField: 'opzeg_weeknr',
    maxWeeks: 26 // Half jaar vooruit is voldoende voor opzegging
  });

  console.log('✅ [Abonnement Detail] Opzeg formulier geïnitialiseerd');
}

/**
 * Initialiseer pauze sectie
 */
async function initializePauzeSection(data) {
  console.log('⏸️ [Abonnement Detail] Initialiseren pauze sectie...');

  // Lazy load de pauze form module
  try {
    const { initAbonnementPauzeForm } = await import('./abonnementPauzeForm.js');
    await initAbonnementPauzeForm(data);
  } catch (error) {
    console.error('❌ [Abonnement Detail] Fout bij initialiseren pauze formulier:', error);
  }
}

/**
 * Initialiseer abonnement detail pagina
 */
export async function initAbonnementDetail() {
  console.log('📋 [Abonnement Detail] Initialiseren...');

  // Hide alle success messages bij laden
  hideAllSuccessMessages();

  // ⚠️ BELANGRIJK: Check authenticatie EERST voordat we iets doen
  // Dit voorkomt race conditions tijdens redirect
  const authState = authClient.getAuthState();
  if (!authState || !authState.access_token) {
    console.warn('⚠️ [Abonnement Detail] Geen authenticatie, stoppen met initialisatie');
    return; // Stop direct, laat dashboardAuth.js de redirect afhandelen
  }

  // Zet content direct op display none
  const contentState = document.querySelector('[data-content-state]');
  if (contentState) contentState.style.display = 'none';

  // Toon loading state
  showLoading();

  try {
    // Get abonnement ID from URL
    const params = new URLSearchParams(window.location.search);
    const abonnementId = params.get('id');

    if (!abonnementId) {
      showError('Geen abonnement ID gevonden in URL.');
      return;
    }

    // Store for SEPA setup flow
    currentAbonnementId = abonnementId;

    // Haal abonnement data op
    console.log('🔄 [Abonnement Detail] Fetching data...', { abonnementId });
    const data = await apiClient(`/routes/dashboard/klant/abonnement-detail?id=${abonnementId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    console.log('✅ [Abonnement Detail] Data opgehaald:', data);

    // Store email for SEPA setup
    currentUserEmail = data.klant?.email || '';

    // Vul pagina in
    populateAbonnementHeader(data);
    populateSchoonmakerSection(data);
    populateFacturen(data.facturen || []);
    populateSepaSection(data.sepa || {});
    
    // Initialize placeholder sections (later implementeren)
    initializeWijzigingenSection(data);
    initializePauzeSection(data);
    initializeOpzeggenSection(data);

    console.log('✅ [Abonnement Detail] Initialisatie voltooid');
    
    // Verberg loading, toon content
    hideLoading();

  } catch (error) {
    console.error('❌ [Abonnement Detail] Fout bij ophalen data:', error);
    showError('Er ging iets mis bij het laden van het abonnement. Probeer het opnieuw.');
  }
}
