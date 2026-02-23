// public/forms/dashboardSchoonmaker/abonnementDetailInit.js
/**
 * Dashboard Abonnement Detail initialisatie voor schoonmakers
 * Haalt abonnement details op en toont op de pagina
 * Bevat klant profiel info en stopformulier
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';
import { hideAllSuccessMessages } from '../ui/formUi.js';

// State
let currentAbonnementId = null;

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

// === LOADING / ERROR / CONTENT STATE ===

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

/**
 * Vul abonnement header details in
 */
function populateAbonnementHeader(data) {
  // Abonnement nummer
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

  // Frequentie en uren
  const frequentieEl = document.querySelector('[data-abo-frequentie]');
  const urenEl = document.querySelector('[data-abo-uren]');

  if (frequentieEl) frequentieEl.textContent = formatFrequentie(data.frequentie);
  if (urenEl) urenEl.textContent = `${data.uren} uur`;
}

/**
 * Vul klant profiel sectie in
 */
function populateKlantSection(data) {
  if (!data.klant) {
    console.warn('[SM Abonnement Detail] Geen klant data beschikbaar');
    return;
  }

  const klant = data.klant;

  // Foto
  const fotoEl = document.querySelector('[data-klant-foto]');
  if (fotoEl && klant.profielfoto) {
    fotoEl.src = klant.profielfoto;
    fotoEl.alt = `${klant.voornaam} ${klant.achternaam}`;
  }

  // Naam
  const naamEl = document.querySelector('[data-klant-naam]');
  if (naamEl) {
    naamEl.textContent = `${klant.voornaam} ${klant.achternaam}`;
  }

  // Plaats
  const plaatsEl = document.querySelector('[data-klant-plaats]');
  if (plaatsEl) {
    plaatsEl.textContent = klant.plaats || '-';
  }

  // Telefoon
  const telefoonEl = document.querySelector('[data-klant-telefoon]');
  if (telefoonEl) {
    telefoonEl.textContent = klant.telefoon || '-';
  }

  // Email
  const emailEl = document.querySelector('[data-klant-email]');
  if (emailEl) {
    emailEl.textContent = klant.email || '-';
  }

  // Profiel bekijken button (pagina moet nog gemaakt worden)
  const profielBtn = document.querySelector('[data-klant-profiel-btn]');
  if (profielBtn) {
    profielBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // TODO: Navigeer naar klant profiel pagina wanneer deze bestaat
      console.log('[SM Abonnement Detail] Klant profiel button geklikt - pagina nog niet beschikbaar');
    });
  }
}

/**
 * Initialiseer stop sectie op basis van huidige status
 */
