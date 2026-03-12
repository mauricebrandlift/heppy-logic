// public/forms/dashboardSchoonmaker/beschikbaarheidBeherenInit.js
/**
 * Beschikbaarheid beheren pagina voor schoonmakers
 * 
 * Toont exact hetzelfde grid als het overview, maar nu klikbaar.
 * Elk uur-blokje itereert door: beschikbaar → bezet → niet_beschikbaar
 * De waarde wordt opgeslagen in data-status attribuut op de div.
 * Bij opslaan worden alle data-status waarden uitgelezen en naar de API gestuurd.
 * 
 * Webflow attributen structuur:
 *   [data-beschikbaarheid-beheren]          - Hoofd container
 *   [data-dag-item]                         - Template voor een dag (wordt per dag gekloond)
 *     [data-dag-heading]                    - Tekst element voor dag naam
 *     [data-uren-container]                 - Wrapper om uur blokjes
 *       [data-uur-item]                     - Template voor een uur blokje (klikbaar)
 *         [data-uur-label]                  - Tekst element voor uur weergave
 *   [data-beschikbaarheid-opslaan]          - Opslaan button
 *   [data-beschikbaarheid-feedback]         - Feedback/status tekst element
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';

// === STATUS CYCLING CONFIG ===
const STATUS_CYCLE = ['beschikbaar', 'bezet', 'niet_beschikbaar'];

const STATUS_CLASS_MAP = {
  'beschikbaar': 'is-beschikbaar',
  'bezet': 'is-bezet',
  'niet_beschikbaar': 'is-niet-beschikbaar'
};

const DAG_NAMEN = {
  'maandag': 'Maandag',
  'dinsdag': 'Dinsdag',
  'woensdag': 'Woensdag',
  'donderdag': 'Donderdag',
  'vrijdag': 'Vrijdag',
  'zaterdag': 'Zaterdag',
  'zondag': 'Zondag'
};

const DAGEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];

// === DIRTY STATE TRACKING ===
// Bewaar originele staat als JSON string voor snelle vergelijking
let savedStateSnapshot = '';

/**
 * Maak een snapshot string van de huidige grid staat
 * Format: "dag:uur:status,dag:uur:status,..." gesorteerd
 */
function createStateSnapshot() {
  const data = collectBeschikbaarheidData();
  return data.map(item => `${item.dag}:${item.uur}:${item.status}`).sort().join(',');
}

/**
 * Check of er wijzigingen zijn t.o.v. opgeslagen staat
 */
function hasChanges() {
  return createStateSnapshot() !== savedStateSnapshot;
}

/**
 * Update button disabled/enabled op basis van dirty state
 */
function updateButtonState() {
  const opslaanButton = document.querySelector('[data-beschikbaarheid-opslaan]');
  if (!opslaanButton) return;

  const dirty = hasChanges();
  if (dirty) {
    opslaanButton.removeAttribute('disabled');
    opslaanButton.style.opacity = '';
    opslaanButton.style.pointerEvents = '';
  } else {
    opslaanButton.setAttribute('disabled', 'true');
    opslaanButton.style.opacity = '0.6';
    opslaanButton.style.pointerEvents = 'none';
  }
}

// === HELPERS ===

/**
 * Verwijder alle status classes van een element
 */
function removeAllStatusClasses(element) {
  Object.values(STATUS_CLASS_MAP).forEach(cls => {
    element.classList.remove(cls);
  });
}

/**
 * Zet status op een uur element (attribuut + class)
 */
function setUurStatus(uurElement, status) {
  removeAllStatusClasses(uurElement);
  uurElement.setAttribute('data-status', status);
  const statusClass = STATUS_CLASS_MAP[status] || 'is-niet-beschikbaar';
  uurElement.classList.add(statusClass);
}

/**
 * Cycle naar de volgende status
 */
function getNextStatus(currentStatus) {
  const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
  const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
  return STATUS_CYCLE[nextIndex];
}

/**
 * Bind click event op een uur blokje om door statussen te itereren
 */
function bindUurClick(uurElement) {
  uurElement.style.cursor = 'pointer';
  uurElement.addEventListener('click', () => {
    const currentStatus = uurElement.getAttribute('data-status') || 'niet_beschikbaar';
    const nextStatus = getNextStatus(currentStatus);
    setUurStatus(uurElement, nextStatus);
    console.log(`[Beschikbaarheid Beheren] ${uurElement.getAttribute('data-uur')} → ${nextStatus}`);

    // Check dirty state en update button
    updateButtonState();

    // Verberg eventuele success/error berichten bij nieuwe wijziging
    hideSuccessMessage();
    hideError();
  });
}

// === GRID RENDERING ===

/**
 * Populeer de beschikbaarheid grid (zelfde patroon als overview, maar klikbaar)
 */
