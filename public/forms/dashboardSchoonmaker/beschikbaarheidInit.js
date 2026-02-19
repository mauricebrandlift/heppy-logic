// public/forms/dashboardSchoonmaker/beschikbaarheidInit.js
/**
 * Beschikbaarheid initialisatie voor schoonmakers
 * Toont beschikbaarheid per dag en uur in het dashboard overview
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';

/**
 * Formatteer uur voor weergave (07:00 - 08:00)
 */
function formatUurLabel(uur) {
  if (!uur) return '';
  // Uur is '07:00:00' formaat, converteer naar '07:00 - 08:00'
  const hour = parseInt(uur.split(':')[0]);
  const nextHour = (hour + 1).toString().padStart(2, '0');
  return `${uur.substring(0, 5)} - ${nextHour}:00`;
}

/**
 * Voeg status class toe aan uur element
 */
function addStatusClass(element, status) {
  if (!element) return;
  
  // Mapping van status naar class
  const statusClassMap = {
    'beschikbaar': 'is-beschikbaar',      // Groen - beschikbaar
    'bezet': 'is-bezet',                   // Oranje - bezet met abonnement
    'niet_beschikbaar': 'is-niet-beschikbaar' // Grijs - niet beschikbaar
  };
  
  const statusClass = statusClassMap[status] || 'is-niet-beschikbaar';
  element.classList.add(statusClass);
}

/**
 * Populeer beschikbaarheid overview
 */
function populateBeschikbaarheid(beschikbaarheidPerDag) {
  const overviewContainer = document.querySelector('[data-beschikbaarheid-overview]');
  const dagTemplate = document.querySelector('[data-dag-item]');

  if (!overviewContainer || !dagTemplate) {
    console.error('[Beschikbaarheid] Overview container of dag template niet gevonden');
    return;
  }

  // Dag namen mapping
  const dagNamen = {
    'maandag': 'Maandag',
    'dinsdag': 'Dinsdag',
    'woensdag': 'Woensdag',
    'donderdag': 'Donderdag',
    'vrijdag': 'Vrijdag',
    'zaterdag': 'Zaterdag',
    'zondag': 'Zondag'
  };

  const dagen = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];

  // Clear bestaande dag items (behalve template)
  const existingDagen = overviewContainer.querySelectorAll('[data-dag-item]:not(.dag-item-template)');
  existingDagen.forEach(item => item.remove());

  // Render elke dag
  dagen.forEach(dag => {
    const dagClone = dagTemplate.cloneNode(true);
    dagClone.setAttribute('data-dag', dag);
    dagClone.classList.remove('dag-item-template');
    dagClone.style.display = '';

    // Vul dag heading
    const dagHeading = dagClone.querySelector('[data-dag-heading]');
    if (dagHeading) {
      dagHeading.textContent = dagNamen[dag];
    }

    // Haal uur template uit deze dag
    const urenContainer = dagClone.querySelector('[data-uren-container]');
    const uurTemplate = dagClone.querySelector('[data-uur-item]');

    if (!urenContainer || !uurTemplate) {
      console.error(`[Beschikbaarheid] Uren container of uur template niet gevonden voor ${dag}`);
      return;
    }

    // Clear bestaande uur items (behalve template)
    const existingUren = urenContainer.querySelectorAll('[data-uur-item]:not(.uur-item-template)');
    existingUren.forEach(item => item.remove());

    // Haal beschikbaarheid voor deze dag op
    const dagBeschikbaarheid = beschikbaarheidPerDag[dag] || [];
    
    // Maak een map van uur -> status voor snelle lookup
    const uurStatusMap = {};
    dagBeschikbaarheid.forEach(item => {
      uurStatusMap[item.uur] = item.status;
    });

    // Render uren van 08:00 tot 19:00 (12 uren)
    for (let hour = 8; hour <= 19; hour++) {
      const uurFormatted = `${hour.toString().padStart(2, '0')}:00:00`;
      const uurClone = uurTemplate.cloneNode(true);
      
      uurClone.setAttribute('data-uur', uurFormatted);
      
      // Status bepalen: als niet in database, dan 'niet_beschikbaar'
      const status = uurStatusMap[uurFormatted] || 'niet_beschikbaar';
      uurClone.setAttribute('data-status', status);
      
      uurClone.classList.remove('uur-item-template');
      uurClone.style.display = '';

      // Vul uur label
      const uurLabel = uurClone.querySelector('[data-uur-label]');
      if (uurLabel) {
        uurLabel.textContent = `${hour.toString().padStart(2, '0')}:00`;
      }

      // Voeg status class toe voor styling
      addStatusClass(uurClone, status);

      // Voeg toe aan container (voor template)
      urenContainer.insertBefore(uurClone, uurTemplate);
    }

    // Verberg uur template
    uurTemplate.style.display = 'none';

    // Voeg dag toe aan overview (voor dag template)
    overviewContainer.insertBefore(dagClone, dagTemplate);
  });

  // Verberg dag template
  dagTemplate.style.display = 'none';

  console.log('✅ [Beschikbaarheid] Beschikbaarheid gerenderd voor alle dagen');
}

/**
 * Laat foutmelding zien
 */
function showError(message) {
  console.error('[Beschikbaarheid] Error:', message);
  // Optioneel: toon error in UI
  const overviewContainer = document.querySelector('[data-beschikbaarheid-overview]');
  if (overviewContainer) {
    overviewContainer.innerHTML = `<div class="error-message">${message}</div>`;
  }
}

/**
 * Initialiseer beschikbaarheid overview
 */
export async function initBeschikbaarheidOverview() {
  console.log('📅 [Beschikbaarheid] Initialiseren...');

  // Check authenticatie
  const authState = authClient.getAuthState();
  if (!authState || !authState.access_token) {
    console.warn('⚠️ [Beschikbaarheid] Geen authenticatie');
    return;
  }

  try {
    console.log('🔄 [Beschikbaarheid] Fetching beschikbaarheid...');
    
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
    console.log(`✅ [Beschikbaarheid] Loaded beschikbaarheid`);

    // === POPULEER UI ===
    populateBeschikbaarheid(beschikbaarheidPerDag);

    console.log('✅ [Beschikbaarheid] Initialisatie voltooid');

  } catch (error) {
    console.error('❌ [Beschikbaarheid] Error:', error);
    showError(error.message);
  }
}
