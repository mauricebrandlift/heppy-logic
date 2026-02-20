// public/forms/dashboardSchoonmaker/overviewInit.js
/**
 * Dashboard Overview initialisatie voor schoonmakers
 * Haalt alle aanvragen op en toont deze in de UI
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
    'open': 'Wacht op jouw reactie',
    'geaccepteerd': 'Door jou aangenomen',
    'geweigerd': 'Door jou afgewezen',
    'verlopen': 'Verlopen - niet gereageerd'
  };
  return mapping[status] || status;
}

/**
 * Formatteer type opdracht voor weergave
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
 * Bereken ISO weeknummer uit datum
 */
function getISOWeek(date) {
  if (!date) return null;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNum;
}

/**
 * Formatteer startdatum voor abonnement: "2025, week: 3"
 */
function formatStartdatum(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const week = getISOWeek(dateString);
  return `${year}, week: ${week}`;
}

/**
 * Formatteer gewenste datum voor eenmalig: "dag, maand, jaar"
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
 * Voeg status class toe aan element
 */
function addStatusClass(element, status) {
  if (!element) return;
  
  // Mapping van status naar class
  const statusClassMap = {
    'open': 'is-pending',      // Oranje/geel - wacht op actie
    'geaccepteerd': 'is-active',    // Groen - aangenomen
    'geweigerd': 'is-unactive',     // Rood - afgewezen
    'verlopen': 'is-unactive'       // Grijs - verlopen
  };
  
  const statusClass = statusClassMap[status] || 'is-pending';
  element.classList.add(statusClass);
}

/**
 * Populeer aanvragen sectie
 */
