// public/forms/dashboardKlant/facturenInit.js
/**
 * Dashboard Facturen Overzicht initialisatie voor klanten
 * Toont alle facturen van webshop, abonnementen en opdrachten
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';
import { initInvoiceButton } from '../../utils/invoiceHelper.js';

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
 * Formatteer bedrag in centen naar euros
 */
function formatBedrag(cents) {
  if (!cents && cents !== 0) return '€0,00';
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR'
  }).format(cents / 100);
}

/**
 * Bepaal factuur type op basis van data
 */
function getFactuurType(factuur) {
  if (factuur.bestel_nummer) return 'Webshop';
  if (factuur.abonnement_id) return 'Abonnement';
  if (factuur.opdracht_id) return 'Eenmalige opdracht';
  return 'Onbekend';
}

/**
 * Haal factuur beschrijving op
 */
function getFactuurBeschrijving(factuur) {
  if (factuur.bestel_nummer) {
    return `Bestelling ${factuur.bestel_nummer}`;
  }
  if (factuur.abonnement_id) {
    return `Abonnement betaling`;
  }
  if (factuur.opdracht_id) {
    return `Eenmalige opdracht`;
  }
  return 'Betaling';
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
  
  if (loadingState) loadingState.style.display = 'none';
  if (contentState) contentState.style.display = 'none';
  
  if (errorContainer) {
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
  }
}

/**
 * Toon empty state wanneer geen facturen
 */
function showEmptyState() {
  const container = document.querySelector('[data-facturen-list]');
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state" style="text-align: center; padding: 3rem 1rem;">
      <p style="font-size: 1.125rem; color: #6B7280; margin-bottom: 0.5rem;">
        Je hebt nog geen facturen
      </p>
      <p style="font-size: 0.875rem; color: #9CA3AF;">
        Facturen van je bestellingen en abonnementen verschijnen hier.
      </p>
    </div>
  `;
}

/**
 * Render facturen list
 */
function renderFacturenList(facturen) {
  const container = document.querySelector('[data-facturen-list]');
  const template = document.querySelector('[data-factuur-item-template]');

  if (!container) {
    console.error('[Facturen] Container niet gevonden');
    return;
  }

  if (!template) {
    console.error('[Facturen] Template niet gevonden');
    return;
  }

  // Clear bestaande items (behalve template)
  const existingItems = Array.from(container.children).filter(
    child => !child.hasAttribute('data-factuur-item-template')
  );
  existingItems.forEach(item => item.remove());

  // Render elke factuur
  facturen.forEach(factuur => {
    const clone = template.cloneNode(true);
    clone.removeAttribute('data-factuur-item-template');
    clone.style.display = '';

    // Vul factuur details
    const datumEl = clone.querySelector('[data-factuur-datum]');
    const beschrijvingEl = clone.querySelector('[data-factuur-beschrijving]');
    const bedragEl = clone.querySelector('[data-factuur-bedrag]');
    const buttonEl = clone.querySelector('[data-invoice-button]');

    if (datumEl) datumEl.textContent = formatDatum(factuur.aangemaakt_op);
    if (beschrijvingEl) beschrijvingEl.textContent = getFactuurBeschrijving(factuur);
    if (bedragEl) bedragEl.textContent = formatBedrag(factuur.amount_cents);

    // Vul invoice button data
    if (buttonEl && factuur.stripe_invoice_id) {
      buttonEl.dataset.invoiceId = factuur.stripe_invoice_id;
      buttonEl.style.display = '';
    } else if (buttonEl) {
      buttonEl.style.display = 'none';
    }

    container.appendChild(clone);
  });

  console.log(`✅ [Facturen] ${facturen.length} facturen gerenderd`);
}

/**
 * Haal alle facturen op voor ingelogde klant
 */
async function fetchFacturen(accessToken) {
  try {
    // Haal facturen op via API
    // Dit combineert bestellingen en betalingen met invoice_id
    const data = await apiClient('/routes/dashboard/klant/facturen', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return data.facturen || [];

  } catch (error) {
    console.error('[Facturen] Fout bij ophalen facturen:', error);
    throw error;
  }
}

/**
 * Initialiseer facturen overzicht pagina
 */
export async function initFacturenOverzicht() {
  console.log('📄 [Facturen] Initialiseren...');

  // ⚠️ BELANGRIJK: Check authenticatie EERST voordat we iets doen
  // Dit voorkomt race conditions tijdens redirect
  const authState = authClient.getAuthState();
  if (!authState || !authState.access_token) {
    console.warn('⚠️ [Facturen] Geen authenticatie, stoppen met initialisatie');
    return; // Stop direct, laat dashboardAuth.js de redirect afhandelen
  }

  // Verberg content, toon loading
  showLoading();

  try {

    // Haal facturen op
    console.log('🔄 [Facturen] Fetching data...');
    const facturen = await fetchFacturen(authState.access_token);

    console.log(`✅ [Facturen] ${facturen.length} facturen opgehaald`);

    if (facturen.length === 0) {
      showEmptyState();
    } else {
      renderFacturenList(facturen);
      
      // Initialiseer alle invoice buttons
      initInvoiceButton();
    }

    console.log('✅ [Facturen] Initialisatie voltooid');
    hideLoading();

  } catch (error) {
    console.error('❌ [Facturen] Fout bij initialisatie:', error);
    showError('Er ging iets mis bij het laden van je facturen. Probeer het opnieuw.');
  }
}
