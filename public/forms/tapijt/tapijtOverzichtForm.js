// public/forms/tapijt/tapijtOverzichtForm.js
// Formulier handling voor stap 4 van de tapijt reiniging aanvraag: overzicht

import { formHandler } from '../logic/formHandler.js';
import { loadFlowData } from '../logic/formStorage.js';
import { logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';

const FORM_NAME = 'rt_overzicht-form';
const FORM_SELECTOR = '[data-form-name="rt_overzicht-form"]';
const NEXT_FORM_NAME = 'rt_persoonsgegevens-form';

function goToFormStep(nextFormName) {
  console.log('[tapijtOverzichtForm] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[tapijtOverzichtForm] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[tapijtOverzichtForm] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[tapijtOverzichtForm] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[tapijtOverzichtForm] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[tapijtOverzichtForm] Geen slider navigatie functie gevonden.');
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
 * Format tapijt info voor display
 * Toont m² en opties
 * @param {Object} flow - Flow data
 * @returns {string} - Geformatteerde tapijt info
 */
function formatTapijt(flow) {
  const parts = [];
  
  // M²
  const m2 = parseInt(flow.rt_totaal_m2) || 0;
  if (m2 > 0) {
    parts.push(`${m2} m²`);
  }
  
  // Opties
  if (flow.opties && flow.opties.length > 0) {
    parts.push(`Extra opties: ${flow.opties.join(', ')}`);
  }
  
  return parts.length > 0 ? parts.join(' • ') : '—';
}

/**
 * Initialiseer het overzicht formulier
 */
export function initTapijtOverzichtForm() {
  console.log('🧾 [tapijtOverzichtForm] Initialiseren overzicht…');
  
  const flow = loadFlowData('tapijt-aanvraag') || {};
  console.log('[tapijtOverzichtForm] Flow data:', flow);

  // Adres en plaats
  const adresParts = [flow.straatnaam, flow.huisnummer, flow.toevoeging].filter(Boolean);
  setText('[data-overview="adres"]', adresParts.join(' '));
  setText('[data-overview="plaats"]', flow.plaats || '—');

  // Dagdelen voorkeur
  const dagdelenText = formatDagdelen(flow.dagdelenVoorkeur, flow.geenVoorkeurDagdelen);
  setText('[data-overview="dagdelen"]', dagdelenText);

  // Tapijt (m² en opties)
  const tapijtText = formatTapijt(flow);
  setText('[data-overview="tapijt"]', tapijtText);

  console.log('✅ [tapijtOverzichtForm] Overzicht gevuld.');

  // Initialiseer deze stap als "formulier" zodat de Webflow-knop via formHandler werkt
  const schema = {
    name: FORM_NAME,
    selector: FORM_SELECTOR,
    fields: {},
    submit: {
      action: async () => {
        // Geen extra actie; alle data is al in de flow bewaard door eerdere stappen
        console.log('[tapijtOverzichtForm] Submit action - geen extra validatie nodig');
      },
      onSuccess: async () => {
        console.log('[tapijtOverzichtForm] Submit success, navigeer naar stap 5 (persoonsgegevens)...');
        
        // Track step 4 completion
        await logStepCompleted('tapijt', 'overzicht', 4, {
          heeftDagdelenVoorkeur: !!flow.dagdelenVoorkeur,
          geenVoorkeurDagdelen: flow.geenVoorkeurDagdelen,
          totaalM2: flow.rt_totaal_m2,
          heeftOpties: flow.opties && flow.opties.length > 0
        }).catch(err => console.warn('[tapijtOverzichtForm] Tracking failed:', err));
        
        // Import en initialiseer de volgende stap: persoonsgegevens
        import('./rtPersoonsgegevensForm.js').then(module => {
          console.log('[tapijtOverzichtForm] Stap 5 (rtPersoonsgegevensForm) wordt geïnitialiseerd...');
          module.initRtPersoonsgegevensForm();
          goToFormStep(NEXT_FORM_NAME);
        }).catch(err => {
          console.error('[tapijtOverzichtForm] Kon stap 5 niet laden:', err);
          goToFormStep(NEXT_FORM_NAME);
        });
      }
    }
  };

  formHandler.init(schema);
  console.log('✅ [tapijtOverzichtForm] FormHandler geïnitialiseerd.');
  
  // 🔙 PREV BUTTON HANDLER - Re-initialiseer vorige stap bij terug navigeren
  setupPrevButtonHandler();
}

/**
 * Setup prev button handler voor terug navigatie
 * Re-initialiseert stap 3 (dagdelen) voordat er terug wordt genavigeerd
 */
let prevButtonHandler = null;

function setupPrevButtonHandler() {
  const prevButton = document.querySelector('[data-form-button-prev="rt_overzicht-form"]');
  
  if (!prevButton) {
    console.log('[tapijtOverzichtForm] Geen prev button gevonden met [data-form-button-prev="rt_overzicht-form"]');
    return;
  }
  
  console.log('[tapijtOverzichtForm] Prev button gevonden, event handler toevoegen...');
  
  // Verwijder oude handler indien aanwezig
  if (prevButtonHandler) {
    prevButton.removeEventListener('click', prevButtonHandler);
    console.log('[tapijtOverzichtForm] ♻️ Oude prev button handler verwijderd');
  }
  
  // Definieer nieuwe handler
  prevButtonHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[tapijtOverzichtForm] 🔙 Prev button clicked - navigeer naar stap 3 (dagdelen)');
    
    // Re-initialiseer de VORIGE stap (stap 3 = rtDagdelenForm) VOOR navigatie
    import('./rtDagdelenForm.js').then(module => {
      console.log('[tapijtOverzichtForm] ♻️ Re-init rtDagdelenForm voor terug navigatie...');
      module.initRtDagdelenForm();
      
      // NA re-init, ga naar vorige slide via Webflow functie
      if (typeof window.moveToPrevSlide === 'function') {
        console.log('[tapijtOverzichtForm] Roep window.moveToPrevSlide() aan');
        window.moveToPrevSlide();
      } else {
        console.warn('[tapijtOverzichtForm] window.moveToPrevSlide() niet beschikbaar');
      }
    }).catch(err => {
      console.error('[tapijtOverzichtForm] ❌ Fout bij re-init rtDagdelenForm:', err);
      if (typeof window.moveToPrevSlide === 'function') {
        window.moveToPrevSlide();
      }
    });
  };
  
  // Voeg nieuwe handler toe
  prevButton.addEventListener('click', prevButtonHandler);
  
  console.log('[tapijtOverzichtForm] ✅ Prev button handler toegevoegd');
}