function populateAanvragen(aanvragen) {
  const containerWithItems = document.querySelector('[data-aanvragen-state="heeft-items"]');
  const containerNoItems = document.querySelector('[data-aanvragen-state="geen-items"]');
  const template = document.querySelector('[data-aanvraag-item][data-aanvraag-item-id]');

  if (!containerWithItems || !containerNoItems || !template) {
    console.error('[Schoonmaker Overview] Aanvragen containers of template niet gevonden');
    return;
  }

  // Toggle states
  if (aanvragen.length === 0) {
    containerWithItems.style.display = 'none';
    containerNoItems.style.display = 'block';
    template.style.display = 'none';
    return;
  }

  containerWithItems.style.display = 'block';
  containerNoItems.style.display = 'none';

  // Clear bestaande items (behalve template)
  const parent = template.parentElement;
  const existingItems = parent.querySelectorAll('[data-aanvraag-item]:not([data-aanvraag-item-id=""])');
  existingItems.forEach(item => item.remove());

  // Render aanvragen
  aanvragen.forEach(aanvraag => {
    const clone = template.cloneNode(true);
    clone.setAttribute('data-aanvraag-item-id', aanvraag.match_id);
    
    // Verwijder template class
    clone.classList.remove('aanvraag-item-template');

    // === TYPE BADGE ===
    const typeBadgeEl = clone.querySelector('[data-aanvraag-type]');
    if (typeBadgeEl) {
      if (aanvraag.type === 'abonnement') {
        typeBadgeEl.textContent = 'Abonnement';
        typeBadgeEl.classList.add('type-abonnement');
      } else {
        typeBadgeEl.textContent = formatTypeSchoonmaak(aanvraag.type_schoonmaak);
        typeBadgeEl.classList.add('type-eenmalig');
      }
    }

    // === SPOED BADGE (alleen voor eenmalig) ===
    const spoedBadgeEl = clone.querySelector('[data-aanvraag-spoed]');
    if (spoedBadgeEl) {
      if (aanvraag.type === 'eenmalig' && aanvraag.is_spoed) {
        spoedBadgeEl.style.display = 'inline-block';
        spoedBadgeEl.textContent = 'SPOED';
      } else {
        spoedBadgeEl.style.display = 'none';
      }
    }

    // === KLANT INFO ===
    const klantNaamEl = clone.querySelector('[data-aanvraag-klant-naam]');
    if (klantNaamEl && aanvraag.klant) {
      klantNaamEl.textContent = `${aanvraag.klant.voornaam} ${aanvraag.klant.achternaam}`;
    }

    const adresEl = clone.querySelector('[data-aanvraag-adres]');
    if (adresEl) {
      adresEl.textContent = formatAdres(aanvraag.adres);
    }

    // === DETAILS (frequentie/uren OF datum/uren) ===
    const detailsEl = clone.querySelector('[data-aanvraag-details]');
    if (detailsEl) {
      if (aanvraag.type === 'abonnement') {
        detailsEl.textContent = `${formatFrequentie(aanvraag.frequentie)} • ${aanvraag.uren || 0} uur`;
      } else {
        const datum = formatDatum(aanvraag.gewenste_datum);
        const uren = aanvraag.uren ? `${aanvraag.uren} uur` : '';
        detailsEl.textContent = uren ? `${datum} • ${uren}` : datum;
      }
    }

    // === START SCHOONMAAK ===
    const startEl = clone.querySelector('[data-aanvraag-start]');
    if (startEl) {
      if (aanvraag.type === 'abonnement') {
        // Voor abonnement: "2025, week: 3"
        startEl.textContent = formatStartdatum(aanvraag.startdatum);
      } else {
        // Voor eenmalig: "dag, maand, jaar"
        startEl.textContent = formatGewensteDatum(aanvraag.gewenste_datum);
      }
    }

    // === STATUS ===
    const statusEl = clone.querySelector('[data-aanvraag-status]');
    if (statusEl) {
      statusEl.textContent = formatStatus(aanvraag.status);
      addStatusClass(statusEl, aanvraag.status);
    }

    // === DATUM AANGEMAAKT ===
    const datumEl = clone.querySelector('[data-aanvraag-datum]');
    if (datumEl) {
      datumEl.textContent = formatDatum(aanvraag.aangemaakt_op);
    }

    // === DETAIL BUTTON ===
    const detailBtn = clone.querySelector('[data-aanvraag-detail-btn]');
    if (detailBtn) {
      detailBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Routering: abonnement → /schoonmaak-abonnement, eenmalig → /eenmalige-schoonmaak
        const detailPagePath = aanvraag.type === 'abonnement' 
          ? `/dashboard/schoonmaker/schoonmaak-abonnement?id=${aanvraag.match_id}`
          : `/dashboard/schoonmaker/eenmalige-schoonmaak?id=${aanvraag.match_id}`;
        window.location.href = detailPagePath;
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
    errorMessageEl.textContent = message || 'Er ging iets mis bij het laden van je aanvragen.';
  }
  
  setLoadingState(false);
}

/**
 * Initialiseer overview pagina
 */
export async function initSchoonmakerOverview() {
  console.log('🧹 [Schoonmaker Overview] Initializing...');

  // Check of we op overview pagina zijn
  const overviewPage = document.querySelector('[data-dashboard-page="overview"]');
  if (!overviewPage) {
    console.log('[Schoonmaker Overview] Niet op overview pagina, skip init');
    return;
  }

  // ⚠️ BELANGRIJK: Check authenticatie EERST voordat we iets doen
  // Dit voorkomt race conditions tijdens redirect
  const authState = authClient.getAuthState();
  if (!authState || !authState.access_token) {
    console.warn('⚠️ [Schoonmaker Overview] Geen authenticatie, stoppen met initialisatie');
    return; // Stop direct, laat dashboardAuth.js de redirect afhandelen
  }

  // Check auth
  const user = await authClient.getCurrentUser();
  if (!user) {
    console.error('[Schoonmaker Overview] Geen gebruiker ingelogd');
    showError('Je bent niet ingelogd. Log opnieuw in.');
    return;
  }

  if (user.rol !== 'schoonmaker') {
    console.error('[Schoonmaker Overview] User is geen schoonmaker:', user.rol);
    showError('Je hebt geen toegang tot dit dashboard.');
    return;
  }

  try {
    // Toon loading state
    setLoadingState(true);

    // === GEBRUIKERSNAAM ===
    const userNaamEl = document.querySelector('[data-user-naam]');
    if (userNaamEl) {
      userNaamEl.textContent = user.voornaam || 'Schoonmaker';
    }

    // === HAAL AANVRAGEN OP ===
    console.log('🔄 [Schoonmaker Overview] Fetching aanvragen...');
    
    const response = await apiClient('/routes/dashboard/schoonmaker/aanvragen', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    if (!response.success) {
      throw new Error(response.error || 'Kon aanvragen niet ophalen');
    }

    const aanvragen = response.data || [];
    console.log(`✅ [Schoonmaker Overview] Loaded ${aanvragen.length} aanvragen`);

    // === POPULEER UI ===
    populateAanvragen(aanvragen);

    // === TOON COUNT IN HEADER (optioneel) ===
    const openCount = aanvragen.filter(a => a.status === 'open').length;
    const countEl = document.querySelector('[data-aanvragen-count]');
    if (countEl) {
      countEl.textContent = openCount;
      countEl.style.display = openCount > 0 ? 'inline-block' : 'none';
    }

    // Hide loading
    setLoadingState(false);

    console.log('✅ [Schoonmaker Overview] Initialisatie voltooid');

  } catch (error) {
    console.error('❌ [Schoonmaker Overview] Error:', error);
    showError(error.message);
  }
}
