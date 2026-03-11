// public/forms/dashboardSchoonmaker/eenmaligeDetailInit.js
/**
 * Dashboard Eenmalige Schoonmaak Detail initialisatie voor schoonmakers
 * Haalt opdracht details op en toont op de pagina
 * Bevat klant info en opdracht specifieke data
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';

// === TYPE LABELS ===

const typeLabels = {
  'dieptereiniging': 'Dieptereiniging',
  'verhuis': 'Verhuis-/Opleverschoonmaak',
  'tapijt': 'Tapijt Reiniging',
  'bankreiniging': 'Bank & Stoelen Reiniging',
  'vloer': 'Vloer Reiniging'
};

const STATUS_CLASSES = ['is-active', 'is-pending', 'is-done', 'is-unactive'];

// === DATUM FORMATTERING ===

function formatDatum(dateString) {
  if (!dateString) return 'Nog niet ingepland';
  const date = new Date(dateString);
  return date.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function applyStatusClass(element, className) {
  if (!element) return;
  STATUS_CLASSES.forEach(statusClass => element.classList.remove(statusClass));
  if (className) {
    element.classList.add(className);
  }
}

// === STATE HELPERS ===

function showLoading() {
  const loadingState = document.querySelector('[data-loading-state]');
  const contentState = document.querySelector('[data-content-state]');
  const errorContainer = document.querySelector('[data-dashboard-error]');

  if (loadingState) loadingState.style.display = 'block';
  if (contentState) contentState.style.display = 'none';
  if (errorContainer) errorContainer.style.display = 'none';
}

function hideLoading() {
  const loadingState = document.querySelector('[data-loading-state]');
  const contentState = document.querySelector('[data-content-state]');

  if (loadingState) loadingState.style.display = 'none';
  if (contentState) contentState.style.display = 'block';
}

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

// === POPULATE FUNCTIES ===

function populateOpdrachtInfo(data) {
  // Opdracht ID (laatste 8 tekens, hoofdletters)
  const opdrachtIdEl = document.querySelector('[data-opdracht-id]');
  if (opdrachtIdEl && data.opdracht_id) {
    opdrachtIdEl.textContent = `#${data.opdracht_id.slice(-8).toUpperCase()}`;
  }

  // Datum schoonmaak (null = "Nog niet ingepland")
  const datumEl = document.querySelector('[data-datum-schoonmaak]');
  if (datumEl) {
    datumEl.textContent = formatDatum(data.gewenste_datum);
  }

  // Type schoonmaak (leesbaar label)
  const typeEl = document.querySelector('[data-type-schoonmaak]');
  if (typeEl) {
    typeEl.textContent = typeLabels[data.type] || data.type || '-';
  }

  // Aantal uren
  const urenEl = document.querySelector('[data-uren]');
  if (urenEl) {
    urenEl.textContent = data.uren ? `${data.uren} uur` : '-';
  }

  // Extra uitleg (opmerking met fallback)
  const uitlegEl = document.querySelector('[data-extra-uitleg]');
  if (uitlegEl) {
    uitlegEl.textContent = data.opmerking || 'Geen extra uitleg';
  }

  // Status schoonmaak label
  const statusSchoonmaakEl = document.querySelector('[data-status-schoonmaak]');
  if (statusSchoonmaakEl) {
    statusSchoonmaakEl.textContent = data.schoonmaak_status_label || 'Onbekend';
    applyStatusClass(statusSchoonmaakEl, data.schoonmaak_status_class || 'is-pending');
  }

  // Status betaling label
  const statusBetalingEl = document.querySelector('[data-status-betaling]');
  if (statusBetalingEl) {
    statusBetalingEl.textContent = data.betaling_status_label || 'Onbekend';
    applyStatusClass(statusBetalingEl, data.betaling_status_class || 'is-pending');
  }

  // Adres
  if (data.adres) {
    const adresEl = document.querySelector('[data-adres]');
    if (adresEl) {
      const adresString = `${data.adres.straat} ${data.adres.huisnummer}${data.adres.toevoeging ? ' ' + data.adres.toevoeging : ''}`;
      adresEl.textContent = adresString;
    }

    const postcodePlaatsEl = document.querySelector('[data-postcode-plaats]');
    if (postcodePlaatsEl) {
      postcodePlaatsEl.textContent = `${data.adres.postcode} ${data.adres.plaats}`;
    }
  }
}

function populateKlantInfo(data) {
  if (!data.klant) {
    console.warn('[SM Eenmalige Detail] Geen klant data beschikbaar');
    return;
  }

  const klant = data.klant;

  // Foto
  const fotoEl = document.querySelector('[data-klant-foto]');
  if (fotoEl) {
    if (klant.profielfoto) {
      fotoEl.src = klant.profielfoto;
      fotoEl.alt = `${klant.voornaam} ${klant.achternaam}`;
    }
  }

  // Naam
  const naamEl = document.querySelector('[data-klant-naam]');
  if (naamEl) {
    naamEl.textContent = `${klant.voornaam || ''} ${klant.achternaam || ''}`.trim() || '-';
  }

  // Plaats
  const plaatsEl = document.querySelector('[data-klant-plaats]');
  if (plaatsEl) {
    plaatsEl.textContent = klant.plaats || '-';
  }

  // Telefoon (klikbaar)
  const telefoonEl = document.querySelector('[data-klant-telefoon]');
  if (telefoonEl) {
    const tel = klant.telefoon || '';
    telefoonEl.textContent = tel || '-';
    if (tel) {
      telefoonEl.href = `tel:${tel}`;
    }
  }

  // Email (klikbaar)
  const emailEl = document.querySelector('[data-klant-email]');
  if (emailEl) {
    const email = klant.email || '';
    emailEl.textContent = email || '-';
    if (email) {
      emailEl.href = `mailto:${email}`;
    }
  }

  // Profiel bekijken button
  const profielBtn = document.querySelector('[data-klant-profiel-btn]');
  if (profielBtn) {
    profielBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // TODO: Navigeer naar klant profiel pagina wanneer deze bestaat
      console.log('[SM Eenmalige Detail] Klant profiel button geklikt - pagina nog niet beschikbaar');
    });
  }
}

// === MAIN INIT ===

/**
 * Initialiseer schoonmaker eenmalige schoonmaak detail pagina
 */
