// public/forms/dashboardKlant/overviewInit.js
/**
 * Dashboard Overview initialisatie voor klanten
 * Haalt alle dashboard data op en populateert de DOM
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';

/**
 * Formatteer frequentie voor weergave
 */
function formatFrequentie(frequentie) {
  const mapping = {
    'perweek': '1x per week',
    'pertweeweek': '1x per 2 weken',
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
    'aangevraagd': 'Aangevraagd',
    'gepland': 'Gepland',
    'voltooid': 'Voltooid',
    'geannuleerd': 'Geannuleerd',
    'nieuw': 'In behandeling',
    'verwerkt': 'Verwerkt',
    'verzonden': 'Verzonden',
    'afgeleverd': 'Afgeleverd'
  };
  return mapping[status] || status;
}

/**
 * Formatteer type opdracht voor weergave
 */
function formatType(type) {
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
 * Formatteer bedrag in centen naar euros
 */
function formatBedrag(cents) {
  if (!cents && cents !== 0) return '-';
  return `${(cents / 100).toFixed(2).replace('.', ',')}`;
}

/**
 * Voeg status class toe aan element
 */
function addStatusClass(element, status) {
  if (!element) return;
  
  // Mapping van status naar class
  const statusClassMap = {
    'actief': 'is-active',
    'wachtrij': 'is-pending',
    'gepauzeerd': 'is-unactive',
    'gestopt': 'is-unactive',
    'verzonden': 'is-active',
    'afgeleverd': 'is-active',
    'nieuw': 'is-pending',
    'gepland': 'is-pending',
    'in_behandeling': 'is-pending',
    'geannuleerd': 'is-unactive'
  };
  
  const statusClass = statusClassMap[status] || 'is-pending';
  element.classList.add(statusClass);
}

/**
 * Populeer abonnementen sectie
 */
function populateAbonnementen(abonnementen) {
  const containerWithItems = document.querySelector('[data-abonnementen-state="heeft-items"]');
  const containerNoItems = document.querySelector('[data-abonnementen-state="geen-items"]');
  const template = document.querySelector('[data-abonnement-item][data-abonnement-item-id]');

  if (!containerWithItems || !containerNoItems || !template) {
    console.error('[Overview] Abonnementen containers of template niet gevonden');
    return;
  }

  // Toggle states
  if (abonnementen.length === 0) {
    containerWithItems.style.display = 'none';
    containerNoItems.style.display = 'block';
    // Hide template
    template.style.display = 'none';
    return;
  }

  containerWithItems.style.display = 'block';
  containerNoItems.style.display = 'none';

  // Clear bestaande items (behalve template)
  const parent = template.parentElement;
  const existingItems = parent.querySelectorAll('[data-abonnement-item]:not([data-abonnement-item-id=""])');
  existingItems.forEach(item => item.remove());

  // Render abonnementen
  abonnementen.forEach(abo => {
    const clone = template.cloneNode(true);
    clone.setAttribute('data-abonnement-item-id', abo.id);
    
    // Verwijder combo class 'abonnement-item-template' van clone
    clone.classList.remove('abonnement-item-template');

    // Vul data in
    const frequentieEl = clone.querySelector('[data-abo-frequentie]');
    const urenEl = clone.querySelector('[data-abo-uren]');
    const statusEl = clone.querySelector('[data-abo-status]');
    const startJaarEl = clone.querySelector('[data-abo-start-jaar]');
    const startWeekEl = clone.querySelector('[data-abo-start-week]');
    const detailBtn = clone.querySelector('[data-abo-detail-btn]');

    if (frequentieEl) frequentieEl.textContent = formatFrequentie(abo.frequentie);
    if (urenEl) urenEl.textContent = `${abo.uren} uur`;
    if (statusEl) {
      statusEl.textContent = formatStatus(abo.status);
      addStatusClass(statusEl, abo.status);
    }
    if (startJaarEl) startJaarEl.textContent = getJaarFromDate(abo.startdatum);
    if (startWeekEl) startWeekEl.textContent = `Week ${getWeeknummerFromDate(abo.startdatum)}`;
    
    if (detailBtn) {
      detailBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = `/dashboard/klant/schoonmaak-abonnement?id=${abo.id}`;
      });
    }

    parent.appendChild(clone);
  });
  
  // Hide template na renderen
  template.style.display = 'none';
}

/**
 * Populeer eenmalige opdrachten sectie
 */
