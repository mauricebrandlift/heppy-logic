// public/forms/dashboardSchoonmaker/abonnementenOverviewInit.js
/**
 * Abonnementen overview initialisatie voor schoonmakers
 * Toont alle abonnementen waaraan de schoonmaker is gekoppeld
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
    'eenmalig': 'Eenmalig',
    'vierweeks': '1x per 4 weken'
  };
  return mapping[frequentie] || frequentie;
}

/**
 * Formatteer status voor weergave
 */
function formatStatus(status) {
  const mapping = {
    'wachtrij': 'In wachtrij',
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
    'wachtrij': 'is-pending',
    'actief': 'is-active',
    'gepauzeerd': 'is-pending',
    'gestopt': 'is-unactive'
  };
  
  const statusClass = statusClassMap[status] || 'is-pending';
  element.classList.add(statusClass);
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
 * Populeer abonnementen overzicht
 */
function populateAbonnementen(abonnementen) {
  const containerWithItems = document.querySelector('[data-abonnementen-state="heeft-items"]');
  const containerNoItems = document.querySelector('[data-abonnementen-state="geen-items"]');
  const template = document.querySelector('[data-abonnement-item]');

  if (!containerWithItems || !containerNoItems || !template) {
    console.error('[Abonnementen Overview] Containers of template niet gevonden');
    return;
  }

  // Toggle states
  if (abonnementen.length === 0) {
    containerWithItems.style.display = 'none';
    containerNoItems.style.display = 'block';
    template.style.display = 'none';
    return;
  }

  containerWithItems.style.display = 'block';
  containerNoItems.style.display = 'none';

  // Clear bestaande items (behalve template)
  const parent = template.parentElement;
  const existingItems = parent.querySelectorAll('[data-abonnement-item]:not(.abonnement-item-template)');
  existingItems.forEach(item => item.remove());

  // Render abonnementen
  abonnementen.forEach(abb => {
    const clone = template.cloneNode(true);
    clone.setAttribute('data-abonnement-item-id', abb.id);
    clone.classList.remove('abonnement-item-template');
    clone.style.display = '';

    // === FREQUENTIE ===
    const frequentieEl = clone.querySelector('[data-abb-frequentie]');
    if (frequentieEl) {
      frequentieEl.textContent = formatFrequentie(abb.frequentie);
    }

    // === UREN ===
    const urenEl = clone.querySelector('[data-abb-uren]');
    if (urenEl) {
      urenEl.textContent = `${abb.uren} uur`;
    }

    // === KLANT NAAM ===
    const klantNaamEl = clone.querySelector('[data-abb-klant-naam]');
    if (klantNaamEl) {
      klantNaamEl.textContent = `${abb.klant_voornaam || ''} ${abb.klant_achternaam || ''}`.trim();
    }

    // === ADRES ===
    const adresEl = clone.querySelector('[data-abb-adres]');
    if (adresEl) {
      adresEl.textContent = formatAdres(abb.adres);
    }

    // === START JAAR ===
    const startJaarEl = clone.querySelector('[data-abb-start-jaar]');
    if (startJaarEl) {
      startJaarEl.textContent = abb.startJaar || '-';
    }

    // === START WEEK NR ===
    const startWeekEl = clone.querySelector('[data-abb-start-week]');
    if (startWeekEl) {
      startWeekEl.textContent = abb.startWeeknummer || '-';
    }

    // === STATUS ===
    const statusEl = clone.querySelector('[data-abb-status]');
    if (statusEl) {
      statusEl.textContent = formatStatus(abb.status);
      addStatusClass(statusEl, abb.status);
    }

    // === DETAIL KNOP ===
    const detailBtn = clone.querySelector('[data-abb-detail-btn]');
    if (detailBtn) {
      detailBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = `/dashboard/schoonmaker/schoonmaak-abonnement?id=${abb.id}`;
      });
    }

    parent.appendChild(clone);
  });

  // Hide template na renderen
  template.style.display = 'none';

  console.log('✅ [Abonnementen Overview] Abonnementen gerenderd');
}

/**
 * Laat foutmelding zien
 */
function showError(message) {
  console.error('[Abonnementen Overview] Error:', message);
  const container = document.querySelector('[data-schoonmaker-abonnementen-state="heeft-items"]');
  if (container) {
    container.innerHTML = `<div class="error-message">${message}</div>`;
  }
}

/**
 * Initialiseer abonnementen overview
 */
export async function initAbonnementenOverview() {
  console.log('📅 [Abonnementen Overview] Initialiseren...');

  // Check authenticatie
  const authState = authClient.getAuthState();
  if (!authState || !authState.access_token) {
    console.warn('⚠️ [Abonnementen Overview] Geen authenticatie');
    return;
  }

  try {
    console.log('🔄 [Abonnementen Overview] Fetching abonnementen...');
    
    const response = await apiClient('/routes/dashboard/schoonmaker/abonnementen', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    if (!response.success) {
      throw new Error(response.error || 'Kon abonnementen niet ophalen');
    }

    const abonnementen = response.data || [];
    console.log(`✅ [Abonnementen Overview] Loaded ${abonnementen.length} abonnementen`);

    // === POPULEER UI ===
    populateAbonnementen(abonnementen);

    console.log('✅ [Abonnementen Overview] Initialisatie voltooid');

  } catch (error) {
    console.error('❌ [Abonnementen Overview] Error:', error);
    showError(error.message);
  }
}
