// public/forms/bankreiniging/bankReinigingOverzichtForm.js
// Overzicht-stap bank & stoelen reiniging: toont samenvatting van alle ingevulde gegevens

import { loadFlowData } from '../logic/formStorage.js';
import { formHandler } from '../logic/formHandler.js';
import { logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';
import { DAGEN } from '../logic/dagdelenHelper.js';

const FORM_NAME = 'rbs_overzicht-form';
const FORM_SELECTOR = `[data-form-name="${FORM_NAME}"]`;
const NEXT_FORM_NAME = 'rbs_persoonsgegevens-form';

function goToFormStep(nextFormName) {
  console.log(`[bankReinigingOverzichtForm] goToFormStep → ${nextFormName}`);
  
  const targetSlide = document.querySelector(`[data-form-name="${nextFormName}"]`);
  if (targetSlide) {
    const splideInstance = document.querySelector('.splide');
    if (splideInstance && splideInstance.splide) {
      const slideIndex = Array.from(splideInstance.splide.Components.Slides.slides)
        .findIndex(slide => slide.slide.contains(targetSlide));
      
      if (slideIndex !== -1) {
        splideInstance.splide.go(slideIndex);
        return;
      }
    }
  }
  
  console.log('[bankReinigingOverzichtForm] Fallback moveToNextSlide (geen target match)');
  const moveEvent = new CustomEvent('moveToNextSlide');
  document.dispatchEvent(moveEvent);
}

function setText(selector, text) {
  const els = document.querySelectorAll(selector);
  els.forEach((el) => { if (el) el.textContent = text ?? ''; });
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
  
  // Converteer naar leesbare lijst
  const dagdeelStrings = [];
  
  // Mapping van volledige dagnamen naar afkortingen
  const dagAfkortingen = {
    'maandag': 'Ma',
    'dinsdag': 'Di',
    'woensdag': 'Wo',
    'donderdag': 'Do',
    'vrijdag': 'Vr',
    'zaterdag': 'Za',
    'zondag': 'Zo'
  };
  
  // Mapping van dagdelen naar emoji/iconen
  const dagdeelIconen = {
    'ochtend': '🌅',
    'middag': '☀️',
    'avond': '🌙'
  };
  
  for (const [dag, dagdelen] of Object.entries(dagdelenDB)) {
    const dagAfkorting = dagAfkortingen[dag] || dag;
    const dagdeelLabels = dagdelen.map(d => {
      const icoon = dagdeelIconen[d] || '';
      return `${icoon} ${d}`;
    }).join(', ');
    
    dagdeelStrings.push(`${dagAfkorting}: ${dagdeelLabels}`);
  }
  
  return dagdeelStrings.join(' • ');
}

/**
 * Format meubels info voor display
 * Toont alleen aantal banken en stoelen
 * @param {Object} flow - Flow data
 * @returns {string} - Geformatteerde meubels info
 */
function formatMeubels(flow) {
  const parts = [];
  
  // Alleen banken en stoelen
  const banken = parseInt(flow.rbs_banken) || 0;
  const stoelen = parseInt(flow.rbs_stoelen) || 0;
  
  if (banken > 0) {
    parts.push(`${banken} ${banken === 1 ? 'bank' : 'banken'}`);
  }
  if (stoelen > 0) {
    parts.push(`${stoelen} ${stoelen === 1 ? 'stoel' : 'stoelen'}`);
  }
  
  return parts.length > 0 ? parts.join(', ') : '—';
}

/**
 * Initialiseer het overzicht formulier
 */
export function initBankReinigingOverzichtForm() {
  console.log('🧾 [bankReinigingOverzichtForm] Initialiseren overzicht…');
  
  const flow = loadFlowData('bankreiniging-aanvraag') || {};
  console.log('[bankReinigingOverzichtForm] Flow data:', flow);

  // Adres en plaats
  const adresParts = [flow.straatnaam, flow.huisnummer, flow.toevoeging].filter(Boolean);
  setText('[data-overview="adres"]', adresParts.join(' '));
  setText('[data-overview="plaats"]', flow.plaats || '—');

  // Dagdelen voorkeur
  const dagdelenText = formatDagdelen(flow.dagdelenVoorkeur, flow.geenVoorkeurDagdelen);
  setText('[data-overview="dagdelen"]', dagdelenText);

  // Meubels (banken, stoelen, zitvlakken, kussens, materialen)
  const meubelsText = formatMeubels(flow);
  setText('[data-overview="meubels"]', meubelsText);

  console.log('✅ [bankReinigingOverzichtForm] Overzicht gevuld.');

  // Initialiseer deze stap als "formulier" zodat de Webflow-knop via formHandler werkt
  const schema = {
    name: FORM_NAME,
    selector: FORM_SELECTOR,
    fields: {},
    submit: {
      action: async () => {
        // Geen extra actie; alle data is al in de flow bewaard door eerdere stappen
        console.log('[bankReinigingOverzichtForm] Submit action - geen extra validatie nodig');
      },
      onSuccess: async () => {
        console.log('[bankReinigingOverzichtForm] Submit success, navigeer naar stap 5 (persoonsgegevens)...');
        
        // Track step 4 completion
        await logStepCompleted('bankreiniging', 'overzicht', 4, {
          heeftDagdelenVoorkeur: !!flow.dagdelenVoorkeur,
          geenVoorkeurDagdelen: flow.geenVoorkeurDagdelen,
          aantalBanken: flow.rbs_banken,
          aantalStoelen: flow.rbs_stoelen
        }).catch(err => console.warn('[bankReinigingOverzichtForm] Tracking failed:', err));
        
        // Lazy load persoonsgegevens stap
        import('./rbsPersoonsgegevensForm.js')
          .then((m) => {
            console.log('[bankReinigingOverzichtForm] rbsPersoonsgegevensForm module geladen');
            if (m && typeof m.initRbsPersoonsgegevensForm === 'function') {
              m.initRbsPersoonsgegevensForm();
            }
            goToFormStep(NEXT_FORM_NAME);
          })
          .catch((err) => {
            console.error('[bankReinigingOverzichtForm] Kon persoonsgegevens stap niet laden:', err);
            goToFormStep(NEXT_FORM_NAME);
          });
      }
    }
  };
  
  try {
    formHandler.init(schema);
    console.log('[bankReinigingOverzichtForm] FormHandler geïnitialiseerd');
  } catch (e) {
    console.warn('[bankReinigingOverzichtForm] Kon formHandler niet initialiseren voor overzicht:', e);
  }
  
  // 🔙 PREV BUTTON HANDLER - Re-initialiseer vorige stap bij terug navigeren
  setupPrevButtonHandler();
}

/**
 * Setup prev button handler voor terug navigatie
 * Re-initialiseert stap 3 (dagdelen) voordat er terug wordt genavigeerd
 */
let prevButtonHandler = null;

function setupPrevButtonHandler() {
  const prevButton = document.querySelector('[data-form-button-prev="rbs_overzicht-form"]');
  
  if (!prevButton) {
    console.log('[bankReinigingOverzichtForm] Geen prev button gevonden met [data-form-button-prev="rbs_overzicht-form"]');
    return;
  }
  
  console.log('[bankReinigingOverzichtForm] Prev button gevonden, event handler toevoegen...');
  
  // Verwijder oude handler indien aanwezig
  if (prevButtonHandler) {
    prevButton.removeEventListener('click', prevButtonHandler);
    console.log('[bankReinigingOverzichtForm] ♻️ Oude prev button handler verwijderd');
  }
  
  // Definieer nieuwe handler
  prevButtonHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[bankReinigingOverzichtForm] 🔙 Prev button clicked - navigeer naar stap 3 (dagdelen)');
    
    // Re-initialiseer de VORIGE stap (stap 3 = rbsDagdelenForm) VOOR navigatie
    import('./rbsDagdelenForm.js').then(module => {
      console.log('[bankReinigingOverzichtForm] ♻️ Re-init rbsDagdelenForm voor terug navigatie...');
      module.initRbsDagdelenForm();
      
      // Navigeer terug
      goToFormStep('rbs_dagdelen-form');
    }).catch(err => {
      console.error('[bankReinigingOverzichtForm] ❌ Fout bij re-init rbsDagdelenForm:', err);
      goToFormStep('rbs_dagdelen-form'); // Probeer toch te navigeren
    });
  };
  
  // Voeg nieuwe handler toe
  prevButton.addEventListener('click', prevButtonHandler);
  
  console.log('[bankReinigingOverzichtForm] ✅ Prev button handler toegevoegd');
}
