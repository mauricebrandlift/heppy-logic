// public/forms/shared/notificatiesInit.js
/**
 * Notificaties component - herbruikbaar voor klant, schoonmaker en admin dashboards
 * Haalt notificaties op en rendert ze in de DOM
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';

/**
 * Type naar kleur mapping (hex kleuren voor backgroundColor)
 */
const TYPE_KLEUREN = {
  // Rood - Actie vereist
  'betaling_mislukt': '#ef4444',
  'match_afgewezen': '#ef4444',
  
  // Geel/Oranje - Let op
  'pauze_gestart': '#f59e0b',
  'abonnement_opgezegd': '#f59e0b',
  'nieuwe_match': '#f59e0b',
  
  // Groen - Positief
  'match_geaccepteerd': '#10b981',
  'offerte_goedgekeurd': '#10b981',
  'betaling_geslaagd': '#10b981',
  
  // Blauw - Informatief
  'nieuw_bericht': '#3b82f6',
  'nieuwe_opdracht': '#3b82f6',
  'factuur_verzonden': '#3b82f6',
  'pauze_beeindigd': '#3b82f6'
};

/**
 * Type naar icon mapping (optioneel - kan gebruikt worden voor emoji/icons)
 */
const TYPE_ICONS = {
  'nieuwe_match': '🎉',
  'match_geaccepteerd': '✅',
  'match_afgewezen': '❌',
  'pauze_gestart': '⏸️',
  'pauze_beeindigd': '▶️',
  'abonnement_opgezegd': '👋',
  'nieuw_bericht': '💬',
  'nieuwe_opdracht': '🧹',
  'offerte_goedgekeurd': '✅',
  'betaling_mislukt': '⚠️',
  'betaling_geslaagd': '💳',
  'factuur_verzonden': '📄'
};

/**
 * Type naar link tekst mapping
 */
const TYPE_LINK_TEKST = {
  'nieuwe_match': 'Bekijk match',
  'match_geaccepteerd': 'Bekijk match',
  'match_afgewezen': 'Meer info',
  'pauze_gestart': 'Bekijk abonnement',
  'pauze_beeindigd': 'Bekijk abonnement',
  'abonnement_opgezegd': 'Bekijk abonnement',
  'nieuw_bericht': 'Lees bericht',
  'nieuwe_opdracht': 'Bekijk opdracht',
  'offerte_goedgekeurd': 'Bekijk offerte',
  'betaling_mislukt': 'Bijwerken',
  'betaling_geslaagd': 'Bekijk betaling',
  'factuur_verzonden': 'Download factuur'
};

/**
 * Formatteer datum naar relatieve tijd (bijv. "2 uur geleden")
 */
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Zojuist';
  if (diffMins < 60) return `${diffMins} minuten geleden`;
  if (diffHours < 24) return `${diffHours} uur geleden`;
  if (diffDays === 1) return 'Gisteren';
  if (diffDays < 7) return `${diffDays} dagen geleden`;
  
  // Oudere datums: volledige datum
  return date.toLocaleDateString('nl-NL', { 
    day: 'numeric', 
    month: 'short',
    year: diffDays > 365 ? 'numeric' : undefined
  });
}

/**
 * Initialiseer notificaties
 * @param {Object} options - Configuratie opties
 * @param {boolean} options.alleenActieVereist - Alleen actie-vereiste notificaties (admin)
 * @param {number} options.limit - Max aantal notificaties (default 10)
 */
