// public/forms/dashboardKlant/facturenInit.js
/**
 * Dashboard Facturen Overzicht initialisatie voor klanten
 * Toont alle facturen van webshop, abonnementen en opdrachten
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';

/**
 * Formatteer datum naar NL formaat (kort)
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
 * Formatteer maand en jaar uit datum
 */
function formatMaandJaar(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('nl-NL', { 
    month: 'long', 
    year: 'numeric' 
  });
}

/**
 * Formatteer bedrag in centen naar euros (alleen getal, geen €)
 */
function formatBedrag(cents) {
  if (!cents && cents !== 0) return '0,00';
  return (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * Bepaal factuur type display naam
 */
function getFactuurTypeName(factuur) {
  if (factuur.bestel_nummer) return 'Webshop';
  if (factuur.abonnement_id) return 'Abonnement';
  if (factuur.opdracht_id) return 'Eenmalige schoonmaak';
  return 'Betaling';
}

/**
 * Formatteer status voor weergave
 */
function formatStatus(status) {
  const mapping = {
    'paid': 'Betaald',
    'open': 'Open',
    'draft': 'Concept',
    'void': 'Geannuleerd',
    'uncollectible': 'Oninbaar',
    'betaald': 'Betaald',
    'openstaand': 'Open'
  };
  return mapping[status] || status;
}

/**
 * Voeg status class toe aan element
 */
function addStatusClass(element, status) {
  if (!element) return;
  
  const statusClassMap = {
    'paid': 'is-active',
    'betaald': 'is-active',
    'open': 'is-pending',
    'openstaand': 'is-pending',
    'draft': 'is-pending',
    'void': 'is-unactive',
    'uncollectible': 'is-unactive'
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
  const containerWithItems = document.querySelector('[data-facturen-state="heeft-items"]');
  const containerNoItems = document.querySelector('[data-facturen-state="geen-items"]');
  
  if (containerWithItems) containerWithItems.style.display = 'none';
  if (containerNoItems) containerNoItems.style.display = 'block';
}

/**
 * Render facturen list
 */
function renderFacturenList(facturen) {
  const template = document.querySelector('[data-factuur-item]');

  if (!template) {
    console.error('[Facturen] Template niet gevonden');
    return;
  }

  const parent = template.parentElement;
  
  // Clear bestaande items (behalve template met lege ID)
  const existingItems = parent.querySelectorAll('[data-factuur-item]:not([data-factuur-item=""])');
  existingItems.forEach(item => item.remove());

  // Render elke factuur
  facturen.forEach(factuur => {
    const clone = template.cloneNode(true);
    clone.setAttribute('data-factuur-item', factuur.id);
    clone.style.display = '';

    // Bepaal type voor conditional rendering
    const isAbonnement = !!factuur.abonnement_id;
    const isEenmalig = !!factuur.opdracht_id;
    const isWebshop = !!factuur.bestel_nummer;

    // Factuurnummer (format: FAC-{jaar}-{id})
    const nummerEl = clone.querySelector('[data-factuur-nummer]');
    if (nummerEl) {
      const jaar = new Date(factuur.aangemaakt_op).getFullYear();
      nummerEl.textContent = `FAC-${jaar}-${String(factuur.id).padStart(4, '0')}`;
    }

    // Type naam
    const typeEl = clone.querySelector('[data-factuur-type]');
    if (typeEl) typeEl.textContent = getFactuurTypeName(factuur);

    // Periode/Datum title en waarde (conditioneel)
    const periodeTitle = clone.querySelector('[data-factuur-periode-title]');
    const periodeDatum = clone.querySelector('[data-factuur-periode-datum]');

    if (isAbonnement) {
      // Abonnement: toon periode
      if (periodeTitle) periodeTitle.textContent = 'Periode';
      if (periodeDatum) {
        // Gebruik periode_display van API (bijv. "2 feb - 2 mrt 2026")
        periodeDatum.textContent = factuur.periode_display || formatMaandJaar(factuur.aangemaakt_op);
      }
    } else {
      // Eenmalig of Webshop: toon datum
      if (periodeTitle) {
        periodeTitle.textContent = isWebshop ? 'Besteldatum' : 'Datum';
      }
      if (periodeDatum) {
        periodeDatum.textContent = formatDatum(factuur.aangemaakt_op);
      }
    }

    // Details (type-specifiek)
    const detailsEl = clone.querySelector('[data-factuur-details]');
    if (detailsEl) {
      if (isAbonnement) {
        // TODO: Als we frequentie + uren hebben, toon die
        detailsEl.textContent = 'Schoonmaakabonnement';
      } else if (isEenmalig) {
        // TODO: Als we opdracht type + uren hebben, toon die
        detailsEl.textContent = 'Eenmalige schoonmaak';
      } else if (isWebshop) {
        // TODO: Als we aantal producten hebben, toon die
        detailsEl.textContent = `Bestelling ${factuur.bestel_nummer}`;
      }
    }

    // Bedrag (alleen getal, € staat al in HTML)
    const bedragEl = clone.querySelector('[data-factuur-bedrag]');
    if (bedragEl) bedragEl.textContent = formatBedrag(factuur.amount_cents);

    // Status
    const statusEl = clone.querySelector('[data-factuur-status]');
    if (statusEl) {
      const statusText = statusEl.querySelector('.text-size-small');
      if (statusText) statusText.textContent = formatStatus(factuur.status);
      addStatusClass(statusEl, factuur.status);
    }

    // Download button (binnen dropdown wrapper)
    const buttonEl = clone.querySelector('[data-invoice-button]');
    if (buttonEl && factuur.invoice_url) {
      // Direct link naar Receipt/Invoice PDF
      buttonEl.style.display = ''; // Maak button zichtbaar
      
      // Voeg click handler toe
      buttonEl.addEventListener('click', (e) => {
        e.preventDefault();
        window.open(factuur.invoice_url, '_blank');
      });
      
      // Maak ook de dropdown wrapper zichtbaar
      const dropdownWrapper = buttonEl.closest('.w-dropdown');
      if (dropdownWrapper) {
        dropdownWrapper.style.display = '';
      }
    } else if (buttonEl) {
      // Geen invoice URL: verberg button en dropdown
      buttonEl.style.display = 'none';
      const dropdownWrapper = buttonEl.closest('.w-dropdown');
      if (dropdownWrapper) {
        dropdownWrapper.style.display = 'none';
      }
    }

    parent.appendChild(clone);
  });

  // Hide template
  template.style.display = 'none';

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

  // Zet initial states (verberg alles behalve loading)
  const containerWithItems = document.querySelector('[data-facturen-state="heeft-items"]');
  const containerNoItems = document.querySelector('[data-facturen-state="geen-items"]');
  if (containerWithItems) containerWithItems.style.display = 'none';
  if (containerNoItems) containerNoItems.style.display = 'none';

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
      // Toon container met items, verberg empty state
      const containerWithItems = document.querySelector('[data-facturen-state="heeft-items"]');
      const containerNoItems = document.querySelector('[data-facturen-state="geen-items"]');
      
      if (containerWithItems) containerWithItems.style.display = 'block';
      if (containerNoItems) containerNoItems.style.display = 'none';
      
      renderFacturenList(facturen);
      
      // Buttons hebben directe links (invoice_url) - geen initInvoiceButton() nodig
    }

    console.log('✅ [Facturen] Initialisatie voltooid');
    hideLoading();

  } catch (error) {
    console.error('❌ [Facturen] Fout bij initialisatie:', error);
    showError('Er ging iets mis bij het laden van je facturen. Probeer het opnieuw.');
  }
}