export async function initEenmaligeDetail() {
  console.log('📋 [SM Eenmalige Detail] Initialiseren...');

  // Check authenticatie EERST
  const authState = authClient.getAuthState();
  if (!authState || !authState.access_token) {
    console.warn('⚠️ [SM Eenmalige Detail] Geen authenticatie, stoppen met initialisatie');
    return;
  }

  // Zet content direct op display none
  const contentState = document.querySelector('[data-content-state]');
  if (contentState) contentState.style.display = 'none';

  // Toon loading state
  showLoading();

  try {
    // Haal match ID op uit URL (?id=...)
    const params = new URLSearchParams(window.location.search);
    const matchId = params.get('id');

    if (!matchId) {
      showError('Geen opdracht ID gevonden in de URL.');
      return;
    }

    console.log('🔄 [SM Eenmalige Detail] Fetching data voor match:', matchId);

    const data = await apiClient(`/routes/dashboard/schoonmaker/eenmalige-detail?id=${matchId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    console.log('✅ [SM Eenmalige Detail] Data opgehaald:', data);

    // Vul pagina in
    populateOpdrachtInfo(data);
    populateKlantInfo(data);

    // Verberg loading, toon content
    hideLoading();

    console.log('✅ [SM Eenmalige Detail] Initialisatie voltooid');

  } catch (error) {
    console.error('❌ [SM Eenmalige Detail] Fout bij ophalen data:', error);
    showError('Er ging iets mis bij het laden van de opdracht. Probeer het opnieuw.');
  }
}
