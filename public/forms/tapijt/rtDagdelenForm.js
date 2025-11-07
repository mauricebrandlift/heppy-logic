// public/forms/tapijt/rtDagdelenForm.js
// Formulier handling voor stap 3 van de tapijt reiniging aanvraag: dagdelen voorkeur

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { saveFlowData, loadFlowData } from '../logic/formStorage.js';
import { collectDagdelen, convertDagdelenToDBFormat } from '../logic/dagdelenLogic.js';
import { logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';

const FORM_NAME = 'rt_dagdelen-form';
const NEXT_FORM_NAME = 'rt_overzicht-form';

function goToFormStep(nextFormName) {
  console.log('[rtDagdelenForm] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[rtDagdelenForm] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[rtDagdelenForm] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[rtDagdelenForm] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[rtDagdelenForm] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[rtDagdelenForm] Geen slider navigatie functie gevonden.');
  return false;
}

/**
 * Initialiseert het dagdelen voorkeur formulier
 */
export function initRtDagdelenForm() {
  console.log('[rtDagdelenForm] Initialiseren van formulier:', FORM_NAME);
  
  // Haal schema op
  const schema = getFormSchema(FORM_NAME);
  if (!schema) {
    console.error(`❌ [rtDagdelenForm] Schema niet gevonden voor ${FORM_NAME}`);
    return;
  }
  
  // Laad bestaande flow data
  const flowData = loadFlowData('tapijt-aanvraag') || {};
  console.log('[rtDagdelenForm] Bestaande flow data:', flowData);
  
  // Submit action
  schema.submit = {
    action: async (formData) => {
      console.log('[rtDagdelenForm] Submit action gestart met formData:', formData);
      
      const formElement = document.querySelector(schema.selector);
      if (!formElement) {
        console.error('[rtDagdelenForm] Form element niet gevonden');
        throw new Error('Formulier niet gevonden');
      }
      
      // Verzamel dagdelen selecties via dagdelenLogic helper
      const dagdelenData = collectDagdelen(formElement);
      console.log('[rtDagdelenForm] Dagdelen data verzameld:', dagdelenData);
      
      // Converteer naar DB formaat
      const dagdelenDB = convertDagdelenToDBFormat(dagdelenData.regulier);
      console.log('[rtDagdelenForm] Dagdelen DB formaat:', dagdelenDB);
      
      // Sla op in flow data
      const updatedFlowData = loadFlowData('tapijt-aanvraag') || {};
      updatedFlowData.geenVoorkeurDagdelen = dagdelenData.geenVoorkeur;
      
      if (!dagdelenData.geenVoorkeur && Object.keys(dagdelenDB).length > 0) {
        // Reguliere dagdelen geselecteerd
        updatedFlowData.dagdelenVoorkeur = dagdelenDB;
        console.log('[rtDagdelenForm] Dagdelen opgeslagen (DB formaat):', dagdelenDB);
      } else {
        // Geen reguliere dagdelen, verwijder uit flow data
        delete updatedFlowData.dagdelenVoorkeur;
        console.log('[rtDagdelenForm] Geen reguliere dagdelen geselecteerd');
      }
      
      saveFlowData('tapijt-aanvraag', updatedFlowData);
      console.log('[rtDagdelenForm] Flow data opgeslagen:', updatedFlowData);
      
      // 🎯 TRACK STEP COMPLETION
      await logStepCompleted('tapijt', 'dagdelen', 3, {
        geenVoorkeur: dagdelenData.geenVoorkeur,
        aantalDagdelen: dagdelenData.geenVoorkeur ? 0 : Object.keys(dagdelenDB).length
      }).catch(err => console.warn('[rtDagdelenForm] Tracking failed:', err));
    },
    onSuccess: () => {
      console.log('[rtDagdelenForm] Submit success, navigeer naar stap 4 (overzicht)...');
      
      // Import en initialiseer de volgende stap: overzicht
      import('./tapijtOverzichtForm.js').then(module => {
        console.log('[rtDagdelenForm] Stap 4 (tapijtOverzichtForm) wordt geïnitialiseerd...');
        module.initTapijtOverzichtForm();
        goToFormStep(NEXT_FORM_NAME);
      }).catch(err => {
        console.error('[rtDagdelenForm] Kon stap 4 niet laden:', err);
        goToFormStep(NEXT_FORM_NAME);
      });
    }
  };
  
  // Initialiseer formHandler
  formHandler.init(schema);
  
  console.log(`✅ [rtDagdelenForm] Formulier '${FORM_NAME}' is succesvol geïnitialiseerd.`);
  
  // 🔙 PREV BUTTON HANDLER - Re-initialiseer vorige stap bij terug navigeren
  setupPrevButtonHandler();
}

/**
 * Setup prev button handler voor terug navigatie
 * Re-initialiseert stap 2 (opdracht) voordat er terug wordt genavigeerd
 */
let prevButtonHandler = null;

function setupPrevButtonHandler() {
  const prevButton = document.querySelector('[data-form-button-prev="rt_dagdelen-form"]');
  
  if (!prevButton) {
    console.log('[rtDagdelenForm] Geen prev button gevonden met [data-form-button-prev="rt_dagdelen-form"]');
    return;
  }
  
  console.log('[rtDagdelenForm] Prev button gevonden, event handler toevoegen...');
  
  // Verwijder oude handler indien aanwezig
  if (prevButtonHandler) {
    prevButton.removeEventListener('click', prevButtonHandler);
    console.log('[rtDagdelenForm] ♻️ Oude prev button handler verwijderd');
  }
  
  // Definieer nieuwe handler
  prevButtonHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[rtDagdelenForm] 🔙 Prev button clicked - navigeer naar stap 2 (opdracht)');
    
    // Re-initialiseer de VORIGE stap (stap 2 = tapijtOpdrachtForm) VOOR navigatie
    import('./tapijtOpdrachtForm.js').then(module => {
      console.log('[rtDagdelenForm] ♻️ Re-init tapijtOpdrachtForm voor terug navigatie...');
      module.initTapijtOpdrachtForm();
      
      // NA re-init, ga naar vorige slide via Webflow functie
      if (typeof window.moveToPrevSlide === 'function') {
        console.log('[rtDagdelenForm] Roep window.moveToPrevSlide() aan');
        window.moveToPrevSlide();
      } else {
        console.warn('[rtDagdelenForm] window.moveToPrevSlide() niet beschikbaar');
      }
    }).catch(err => {
      console.error('[rtDagdelenForm] ❌ Fout bij re-init tapijtOpdrachtForm:', err);
      if (typeof window.moveToPrevSlide === 'function') {
        window.moveToPrevSlide();
      }
    });
  };
  
  // Voeg nieuwe handler toe
  prevButton.addEventListener('click', prevButtonHandler);
  
  console.log('[rtDagdelenForm] ✅ Prev button handler toegevoegd');
}