function populateBeschikbaarheidGrid(beschikbaarheidPerDag) {
  const container = document.querySelector('[data-beschikbaarheid-beheren]');
  const dagTemplate = container?.querySelector('[data-dag-item]');

  if (!container || !dagTemplate) {
    console.error('[Beschikbaarheid Beheren] Container of dag template niet gevonden');
    return;
  }

  // Clear bestaande dag items (behalve template)
  const existingDagen = container.querySelectorAll('[data-dag-item]:not(.dag-item-template)');
  existingDagen.forEach(item => item.remove());

  // Render elke dag
  DAGEN.forEach(dag => {
    const dagClone = dagTemplate.cloneNode(true);
    dagClone.setAttribute('data-dag', dag);
    dagClone.classList.remove('dag-item-template');
    dagClone.style.display = '';

    // Vul dag heading
    const dagHeading = dagClone.querySelector('[data-dag-heading]');
    if (dagHeading) {
      dagHeading.textContent = DAG_NAMEN[dag];
    }

    // Haal uur template uit deze dag
    const urenContainer = dagClone.querySelector('[data-uren-container]');
    const uurTemplate = dagClone.querySelector('[data-uur-item]');

    if (!urenContainer || !uurTemplate) {
      console.error(`[Beschikbaarheid Beheren] Uren container of uur template niet gevonden voor ${dag}`);
      return;
    }

    // Clear bestaande uur items (behalve template)
    const existingUren = urenContainer.querySelectorAll('[data-uur-item]:not(.uur-item-template)');
    existingUren.forEach(item => item.remove());

    // Maak een map van uur -> status voor snelle lookup
    const dagBeschikbaarheid = beschikbaarheidPerDag[dag] || [];
    const uurStatusMap = {};
    dagBeschikbaarheid.forEach(item => {
      uurStatusMap[item.uur] = item.status;
    });

    // Render uren van 08:00 tot 19:00 (12 uren) - zelfde range als overview
    for (let hour = 8; hour <= 19; hour++) {
      const uurFormatted = `${hour.toString().padStart(2, '0')}:00:00`;
      const uurClone = uurTemplate.cloneNode(true);

      uurClone.setAttribute('data-uur', uurFormatted);
      uurClone.classList.remove('uur-item-template');
      uurClone.style.display = '';

      // Status bepalen: als niet in database, dan 'niet_beschikbaar'
      const status = uurStatusMap[uurFormatted] || 'niet_beschikbaar';
      setUurStatus(uurClone, status);

      // Vul uur label
      const uurLabel = uurClone.querySelector('[data-uur-label]');
      if (uurLabel) {
        uurLabel.textContent = `${hour.toString().padStart(2, '0')}:00`;
      }

      // Maak klikbaar (itereer door statussen)
      bindUurClick(uurClone);

      // Voeg toe aan container (voor template)
      urenContainer.insertBefore(uurClone, uurTemplate);
    }

    // Verberg uur template
    uurTemplate.style.display = 'none';

    // Voeg dag toe aan container (voor dag template)
    container.insertBefore(dagClone, dagTemplate);
  });

  // Verberg dag template
  dagTemplate.style.display = 'none';

  console.log('✅ [Beschikbaarheid Beheren] Grid gerenderd met klikbare uur blokjes');
}

// === DATA VERZAMELEN ===

/**
 * Lees alle uur statussen uit de DOM en retourneer als array
 * @returns {Array<{dag: string, uur: string, status: string}>}
 */
function collectBeschikbaarheidData() {
  const container = document.querySelector('[data-beschikbaarheid-beheren]');
  if (!container) return [];

  const result = [];

  DAGEN.forEach(dag => {
    const dagEl = container.querySelector(`[data-dag="${dag}"]`);
    if (!dagEl) return;

    const uurItems = dagEl.querySelectorAll('[data-uur-item]:not(.uur-item-template)');
    uurItems.forEach(uurEl => {
      const uur = uurEl.getAttribute('data-uur');
      const status = uurEl.getAttribute('data-status') || 'niet_beschikbaar';
      if (uur) {
        result.push({ dag, uur, status });
      }
    });
  });

  return result;
}

// === LOADING / CONTENT / ERROR STATE ===

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

