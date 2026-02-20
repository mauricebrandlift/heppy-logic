// public/forms/dashboardSchoonmaker/eenmaligeAangenomenInit.js
/**
 * Eenmalige aangenomen opdrachten overview initialisatie voor schoonmakers
 * Toont alle eenmalige opdrachten die de schoonmaker heeft aangenomen
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';

/**
 * Formatteer type schoonmaak voor weergave
 */
function formatTypeSchoonmaak(type) {
  const mapping = {
    'dieptereiniging': 'Dieptereiniging',
    'verhuis': 'Verhuisschoonmaak',
    'tapijt': 'Tapijtreiniging',
    'bankreiniging': 'Bankreiniging',
    'vloer': 'Vloerreiniging'
  };
  return mapping[type] || type;
}

/**
 * Formatteer opdracht status voor weergave
 */
function formatStatus(status) {
  const mapping = {
    'aangevraagd': 'Aangevraagd',
    'gepland': 'Gepland',
    'voltooid': 'Voltooid',
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
    'aangevraagd': 'is-pending',
    'gepland': 'is-active',
    'voltooid': 'is-done',
    'geannuleerd': 'is-unactive'
  };
  
  const statusClass = statusClassMap[status] || 'is-pending';
  element.classList.add(statusClass);
}

/**
 * Formatteer datum naar "dag, maand, jaar" format
 */
