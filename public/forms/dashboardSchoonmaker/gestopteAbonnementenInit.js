// public/forms/dashboardSchoonmaker/gestopteAbonnementenInit.js
/**
 * Gestopte abonnementen overview voor schoonmakers
 * Toont abonnementen waar de schoonmaker ooit actief op was maar nu gestopt is
 * (door klant of door schoonmaker zelf)
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
 * Populeer gestopte abonnementen overzicht
 */
function populateGestopteAbonnementen(items) {
  const containerWithItems = document.querySelector('[data-abonnementen-stop-state="heeft-items"]');
  const template = document.querySelector('.abonnement-stop-item-template');

  if (!containerWithItems || !template) {
    console.warn('[Gestopte Abonnementen] Container of template niet gevonden');
    return;
  }

  // Toggle visibility
  if (items.length === 0) {
    containerWithItems.style.display = 'none';
    template.style.display = 'none';
    return;
  }

  containerWithItems.style.display = 'block';

  // Clear bestaande items (behalve template)
  const parent = template.parentElement;
  const existingItems = parent.querySelectorAll('[data-abonnement-stop-item]:not(.abonnement-stop-item-template)');
  existingItems.forEach(item => item.remove());

  // Render items
  items.forEach(item => {
    const clone = template.cloneNode(true);
    clone.setAttribute('data-abonnement-stop-item-id', item.id);
    clone.classList.remove('abonnement-stop-item-template');
    clone.style.display = '';

    // Klant naam
    const naamEl = clone.querySelector('[data-abb-klant-naam]');
    if (naamEl) {
      naamEl.textContent = `${item.klant_voornaam || ''} ${item.klant_achternaam || ''}`.trim();
    }

    // Adres
    const adresEl = clone.querySelector('[data-abb-adres]');
    if (adresEl) {
      adresEl.textContent = formatAdres(item.adres);
    }

    // Frequentie
    const frequentieEl = clone.querySelector('[data-abb-frequentie]');
    if (frequentieEl) {
      frequentieEl.textContent = formatFrequentie(item.frequentie);
    }

    // Uren
    const urenEl = clone.querySelector('[data-abb-uren]');
    if (urenEl) {
      urenEl.textContent = `${item.uren} uur`;
    }

    // Start jaar
    const startJaarEl = clone.querySelector('[data-abb-start-jaar]');
    if (startJaarEl) {
      startJaarEl.textContent = item.startJaar || '-';
    }

    // Start week
    const startWeekEl = clone.querySelector('[data-abb-start-week]');
    if (startWeekEl) {
      startWeekEl.textContent = item.startWeeknummer || '-';
    }

    // Stop jaar
    const stopJaarEl = clone.querySelector('[data-abb-stop-jaar]');
    if (stopJaarEl) {
      stopJaarEl.textContent = item.stopJaar || '-';
    }

    // Stop week
    const stopWeekEl = clone.querySelector('[data-abb-stop-week]');
    if (stopWeekEl) {
      stopWeekEl.textContent = item.stopWeek || '-';
    }

    // Status label
    const statusEl = clone.querySelector('[data-abb-status]');
    if (statusEl) {
      if (item.gestopt_door === 'klant') {
        statusEl.textContent = 'Gestopt door klant';
      } else {
        statusEl.textContent = 'Gestopt door jou';
      }
      statusEl.classList.add('is-unactive');
    }

    parent.appendChild(clone);
  });

  // Hide template
  template.style.display = 'none';

  console.log(`✅ [Gestopte Abonnementen] ${items.length} gestopte items gerenderd`);
}

/**
 * Initialiseer gestopte abonnementen overview
 */
export async function initGestopteAbonnementen() {
  console.log('🛑 [Gestopte Abonnementen] Initialiseren...');

  const authState = authClient.getAuthState();
  if (!authState || !authState.access_token) {
    console.warn('⚠️ [Gestopte Abonnementen] Geen authenticatie');
    return;
  }

  try {
    const response = await apiClient('/routes/dashboard/schoonmaker/gestopte-abonnementen', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    if (!response.success) {
      throw new Error(response.error || 'Kon gestopte abonnementen niet ophalen');
    }

    const items = response.data || [];
    console.log(`✅ [Gestopte Abonnementen] ${items.length} gestopte abonnementen geladen`);

    populateGestopteAbonnementen(items);

  } catch (error) {
    console.error('❌ [Gestopte Abonnementen] Error:', error);
    // Verberg sectie bij fout
    const container = document.querySelector('[data-abonnementen-stop-state="heeft-items"]');
    if (container) container.style.display = 'none';
  }
}
