// public/forms/dashboardKlant/bestellingDetailInit.js
/**
 * Dashboard Bestelling Detail initialisatie voor klanten
 * Haalt bestelling details op en toont op de pagina
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
 * Formatteer bedrag in centen naar euros (met euro teken)
 */
function formatBedrag(cents) {
  if (!cents && cents !== 0) return '-';
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

/**
 * Formatteer status voor weergave
 */
function formatStatus(status) {
  const mapping = {
    'nieuw': 'In behandeling',
    'verwerkt': 'Verwerkt',
    'verzonden': 'Verzonden',
    'afgeleverd': 'Afgeleverd',
    'geannuleerd': 'Geannuleerd'
  };
  return mapping[status] || status;
}

/**
 * Voeg status class toe aan element
 */
function addStatusClass(element, status) {
  if (!element) return;
  
  const statusClassMap = {
    'verzonden': 'is-active',
    'afgeleverd': 'is-active',
    'nieuw': 'is-pending',
    'verwerkt': 'is-pending',
    'geannuleerd': 'is-unactive'
  };
  
  const statusClass = statusClassMap[status] || 'is-pending';
  element.classList.add(statusClass);
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
 * Vul bestelling details in
 */
function populateBestellingDetails(data) {
  // Header info
  const nummerEl = document.querySelector('[data-bestelling-nummer]');
  const datumEl = document.querySelector('[data-bestelling-datum]');
  const statusEl = document.querySelector('[data-bestelling-status]');
  const totaalEl = document.querySelector('[data-bestelling-totaal]');

  if (nummerEl) nummerEl.textContent = data.bestel_nummer || '-';
  if (datumEl) datumEl.textContent = formatDatum(data.aangemaakt_op);
  if (statusEl) {
    statusEl.textContent = formatStatus(data.status);
    addStatusClass(statusEl, data.status);
  }
  if (totaalEl) totaalEl.textContent = formatBedrag(data.totaal_cents);

  // Bezorgadres
  const naamEl = document.querySelector('[data-bezorg-naam]');
  const adresEl = document.querySelector('[data-bezorg-adres]');
  const postcodeEl = document.querySelector('[data-bezorg-postcode-plaats]');

  if (naamEl) naamEl.textContent = data.bezorg_naam || '-';
  if (adresEl) {
    const adres = `${data.bezorg_straat} ${data.bezorg_huisnummer}${data.bezorg_toevoeging ? ' ' + data.bezorg_toevoeging : ''}`;
    adresEl.textContent = adres;
  }
  if (postcodeEl) {
    postcodeEl.textContent = `${data.bezorg_postcode} ${data.bezorg_plaats}`;
  }

  // Betaling details
  const subtotaalEl = document.querySelector('[data-betaling-subtotaal]');
  const verzendkostenEl = document.querySelector('[data-betaling-verzendkosten]');
  const totaalBetalingEl = document.querySelector('[data-betaling-totaal]');
  const btwEl = document.querySelector('[data-betaling-btw]');

  if (subtotaalEl) subtotaalEl.textContent = formatBedrag(data.subtotaal_cents);
  if (verzendkostenEl) verzendkostenEl.textContent = formatBedrag(data.verzendkosten_cents);
  if (totaalBetalingEl) totaalBetalingEl.textContent = formatBedrag(data.totaal_cents);
  if (btwEl) btwEl.textContent = formatBedrag(data.btw_cents);
}

/**
 * Render product items
 */
function populateProductItems(items) {
  const container = document.querySelector('[data-order-items-container]');
  const template = document.querySelector('[data-order-item-template]');

  if (!container || !template) {
    console.error('[Bestelling Detail] Items container of template niet gevonden');
    return;
  }

  // Clear bestaande items (behalve template)
  const existingItems = Array.from(container.children).filter(
    child => !child.hasAttribute('data-order-item-template')
  );
  existingItems.forEach(item => item.remove());

  // Render items
  items.forEach(item => {
    const clone = template.cloneNode(true);
    clone.removeAttribute('data-order-item-template');
    clone.classList.remove('cart_product-item-template');
    clone.style.display = '';

    // Set product image
    const imageEl = clone.querySelector('[data-order-item-image]');
    if (imageEl && item.product_afbeelding_url) {
      imageEl.src = item.product_afbeelding_url;
      imageEl.alt = item.product_naam;
    }

    // Set item details
    const nameEl = clone.querySelector('[data-order-item-name]');
    const priceEl = clone.querySelector('[data-order-item-price]');
    const quantityEl = clone.querySelector('[data-order-item-quantity]');

    if (nameEl) nameEl.textContent = item.product_naam;
    if (priceEl) priceEl.textContent = (item.prijs_per_stuk_cents / 100).toFixed(2).replace('.', ',');
    if (quantityEl) quantityEl.textContent = item.aantal;

    container.appendChild(clone);
  });

  console.log(`✅ [Bestelling Detail] ${items.length} producten gerenderd`);
}

/**
 * Initialiseer factuur button (indien beschikbaar)
 */
function initializeInvoiceButton(bestellingData) {
  const invoiceButton = document.querySelector('[data-invoice-button]');
  
  if (!invoiceButton) {
    console.log('[Bestelling Detail] Geen factuur button gevonden op pagina');
    return;
  }

  const invoiceId = bestellingData.stripe_invoice_id;

  if (!invoiceId) {
    // Geen factuur beschikbaar - verberg button
    console.log('[Bestelling Detail] Geen factuur beschikbaar voor deze bestelling');
    invoiceButton.style.display = 'none';
    return;
  }

  // Vul invoice ID in als data attribuut
  invoiceButton.dataset.invoiceId = invoiceId;
  invoiceButton.style.display = ''; // Zorg dat button zichtbaar is

  // Initialiseer button functionaliteit
  initInvoiceButton();

  console.log(`✅ [Bestelling Detail] Factuur button geïnitialiseerd (${invoiceId})`);
}

/**
 * Initialiseer bestelling detail pagina
 */
export async function initBestellingDetail() {
  console.log('📦 [Bestelling Detail] Initialiseren...');

  // ⚠️ BELANGRIJK: Check authenticatie EERST voordat we iets doen
  // Dit voorkomt race conditions tijdens redirect
  const authState = authClient.getAuthState();
  if (!authState || !authState.access_token) {
    console.warn('⚠️ [Bestelling Detail] Geen authenticatie, stoppen met initialisatie');
    return; // Stop direct, laat dashboardAuth.js de redirect afhandelen
  }

  // Zet content direct op display none
  const contentState = document.querySelector('[data-content-state]');
  if (contentState) contentState.style.display = 'none';

  // Toon loading state
  showLoading();

  try {
    // Get bestelling ID from URL
    const params = new URLSearchParams(window.location.search);
    const bestellingId = params.get('id');

    if (!bestellingId) {
      showError('Geen bestelling ID gevonden in URL.');
      return;
    }

    // Haal bestelling data op
    console.log('🔄 [Bestelling Detail] Fetching data...', { bestellingId });
    const data = await apiClient(`/routes/dashboard/klant/bestelling-detail?id=${bestellingId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    console.log('✅ [Bestelling Detail] Data opgehaald:', data);

    // Vul pagina in
    populateBestellingDetails(data);
    
    if (data.items && data.items.length > 0) {
      populateProductItems(data.items);
    }

    // Initialiseer factuur button (indien beschikbaar)
    initializeInvoiceButton(data);

    console.log('✅ [Bestelling Detail] Initialisatie voltooid');
    
    // Verberg loading, toon content
    hideLoading();

  } catch (error) {
    console.error('❌ [Bestelling Detail] Fout bij ophalen data:', error);
    showError('Er ging iets mis bij het laden van de bestelling. Probeer het opnieuw.');
  }
}
