// public/forms/dashboardKlant/abonnementDetailInit.js
/**
 * Dashboard Abonnement Detail initialisatie voor klanten
 * Haalt abonnement details op en toont op de pagina
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';

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
    'gestopt': 'Gestopt'
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
    'gestopt': 'is-unactive'
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

  if (frequentieEl) frequentieEl.textContent = formatFrequentie(data.frequentie);
  if (urenEl) urenEl.textContent = `${data.uren} uur`;
  if (kostenEl && data.bundle_amount_cents) {
    kostenEl.textContent = formatBedrag(data.bundle_amount_cents);
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
 * Initialiseer wijzigingen sectie
 * Placeholder voor later (Step 3-4)
 */
function initializeWijzigingenSection(data) {
  // TODO: Later implementeren
  // - Frequentie wijzigen form
  // - Uren wijzigen form
  // - Kosten berekening
  console.log('[Abonnement Detail] Wijzigingen sectie - TODO');
}

/**
 * Initialiseer opzeggen sectie
 * Placeholder voor later (Step 3-4)
 */
function initializeOpzeggenSection(data) {
  // TODO: Later implementeren
  // - Opzeg modal
  // - Termijn selectie
  // - Bevestiging flow
  console.log('[Abonnement Detail] Opzeggen sectie - TODO');
}

/**
 * Initialiseer abonnement detail pagina
 */
export async function initAbonnementDetail() {
  console.log('📋 [Abonnement Detail] Initialiseren...');

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

    // Haal abonnement data op
    console.log('🔄 [Abonnement Detail] Fetching data...', { abonnementId });
    const data = await apiClient(`/routes/dashboard/klant/abonnement-detail?id=${abonnementId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    console.log('✅ [Abonnement Detail] Data opgehaald:', data);

    // Vul pagina in
    populateAbonnementHeader(data);
    populateSchoonmakerSection(data);
    
    // Initialize placeholder sections (later implementeren)
    initializeWijzigingenSection(data);
    initializeOpzeggenSection(data);

    console.log('✅ [Abonnement Detail] Initialisatie voltooid');
    
    // Verberg loading, toon content
    hideLoading();

  } catch (error) {
    console.error('❌ [Abonnement Detail] Fout bij ophalen data:', error);
    showError('Er ging iets mis bij het laden van het abonnement. Probeer het opnieuw.');
  }
}
