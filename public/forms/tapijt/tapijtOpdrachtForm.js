// public/forms/tapijt/tapijtOpdrachtForm.js
// Formulier handling voor stap 2 van de tapijt reiniging aanvraag: tapijt details

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { saveFlowData, loadFlowData } from '../logic/formStorage.js';
import { logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';

const FORM_NAME = 'rt_opdracht-form';
const NEXT_FORM_NAME = 'rt_dagdelen-form';

function goToFormStep(nextFormName) {
  console.log('[tapijtOpdrachtForm] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[tapijtOpdrachtForm] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[tapijtOpdrachtForm] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[tapijtOpdrachtForm] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[tapijtOpdrachtForm] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[tapijtOpdrachtForm] Geen slider navigatie functie gevonden.');
  return false;
}

/**
 * Verzamel geselecteerde opties
 */
function getSelectedOpties(formElement) {
  const opties = [];
  
  const optieCheckboxes = [
    { field: 'rt_opties_allergie', label: 'Anti Allergie Behandeling' },
    { field: 'rt_opties_ontgeuren_urine', label: 'Ontgeuren Urine en/of braaksel' },
    { field: 'rt_opties_ontgeuren_overig', label: 'Ontgeuren Overig (Geen Urine)' }
  ];
  
  optieCheckboxes.forEach(({ field, label }) => {
    const checkbox = formElement.querySelector(`[data-field-name="${field}"]`);
    if (checkbox && checkbox.checked) {
      opties.push(label);
    }
  });
  
  console.log('[tapijtOpdrachtForm] Geselecteerde opties:', opties);
  
  return opties;
}

/**
 * Initialiseert het opdracht formulier voor de tapijt reiniging aanvraag
 */
export function initTapijtOpdrachtForm() {
  console.log('[tapijtOpdrachtForm] Initialiseren van formulier:', FORM_NAME);
  
  // Haal het schema op
  const schema = getFormSchema(FORM_NAME);
  
  // Controleer of schema bestaat
  if (!schema) {
    console.error(`[tapijtOpdrachtForm] Schema '${FORM_NAME}' niet gevonden in formSchemas.js!`);
    return;
  }
  
  // Laad eventueel bestaande flow data
  const flowData = loadFlowData('tapijt-aanvraag');
  console.log('[tapijtOpdrachtForm] Bestaande flow data:', flowData);
  
  // Definieer de submit actie
  schema.submit = {
    action: async (formData) => {
      console.log('[tapijtOpdrachtForm] Submit action gestart met formData:', formData);
      
      const { 
        rt_totaal_m2
      } = formData;
      
      const formElement = document.querySelector(schema.selector);
      
      // Custom validatie: Minimaal 1 m² verplicht
      const m2Num = parseInt(rt_totaal_m2) || 0;
      if (m2Num < 1) {
        const error = new Error('Vul minimaal 1 m² in om door te gaan');
        error.code = 'M2_REQUIRED';
        throw error;
      }
      
      // Verzamel geselecteerde opties (niet verplicht)
      const opties = getSelectedOpties(formElement);
      
      // Sla alle gegevens op in flow data
      const updatedFlowData = loadFlowData('tapijt-aanvraag') || {};
      updatedFlowData.rt_totaal_m2 = rt_totaal_m2;
      updatedFlowData.opties = opties; // Array van labels
      
      // Sla ook individuele optie checkboxes op
      updatedFlowData.rt_opties_allergie = formData.rt_opties_allergie || false;
      updatedFlowData.rt_opties_ontgeuren_urine = formData.rt_opties_ontgeuren_urine || false;
      updatedFlowData.rt_opties_ontgeuren_overig = formData.rt_opties_ontgeuren_overig || false;
      
      saveFlowData('tapijt-aanvraag', updatedFlowData);
      
      console.log('[tapijtOpdrachtForm] Flow data opgeslagen:', updatedFlowData);
      
      // 🎯 TRACK STEP COMPLETION
      logStepCompleted('tapijt', 'opdracht', 2, {
        totaal_m2: rt_totaal_m2,
        opties: opties.join(', '),
        heeft_opties: opties.length > 0
      }).catch(err => console.warn('[tapijtOpdrachtForm] Tracking failed:', err));
    },
    
    onSuccess: () => {
      console.log('[tapijtOpdrachtForm] Submit succesvol, navigeer naar volgende stap');
      
      // Import en initialiseer de volgende stap: dagdelen keuze
      import('./rtDagdelenForm.js').then(module => {
        console.log('[tapijtOpdrachtForm] Stap 3 (rtDagdelenForm) wordt geïnitialiseerd...');
        module.initRtDagdelenForm();
        goToFormStep(NEXT_FORM_NAME);
      }).catch(err => {
        console.error('[tapijtOpdrachtForm] Kon stap 3 niet laden:', err);
        goToFormStep(NEXT_FORM_NAME);
      });
    }
  };
  
  // Initialiseer de formHandler met het bijgewerkte schema
  formHandler.init(schema);
  
  // Haal form element op
  const formElement = document.querySelector(schema.selector);
  if (!formElement) {
    console.error('[tapijtOpdrachtForm] Form element niet gevonden!');
    return;
  }
  
  // Set default waarde 0 voor number input als leeg
  const m2Input = formElement.querySelector('[data-field-name="rt_totaal_m2"]');
  if (m2Input && !m2Input.value) {
    m2Input.value = '0';
    // Update ook formHandler data
    if (formHandler.formData) {
      formHandler.formData.rt_totaal_m2 = '0';
    }
  }
  
  console.log(`✅ [tapijtOpdrachtForm] Formulier '${FORM_NAME}' is succesvol geïnitialiseerd.`);
  
  // 🔙 PREV BUTTON HANDLER - Re-initialiseer vorige stap bij terug navigeren
  setupPrevButtonHandler();
}

/**
 * Setup prev button handler voor terug navigatie
 * Re-initialiseert stap 1 (adres) voordat er terug wordt genavigeerd
 */
let prevButtonHandler = null;

function setupPrevButtonHandler() {
  const prevButton = document.querySelector('[data-form-button-prev="rt_opdracht-form"]');
  
  if (!prevButton) {
    console.log('[tapijtOpdrachtForm] Geen prev button gevonden met [data-form-button-prev="rt_opdracht-form"]');
    return;
  }
  
  console.log('[tapijtOpdrachtForm] Prev button gevonden, event handler toevoegen...');
  
  // Verwijder oude handler indien aanwezig
  if (prevButtonHandler) {
    prevButton.removeEventListener('click', prevButtonHandler);
    console.log('[tapijtOpdrachtForm] ♻️ Oude prev button handler verwijderd');
  }
  
  // Definieer nieuwe handler
  prevButtonHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[tapijtOpdrachtForm] 🔙 Prev button clicked - navigeer naar stap 1 (adres)');
    
    // Re-initialiseer de VORIGE stap (stap 1 = rtAdresForm) VOOR navigatie
    import('./rtAdresForm.js').then(module => {
      console.log('[tapijtOpdrachtForm] ♻️ Re-init rtAdresForm voor terug navigatie...');
      module.initRtAdresForm();
      
      // NA re-init, ga naar vorige slide via Webflow functie
      if (typeof window.moveToPrevSlide === 'function') {
        console.log('[tapijtOpdrachtForm] Roep window.moveToPrevSlide() aan');
        window.moveToPrevSlide();
      } else {
        console.warn('[tapijtOpdrachtForm] window.moveToPrevSlide() niet beschikbaar, probeer fallback');
        // Fallback: probeer directe Splide navigatie
        const splideEl = document.querySelector('.splide');
        if (splideEl && splideEl.splide) {
          splideEl.splide.go('-1');
        }
      }
    }).catch(err => {
      console.error('[tapijtOpdrachtForm] ❌ Fout bij re-init rtAdresForm:', err);
      // Navigeer alsnog terug bij fout
      if (typeof window.moveToPrevSlide === 'function') {
        window.moveToPrevSlide();
      }
    });
  };
  
  // Voeg nieuwe handler toe
  prevButton.addEventListener('click', prevButtonHandler);
  
  console.log('[tapijtOpdrachtForm] ✅ Prev button handler toegevoegd');
}
