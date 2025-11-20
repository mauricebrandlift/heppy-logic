// public/forms/vloer/rvOverzichtForm.js
// Formulier handling voor stap 4 van de vloer reiniging aanvraag: overzicht

import { formHandler } from '../logic/formHandler.js';
import { loadFlowData } from '../logic/formStorage.js';
import { logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';

const FORM_NAME = 'rv_overzicht-form';
const FORM_SELECTOR = '[data-form-name="rv_overzicht-form"]';
const NEXT_FORM_NAME = 'rv_persoonsgegevens-form';

function goToFormStep(nextFormName) {
  console.log('[rvOverzichtForm] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[rvOverzichtForm] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[rvOverzichtForm] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[rvOverzichtForm] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[rvOverzichtForm] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[rvOverzichtForm] Geen slider navigatie functie gevonden.');
  return false;
}

/**
 * Helper om text te zetten in een element
 */
function setText(selector, text) {
  const el = document.querySelector(selector);
  if (el) {
    el.textContent = text || '—';
  }
}

/**
 * Format dagdelen voor display
 * @param {Object} dagdelenDB - Dagdelen in DB formaat: { "maandag": ["ochtend", "middag"], "dinsdag": ["avond"] }
 * @param {boolean} geenVoorkeur - Of "geen voorkeur" is geselecteerd
 * @returns {string} - Geformatteerde string voor display
 */
function formatDagdelen(dagdelenDB, geenVoorkeur) {
  if (geenVoorkeur) {
    return 'Geen voorkeur';
  }
  
  if (!dagdelenDB || Object.keys(dagdelenDB).length === 0) {
    return '—';
  }
  
  const dagMapping = {
    'maandag': 'Ma',
    'dinsdag': 'Di',
    'woensdag': 'Wo',
    'donderdag': 'Do',
    'vrijdag': 'Vr',
    'zaterdag': 'Za',
    'zondag': 'Zo'
  };
  
  const dagdeelMapping = {
    'ochtend': 'ochtend',
    'middag': 'middag',
    'avond': 'avond'
  };
  
  const parts = [];
  
  Object.entries(dagdelenDB).forEach(([dag, dagdelen]) => {
    const dagKort = dagMapping[dag] || dag;
    const dagdelenFormatted = dagdelen.map(d => dagdeelMapping[d] || d).join(', ');
    parts.push(`${dagKort}: ${dagdelenFormatted}`);
  });
  
  return parts.join(' • ');
}

/**
 * Format vloer info voor display
 * Toont m² en vloer types
 * @param {Object} flow - Flow data
 * @returns {string} - Geformatteerde vloer info
 */
function formatVloer(flow) {
  const parts = [];
  
  // M²
  const m2 = parseInt(flow.rv_oppervlakte_m2) || 0;
  if (m2 > 0) {
    parts.push(`${m2} m²`);
  }
  
  // Vloer types
  if (flow.vloer_types && flow.vloer_types.length > 0) {
    parts.push(`Types: ${flow.vloer_types.join(', ')}`);
  }
  
  return parts.length > 0 ? parts.join(' • ') : '—';
}

/**
 * Initialiseer het overzicht formulier
 */
export function initRvOverzichtForm() {
  console.log('🧾 [rvOverzichtForm] Initialiseren overzicht…');
  
  const flow = loadFlowData('vloer-aanvraag') || {};
  console.log('[rvOverzichtForm] Flow data:', flow);

  // Adres en plaats
  const adresParts = [flow.straatnaam, flow.huisnummer, flow.toevoeging].filter(Boolean);
  setText('[data-overview="adres"]', adresParts.join(' '));
  setText('[data-overview="plaats"]', flow.plaats || '—');

  // Dagdelen voorkeur
  const dagdelenText = formatDagdelen(flow.dagdelenVoorkeur, flow.geenVoorkeurDagdelen);
  setText('[data-overview="dagdelen"]', dagdelenText);

  // Vloer (m² en types)
  const vloerText = formatVloer(flow);
  setText('[data-overview="vloer"]', vloerText);

  console.log('✅ [rvOverzichtForm] Overzicht gevuld.');

  // Initialiseer deze stap als "formulier" zodat de Webflow-knop via formHandler werkt
  const schema = {
    name: FORM_NAME,
    selector: FORM_SELECTOR,
    fields: {},
    submit: {
      action: async () => {
        // Geen extra actie; alle data is al in de flow bewaard door eerdere stappen
        console.log('[rvOverzichtForm] Submit action - geen extra validatie nodig');
      },
      onSuccess: async () => {
        console.log('[rvOverzichtForm] Submit success, navigeer naar stap 5 (persoonsgegevens)...');
        
        // Track step 4 completion
        logStepCompleted('vloerreinigen', 'overzicht', 4).catch(err => {
          console.warn('[rvOverzichtForm] Tracking failed:', err);
        });
        
        // Import persoonsgegevens formulier en initialiseer
        import('./rvPersoonsgegevensForm.js').then(module => {
          console.log('[rvOverzichtForm] Stap 5 (rvPersoonsgegevensForm) wordt geïnitialiseerd...');
          module.initRvPersoonsgegevensForm();
          goToFormStep(NEXT_FORM_NAME);
        }).catch(err => {
          console.error('[rvOverzichtForm] Kon stap 5 niet laden:', err);
          goToFormStep(NEXT_FORM_NAME);
        });
      }
    }
  };

  formHandler.init(schema);
  console.log('✅ [rvOverzichtForm] FormHandler geïnitialiseerd.');
  
  // 🔙 PREV BUTTON HANDLER - Re-initialiseer vorige stap bij terug navigeren
  setupPrevButtonHandler();
}

/**
 * Setup prev button handler voor terug navigatie
 * Re-initialiseert stap 3 (dagdelen) voordat er terug wordt genavigeerd
 */
let prevButtonHandler = null;

function setupPrevButtonHandler() {
  const prevButton = document.querySelector('[data-form-button-prev="rv_overzicht-form"]');
  
  if (!prevButton) {
    console.log('[rvOverzichtForm] Geen prev button gevonden met [data-form-button-prev="rv_overzicht-form"]');
    return;
  }
  
  console.log('[rvOverzichtForm] Prev button gevonden, event handler toevoegen...');
  
  // Verwijder oude handler indien aanwezig
  if (prevButtonHandler) {
    prevButton.removeEventListener('click', prevButtonHandler);
    console.log('[rvOverzichtForm] ♻️ Oude prev button handler verwijderd');
  }
  
  // Definieer nieuwe handler
  prevButtonHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[rvOverzichtForm] 🔙 Prev button clicked - navigeer naar stap 3 (dagdelen)');
    
    // Re-initialiseer de VORIGE stap (stap 3 = rvDagdelenForm) VOOR navigatie
    import('./rvDagdelenForm.js').then(module => {
      console.log('[rvOverzichtForm] ♻️ Re-init rvDagdelenForm voor terug navigatie...');
      module.initRvDagdelenForm();
      
      // NA re-init, ga naar vorige slide via Webflow functie
      if (typeof window.moveToPrevSlide === 'function') {
        console.log('[rvOverzichtForm] Roep window.moveToPrevSlide() aan');
        window.moveToPrevSlide();
      } else {
        console.warn('[rvOverzichtForm] window.moveToPrevSlide() niet beschikbaar');
      }
    }).catch(err => {
      console.error('[rvOverzichtForm] ❌ Fout bij re-init rvDagdelenForm:', err);
      if (typeof window.moveToPrevSlide === 'function') {
        window.moveToPrevSlide();
      }
    });
  };
  
  // Voeg nieuwe handler toe
  prevButton.addEventListener('click', prevButtonHandler);
  
  console.log('[rvOverzichtForm] ✅ Prev button handler toegevoegd');
}