export async function initNotificaties(options = {}) {
  const { alleenActieVereist = false, limit = 10 } = options;

  console.log('🔔 [Notificaties] Initialiseren...');

  const containerWithItems = document.querySelector('[data-notificaties-state="heeft-items"]');
  const containerNoItems = document.querySelector('[data-notificaties-state="geen-items"]');
  const template = document.querySelector('[data-notificatie-item]');

  if (!containerWithItems || !containerNoItems || !template) {
    console.warn('[Notificaties] Containers of template niet gevonden - notificaties worden niet getoond');
    return;
  }

  try {
    // Haal auth state op
    const authState = authClient.getAuthState();
    if (!authState || !authState.access_token) {
      console.error('[Notificaties] Geen auth token gevonden');
      return;
    }

    // Haal notificaties op
    let url = `/routes/notificaties/list?limit=${limit}`;
    if (alleenActieVereist) {
      url += '&alleen_actie=true';
    }

    const data = await apiClient(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    console.log(`✅ [Notificaties] ${data.notificaties.length} notificaties opgehaald`);

    // Toggle states
    if (data.notificaties.length === 0) {
      containerWithItems.style.display = 'none';
      containerNoItems.style.display = 'block';
      template.style.display = 'none';
      return;
    }

    containerWithItems.style.display = 'block';
    containerNoItems.style.display = 'none';

    // Clear bestaande items (behalve template)
    const parent = template.parentElement;
    const existingItems = parent.querySelectorAll('[data-notificatie-item]:not([data-notificatie-item][data-notificatie-id=""])');
    existingItems.forEach(item => item.remove());

    // Render notificaties
    data.notificaties.forEach(notificatie => {
      const clone = template.cloneNode(true);
      clone.setAttribute('data-notificatie-id', notificatie.id);
      
      // Verwijder template class (indien aanwezig)
      clone.classList.remove('notificatie-item-template');

      // Vul data in
      const colorEl = clone.querySelector('[data-notificatie-color]');
      const iconEl = clone.querySelector('[data-notificatie-icon]');
      const titelEl = clone.querySelector('[data-notificatie-titel]');
      const berichtEl = clone.querySelector('[data-notificatie-bericht]');
      const tijdEl = clone.querySelector('[data-notificatie-tijd]');
      const dismissBtn = clone.querySelector('[data-notificatie-dismiss]');
      const linkEl = clone.querySelector('[data-notificatie-link]');

      // Zet achtergrondkleur op color element
      if (colorEl) {
        const kleur = TYPE_KLEUREN[notificatie.type] || '#3b82f6'; // default blauw
        colorEl.style.backgroundColor = kleur;
      }

      if (iconEl) {
        iconEl.textContent = TYPE_ICONS[notificatie.type] || '🔔';
      }
      
      if (titelEl) {
        titelEl.textContent = notificatie.titel;
      }
      
      if (berichtEl) {
        berichtEl.textContent = notificatie.bericht;
      }
      
      if (tijdEl) {
        tijdEl.textContent = formatRelativeTime(notificatie.aangemaakt_op);
      }

      // Link functionaliteit (optioneel)
      if (linkEl && notificatie.link_url) {
        linkEl.href = notificatie.link_url;
        linkEl.textContent = TYPE_LINK_TEKST[notificatie.type] || 'Meer info';
        linkEl.style.display = 'inline-block';
      } else if (linkEl) {
        linkEl.style.display = 'none';
      }

      // Dismiss button functionaliteit
      if (dismissBtn) {
        dismissBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          await dismissNotificatie(notificatie.id, clone);
        });
      }

      parent.appendChild(clone);
    });

    // Hide template na renderen
    template.style.display = 'none';

  } catch (error) {
    console.error('❌ [Notificaties] Error:', error);
    // Toon lege state bij error
    containerWithItems.style.display = 'none';
    containerNoItems.style.display = 'block';
    template.style.display = 'none';
  }
}

/**
 * Verwijder (dismiss) notificatie
 * @param {string} notificatieId - Notificatie ID
 * @param {HTMLElement} element - DOM element om te verwijderen
 */
async function dismissNotificatie(notificatieId, element) {
  try {
    console.log('🗑️ [Notificaties] Verwijderen...', notificatieId);

    const authState = authClient.getAuthState();
    if (!authState || !authState.access_token) {
      console.error('[Notificaties] Geen auth token gevonden');
      return;
    }

    // Fade out animatie
    element.style.opacity = '0';
    element.style.transition = 'opacity 0.3s ease-out';

    // API call naar backend
    await apiClient('/routes/notificaties/dismiss', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        notificatie_id: notificatieId
      })
    });

    console.log('✅ [Notificaties] Verwijderd');

    // Verwijder element na animatie
    setTimeout(() => {
      element.remove();
      
      // Check of er nog notificaties zijn
      const parent = element.parentElement;
      const remainingItems = parent.querySelectorAll('[data-notificatie-item]:not([data-notificatie-id=""])');
      
      if (remainingItems.length === 0) {
        // Toon lege state
        const containerWithItems = document.querySelector('[data-notificaties-state="heeft-items"]');
        const containerNoItems = document.querySelector('[data-notificaties-state="geen-items"]');
        
        if (containerWithItems) containerWithItems.style.display = 'none';
        if (containerNoItems) containerNoItems.style.display = 'block';
      }
    }, 300);

  } catch (error) {
    console.error('❌ [Notificaties] Dismiss error:', error);
    // Reset opacity bij fout
    element.style.opacity = '1';
    alert('Er ging iets mis bij het verwijderen van de notificatie. Probeer het opnieuw.');
  }
}