function formatGewensteDatum(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day}, ${month}, ${year}`;
}

/**
 * Formatteer adres naar string
 */
function formatAdres(adres) {
  if (!adres) return '-';
  const delen = [
    adres.straat,
    adres.huisnummer,
    adres.toevoeging
  ].filter(Boolean).join(' ');
  
  const postcodePlaats = [adres.postcode, adres.plaats].filter(Boolean).join(' ');
  
  return `${delen}, ${postcodePlaats}`;
}

/**
 * Populeer aangenomen opdrachten sectie
 */
function populateOpdrachten(opdrachten) {
  const containerWithItems = document.querySelector('[data-opdracht-state="heeft-items"]');
  const containerNoItems = document.querySelector('[data-opdracht-state="geen-items"]');
  const template = document.querySelector('[data-opdracht-item][data-opdracht-item-id]');

  if (!containerWithItems || !containerNoItems || !template) {
    console.error('[Schoonmaker Eenmalige Aangenomen] Opdrachten containers of template niet gevonden');
    return;
  }

  // Toggle states
  if (opdrachten.length === 0) {
    containerWithItems.style.display = 'none';
    containerNoItems.style.display = 'block';
    template.style.display = 'none';
    return;
  }

  containerWithItems.style.display = 'block';
  containerNoItems.style.display = 'none';

  // Clear bestaande items (behalve template)
  const parent = template.parentElement;
  const existingItems = parent.querySelectorAll('[data-opdracht-item]:not([data-opdracht-item-id=""])');
  existingItems.forEach(item => item.remove());

  // Render opdrachten
  opdrachten.forEach(opdracht => {
    const clone = template.cloneNode(true);
    clone.setAttribute('data-opdracht-item-id', opdracht.match_id);
    
    // Verwijder template class
    clone.classList.remove('opdracht-item-template');

    // === TITEL (type schoonmaak) ===
    const titelEl = clone.querySelector('[data-es-titel]');
    if (titelEl) {
      titelEl.textContent = formatTypeSchoonmaak(opdracht.type);
    }

    // === KLANT NAAM ===
    const klantNaamEl = clone.querySelector('[data-es-klant-naam]');
    if (klantNaamEl && opdracht.klant) {
      klantNaamEl.textContent = `${opdracht.klant.voornaam} ${opdracht.klant.achternaam}`;
    }

    // === ADRES ===
    const adresEl = clone.querySelector('[data-es-adres]');
    if (adresEl) {
      adresEl.textContent = formatAdres(opdracht.adres);
    }

    // === UREN ===
    const urenEl = clone.querySelector('[data-es-uren]');
    if (urenEl) {
      urenEl.textContent = opdracht.uren ? `${opdracht.uren} uur` : '-';
    }

    // === DATUM ===
    const datumEl = clone.querySelector('[data-es-datum]');
    if (datumEl) {
      datumEl.textContent = formatGewensteDatum(opdracht.gewenste_datum);
    }

    // === STATUS ===
    const statusEl = clone.querySelector('[data-es-status]');
    if (statusEl) {
      statusEl.textContent = formatStatus(opdracht.status);
      addStatusClass(statusEl, opdracht.status);
    }

    // === DETAIL BUTTON ===
    const detailBtn = clone.querySelector('[data-es-detail-btn]');
    if (detailBtn) {
      detailBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = `/dashboard/schoonmaker/eenmalige-schoonmaak?id=${opdracht.match_id}`;
      });
    }

    parent.appendChild(clone);
  });
  
  // Hide template na renderen
  template.style.display = 'none';
}

/**
 * Toggle loading state
 */
function setLoadingState(isLoading) {
  const loadingEl = document.querySelector('[data-loading-state]');
  const contentEl = document.querySelector('[data-content-state]');
  
  if (loadingEl) {
    loadingEl.style.display = isLoading ? 'block' : 'none';
  }
  if (contentEl) {
    contentEl.style.display = isLoading ? 'none' : 'block';
  }
}

/**
 * Toon error message
 */
function showError(message) {
  const errorEl = document.querySelector('[data-error-state]');
  const errorMessageEl = document.querySelector('[data-error-message]');
  
  if (errorEl) {
    errorEl.style.display = 'block';
  }
  if (errorMessageEl) {
    errorMessageEl.textContent = message || 'Er ging iets mis bij het laden van je opdrachten.';
  }
  
  setLoadingState(false);
}

/**
 * Initialiseer aangenomen opdrachten overview
 */
export async function initEenmaligeAangenomen() {
  console.log('🔧 [Schoonmaker Eenmalige Aangenomen] Initializing...');

  // Check of we op overview pagina zijn
  const overviewPage = document.querySelector('[data-dashboard-page="overview"]');
  if (!overviewPage) {
    console.log('[Schoonmaker Eenmalige Aangenomen] Niet op overview pagina, skip init');
    return;
  }

  // ⚠️ BELANGRIJK: Check authenticatie EERST
  const authState = authClient.getAuthState();
  if (!authState || !authState.access_token) {
    console.warn('⚠️ [Schoonmaker Eenmalige Aangenomen] Geen authenticatie, stoppen met initialisatie');
    return;
  }

  // Check auth
  const user = await authClient.getCurrentUser();
  if (!user) {
    console.error('[Schoonmaker Eenmalige Aangenomen] Geen gebruiker ingelogd');
    showError('Je bent niet ingelogd. Log opnieuw in.');
    return;
  }

  if (user.rol !== 'schoonmaker') {
    console.error('[Schoonmaker Eenmalige Aangenomen] User is geen schoonmaker:', user.rol);
    showError('Je hebt geen toegang tot dit dashboard.');
    return;
  }

  try {
    // Toon loading state
    setLoadingState(true);

    // === HAAL AANGENOMEN OPDRACHTEN OP ===
    console.log('🔄 [Schoonmaker Eenmalige Aangenomen] Fetching aangenomen opdrachten...');
    
    const response = await apiClient('/routes/dashboard/schoonmaker/eenmalige-aangenomen', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    if (!response.success) {
      throw new Error(response.error || 'Kon opdrachten niet ophalen');
    }

    const opdrachten = response.data || [];
    console.log(`✅ [Schoonmaker Eenmalige Aangenomen] Loaded ${opdrachten.length} aangenomen opdrachten`);

    // === POPULEER UI ===
    populateOpdrachten(opdrachten);

    // Hide loading
    setLoadingState(false);

    console.log('✅ [Schoonmaker Eenmalige Aangenomen] Initialisatie voltooid');

  } catch (error) {
    console.error('❌ [Schoonmaker Eenmalige Aangenomen] Error:', error);
    showError(error.message);
  }
}