function showDashboardError(message) {
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

// === INLINE FEEDBACK (voor opslaan acties) ===

/**
 * Toon inline error feedback (data-beschikbaarheid-feedback element)
 */
function showError(message) {
  const feedbackEl = document.querySelector('[data-beschikbaarheid-feedback]');
  if (!feedbackEl) return;

  feedbackEl.textContent = message;
  feedbackEl.style.display = '';
}

/**
 * Verberg error feedback bericht
 */
function hideError() {
  const feedbackEl = document.querySelector('[data-beschikbaarheid-feedback]');
  if (!feedbackEl) return;
  feedbackEl.style.display = 'none';
}

/**
 * Toon success message (data-success-message element, zelfde patroon als account formulieren)
 */
function showSuccessMessage() {
  const successEl = document.querySelector('[data-success-message="data-beschikbaarheid-beheren"]');
  if (!successEl) return;

  successEl.style.display = '';

  // Auto-hide na 5 seconden
  setTimeout(() => {
    successEl.style.display = 'none';
  }, 5000);
}

/**
 * Verberg success message
 */
function hideSuccessMessage() {
  const successEl = document.querySelector('[data-success-message="data-beschikbaarheid-beheren"]');
  if (!successEl) return;
  successEl.style.display = 'none';
}

// === OPSLAAN ===

/**
 * Sla beschikbaarheid op via API
 */
async function handleOpslaan() {
  const authState = authClient.getAuthState();
  if (!authState?.access_token) {
    showError('Je bent niet ingelogd. Ververs de pagina.');
    return;
  }

  const opslaanButton = document.querySelector('[data-beschikbaarheid-opslaan]');

  try {
    // Verberg eventuele oude berichten
    hideError();
    hideSuccessMessage();

    // Disable button tijdens opslaan
    if (opslaanButton) {
      opslaanButton.setAttribute('disabled', 'true');
      opslaanButton.style.opacity = '0.6';
      opslaanButton.style.pointerEvents = 'none';
    }

    // Verzamel alle data uit de DOM
    const beschikbaarheidData = collectBeschikbaarheidData();
    console.log(`[Beschikbaarheid Beheren] Opslaan: ${beschikbaarheidData.length} uur blokjes`);

    const response = await apiClient('/routes/dashboard/schoonmaker/beschikbaarheid-update', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`,
        'Content-Type': 'application/json'
      },
      body: { beschikbaarheid: beschikbaarheidData }
    });

    if (!response.success) {
      throw new Error(response.error || 'Kon beschikbaarheid niet opslaan');
    }

    console.log('✅ [Beschikbaarheid Beheren] Opgeslagen');

    // Update saved state snapshot (huidige staat is nu de "schone" staat)
    savedStateSnapshot = createStateSnapshot();

    showSuccessMessage();

    // Button weer disablen (geen wijzigingen meer)
    updateButtonState();

  } catch (error) {
    console.error('❌ [Beschikbaarheid Beheren] Opslaan error:', error);
    showError(error.message || 'Er ging iets mis bij het opslaan.');

    // Re-enable button zodat gebruiker opnieuw kan proberen
    if (opslaanButton) {
      opslaanButton.removeAttribute('disabled');
      opslaanButton.style.opacity = '';
      opslaanButton.style.pointerEvents = '';
    }
  }
}

// === INIT ===

/**
 * Initialiseer beschikbaarheid beheren pagina
 */
export async function initBeschikbaarheidBeheren() {
  console.log('📅 [Beschikbaarheid Beheren] Initialiseren...');

  // Check of de container bestaat op deze pagina
  const container = document.querySelector('[data-beschikbaarheid-beheren]');
  if (!container) {
    console.log('[Beschikbaarheid Beheren] Container niet gevonden, skip');
    return;
  }

  // Check authenticatie
  const authState = authClient.getAuthState();
  if (!authState?.access_token) {
    console.warn('⚠️ [Beschikbaarheid Beheren] Geen authenticatie');
    return;
  }

  try {
    // Toon loading, verberg content en errors
    showLoading();
    hideSuccessMessage();
    hideError();

    // Hergebruik dezelfde GET endpoint als overview
    const response = await apiClient('/routes/dashboard/schoonmaker/beschikbaarheid', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    if (!response.success) {
      throw new Error(response.error || 'Kon beschikbaarheid niet ophalen');
    }

    const beschikbaarheidPerDag = response.data || {};
    console.log('✅ [Beschikbaarheid Beheren] Data geladen');

    // Render klikbaar grid
    populateBeschikbaarheidGrid(beschikbaarheidPerDag);

    // Sla originele staat op voor dirty tracking
    savedStateSnapshot = createStateSnapshot();

    // Bind opslaan button (start disabled)
    const opslaanButton = document.querySelector('[data-beschikbaarheid-opslaan]');
    if (opslaanButton) {
      // Start disabled (geen wijzigingen nog)
      opslaanButton.setAttribute('disabled', 'true');
      opslaanButton.style.opacity = '0.6';
      opslaanButton.style.pointerEvents = 'none';

      opslaanButton.addEventListener('click', (e) => {
        e.preventDefault();
        handleOpslaan();
      });
      console.log('✅ [Beschikbaarheid Beheren] Opslaan button gebonden (disabled tot wijzigingen)');
    } else {
      console.warn('⚠️ [Beschikbaarheid Beheren] Opslaan button niet gevonden');
    }

    // Verberg loading, toon content
    hideLoading();

    console.log('✅ [Beschikbaarheid Beheren] Initialisatie voltooid');

  } catch (error) {
    console.error('❌ [Beschikbaarheid Beheren] Error:', error);
    showDashboardError(error.message || 'Kon beschikbaarheid niet laden.');
  }
}