function populateEenmaligeOpdrachten(opdrachten) {
  const containerWithItems = document.querySelector('[data-eenmalig-state="heeft-items"]');
  const containerNoItems = document.querySelector('[data-eenmalig-state="geen-items"]');
  const template = document.querySelector('[data-eenmalig-item][data-eenmalig-item-id]');

  if (!containerWithItems || !containerNoItems || !template) {
    console.error('[Overview] Eenmalige opdrachten containers of template niet gevonden');
    return;
  }

  // Toggle states
  if (opdrachten.length === 0) {
    containerWithItems.style.display = 'none';
    containerNoItems.style.display = 'block';
    // Hide template
    template.style.display = 'none';
    return;
  }

  containerWithItems.style.display = 'block';
  containerNoItems.style.display = 'none';

  // Clear bestaande items (behalve template)
  const parent = template.parentElement;
  const existingItems = parent.querySelectorAll('[data-eenmalig-item]:not([data-eenmalig-item-id=""])');
  existingItems.forEach(item => item.remove());

  // Render opdrachten
  opdrachten.forEach(opr => {
    const clone = template.cloneNode(true);
    clone.setAttribute('data-eenmalig-item-id', opr.id);
    
    // Verwijder combo class 'eenmalig-item-template' van clone
    clone.classList.remove('eenmalig-item-template');

    // Vul data in
    const typeEl = clone.querySelector('[data-eenmalig-type]');
    const datumEl = clone.querySelector('[data-eenmalig-datum]');
    const statusEl = clone.querySelector('[data-eenmalig-status]');
    const detailBtn = clone.querySelector('[data-eenmalig-detail-btn]');

    if (typeEl) typeEl.textContent = formatType(opr.type);
    if (datumEl) datumEl.textContent = formatDatum(opr.gewenste_datum);
    if (statusEl) {
      statusEl.textContent = formatStatus(opr.status);
      addStatusClass(statusEl, opr.status);
    }
    
    if (detailBtn) {
      detailBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = `/dashboard/klant/eenmalige-schoonmaak?id=${opr.id}`;
      });
    }

    parent.appendChild(clone);
  });
  
  // Hide template na renderen
  template.style.display = 'none';
}

/**
 * Populeer bestellingen sectie
 */
function populateBestellingen(bestellingen) {
  const containerWithItems = document.querySelector('[data-bestellingen-state="heeft-items"]');
  const containerNoItems = document.querySelector('[data-bestellingen-state="geen-items"]');
  const template = document.querySelector('[data-bestelling-item][data-bestelling-item-id]');

  if (!containerWithItems || !containerNoItems || !template) {
    console.error('[Overview] Bestellingen containers of template niet gevonden');
    return;
  }

  // Toggle states
  if (bestellingen.length === 0) {
    containerWithItems.style.display = 'none';
    containerNoItems.style.display = 'block';
    // Hide template
    template.style.display = 'none';
    return;
  }

  containerWithItems.style.display = 'block';
  containerNoItems.style.display = 'none';

  // Clear bestaande items (behalve template)
  const parent = template.parentElement;
  const existingItems = parent.querySelectorAll('[data-bestelling-item]:not([data-bestelling-item-id=""])');
  existingItems.forEach(item => item.remove());

  // Render bestellingen
  bestellingen.forEach(best => {
    const clone = template.cloneNode(true);
    clone.setAttribute('data-bestelling-item-id', best.id);
    
    // Verwijder combo class 'bestelling-item-template' van clone
    clone.classList.remove('bestelling-item-template');

    // Vul data in
    const nummerEl = clone.querySelector('[data-bestelling-nummer]');
    const datumEl = clone.querySelector('[data-bestelling-datum]');
    const bedragEl = clone.querySelector('[data-bestelling-bedrag]');
    const statusEl = clone.querySelector('[data-bestelling-status]');
    const detailBtn = clone.querySelector('[data-bestelling-detail-btn]');

    if (nummerEl) nummerEl.textContent = best.bestel_nummer || '-';
    if (datumEl) datumEl.textContent = formatDatum(best.aangemaakt_op);
    if (bedragEl) bedragEl.textContent = formatBedrag(best.totaal_cents);
    if (statusEl) {
      statusEl.textContent = formatStatus(best.status);
      addStatusClass(statusEl, best.status);
    }
    
    if (detailBtn) {
      detailBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = `/dashboard/klant/bestellingen?id=${best.id}`;
      });
    }

    parent.appendChild(clone);
  });
  
  // Hide template na renderen
  template.style.display = 'none';
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
 * Initialiseer dashboard overview
 */
export async function initDashboardOverview() {
  console.log('📊 [Dashboard Overview] Initialiseren...');

  // Zet content direct op display none (ongeacht Webflow instellingen)
  const contentState = document.querySelector('[data-content-state]');
  if (contentState) contentState.style.display = 'none';

  // Toon loading state
  showLoading();

  try {
    // Haal auth token op
    const authState = authClient.getAuthState();
    if (!authState || !authState.access_token) {
      throw new Error('Geen authenticatie gevonden');
    }

    // Haal dashboard data op
    console.log('🔄 [Dashboard Overview] Fetching data...');
    const data = await apiClient('/routes/dashboard/klant/overview', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    console.log('✅ [Dashboard Overview] Data opgehaald:', data);

    // Vul gebruikersnaam in
    const nameEl = document.querySelector('[data-user-naam]');
    if (nameEl && data.user) {
      nameEl.textContent = data.user.voornaam || 'daar';
    }

    // Populeer secties
    if (data.abonnementen) {
      populateAbonnementen(data.abonnementen);
    }

    if (data.eenmalige_opdrachten) {
      populateEenmaligeOpdrachten(data.eenmalige_opdrachten);
    }

    if (data.bestellingen) {
      populateBestellingen(data.bestellingen);
    }

    console.log('✅ [Dashboard Overview] Initialisatie voltooid');
    
    // Verberg loading, toon content
    hideLoading();

  } catch (error) {
    console.error('❌ [Dashboard Overview] Fout bij ophalen data:', error);
    
    // Verberg loading
    hideLoading();
    
    // Toon error message
    const errorContainer = document.querySelector('[data-dashboard-error]');
    if (errorContainer) {
      errorContainer.textContent = 'Er ging iets mis bij het laden van je dashboard. Probeer de pagina te verversen.';
      errorContainer.style.display = 'block';
    }
  }
}