async function initializeStopSection(data) {
  console.log('🚫 [SM Abonnement Detail] Initialiseren stop sectie...');

  const actiefState = document.querySelector('[data-abonnementen-stop-state="is-actief"]');
  const opgezegtState = document.querySelector('[data-abonnementen-stop-state="is-opgezegd"]');
  const stopInfoEl = document.querySelector('[data-stop-info]');
  const formElement = document.querySelector('[data-form-name="abb_stop-form"]');

  // === CHECK OF ER AL GESTOPT IS ===
  if (data.stop_info) {
    console.log('[SM Abonnement Detail] Abonnement heeft stop info:', data.stop_info);

    // Toggle states: verberg actief, toon opgezegd
    if (actiefState) actiefState.style.display = 'none';
    if (opgezegtState) opgezegtState.style.display = 'block';

    if (stopInfoEl) {
      if (data.stop_info.gestopt_door === 'klant') {
        stopInfoEl.innerHTML = '<strong>Status:</strong> Gestopt door klant';
        if (data.stop_info.stopdatum) {
          stopInfoEl.innerHTML += `<br><strong>Datum:</strong> ${formatDatum(data.stop_info.stopdatum)}`;
        }
      } else {
        // Gestopt door schoonmaker
        let html = '<strong>Status:</strong> Gestopt door jou';
        if (data.stop_info.opzeg_week && data.stop_info.opzeg_jaar) {
          html += `<br><strong>Laatste week:</strong> Week ${data.stop_info.opzeg_week} (${data.stop_info.opzeg_jaar})`;
        }
        if (data.stop_info.stopdatum) {
          html += `<br><strong>Aangevraagd op:</strong> ${formatDatum(data.stop_info.stopdatum)}`;
        }
        if (data.stop_info.reden) {
          html += `<br><strong>Reden:</strong> ${data.stop_info.reden}`;
        }
        stopInfoEl.innerHTML = html;
      }
      stopInfoEl.style.display = 'block';
    }

    return;
  }

  // === ABONNEMENT IS NOG ACTIEF - TOON FORMULIER ===
  if (data.status === 'gestopt') {
    // Abonnement gestopt maar geen specifieke stop info
    if (actiefState) actiefState.style.display = 'none';
    if (opgezegtState) opgezegtState.style.display = 'block';
    if (stopInfoEl) {
      stopInfoEl.innerHTML = '<strong>Status:</strong> Dit abonnement is gestopt';
      stopInfoEl.style.display = 'block';
    }
    return;
  }

  // Abonnement is actief - toon formulier
  if (actiefState) actiefState.style.display = 'block';
  if (opgezegtState) opgezegtState.style.display = 'none';

  if (!formElement) {
    console.warn('⚠️ [SM Abonnement Detail] Stop formulier niet gevonden in DOM');
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

  const schema = getFormSchema('abb_stop-form');
  if (!schema) {
    console.error('❌ [SM Abonnement Detail] Schema voor abb_stop-form niet gevonden');
    return;
  }

  // Custom submit action
  schema.submit = {
    action: async (formData) => {
      console.log('📤 [SM Abonnement Detail] Submitting stop verzoek...', formData);

      // Haal jaar op uit hidden dataset attribuut (gezet door initWeekSelectTrigger)
      const weekInput = formElement.querySelector('[data-field-name="opzeg_weeknr"]');
      const opzeg_jaar = weekInput?.dataset.weekYear || new Date().getFullYear();

      const authState = authClient.getAuthState();
      const response = await apiClient('/routes/dashboard/schoonmaker/stop-abonnement', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: {
          id: data.id,
          opzeg_weeknr: formData.opzeg_weeknr,
          opzeg_jaar: opzeg_jaar,
          opzeg_reden: formData.opzeg_reden || ''
        }
      });

      console.log('✅ [SM Abonnement Detail] Stop verzoek succesvol:', response);
      return { message: 'Stopverzoek succesvol verwerkt' };
    },
    onSuccess: () => {
      const formName = 'abb_stop-form';
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
    maxWeeks: 26
  });

  console.log('✅ [SM Abonnement Detail] Stop formulier geïnitialiseerd');
}

// === MAIN INIT ===

/**
 * Initialiseer schoonmaker abonnement detail pagina
 */
export async function initSchoonmakerAbonnementDetail() {
  console.log('📋 [SM Abonnement Detail] Initialiseren...');

  // Hide alle success messages bij laden
  hideAllSuccessMessages();

  // Check authenticatie EERST
  const authState = authClient.getAuthState();
  if (!authState || !authState.access_token) {
    console.warn('⚠️ [SM Abonnement Detail] Geen authenticatie, stoppen met initialisatie');
    return;
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

    // Store voor later gebruik
    currentAbonnementId = abonnementId;

    // Haal abonnement data op
    console.log('🔄 [SM Abonnement Detail] Fetching data...', { abonnementId });
    const data = await apiClient(`/routes/dashboard/schoonmaker/abonnement-detail?id=${abonnementId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    console.log('✅ [SM Abonnement Detail] Data opgehaald:', data);

    // Vul pagina in
    populateAbonnementHeader(data);
    populateKlantSection(data);
    await initializeStopSection(data);

    console.log('✅ [SM Abonnement Detail] Initialisatie voltooid');

    // Verberg loading, toon content
    hideLoading();

  } catch (error) {
    console.error('❌ [SM Abonnement Detail] Fout bij ophalen data:', error);
    showError('Er ging iets mis bij het laden van het abonnement. Probeer het opnieuw.');
  }
}
