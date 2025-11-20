// public/forms/vloer/rvOpdrachtForm.js
// Formulier handling voor stap 2 van de vloer reiniging aanvraag: vloer details

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { saveFlowData, loadFlowData } from '../logic/formStorage.js';
import { logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';

const FORM_NAME = 'rv_opdracht-form';
const NEXT_FORM_NAME = 'rv_dagdelen-form';

function goToFormStep(nextFormName) {
  console.log('[rvOpdrachtForm] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[rvOpdrachtForm] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[rvOpdrachtForm] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[rvOpdrachtForm] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[rvOpdrachtForm] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[rvOpdrachtForm] Geen slider navigatie functie gevonden.');
  return false;
}

/**
 * Verzamel geselecteerde vloer types
 */
function getSelectedVloerTypes(formElement) {
  const types = [];
  
  const typeCheckboxes = [
    { field: 'rv_type_natuursteen', label: 'Natuursteen' },
    { field: 'rv_type_marmer', label: 'Marmer' },
    { field: 'rv_type_hout', label: 'Hout (parket/laminaat)' },
    { field: 'rv_type_pvc', label: 'PVC' },
    { field: 'rv_type_linoleum', label: 'Linoleum' },
    { field: 'rv_type_tegels', label: 'Tegels (keramisch/porselein)' },
    { field: 'rv_type_beton', label: 'Beton/Epoxy' },
    { field: 'rv_type_vinyl', label: 'Vinyl' }
  ];
  
  typeCheckboxes.forEach(({ field, label }) => {
    const checkbox = formElement.querySelector(`[data-field-name="${field}"]`);
    if (checkbox && checkbox.checked) {
      types.push(label);
    }
  });
  
  console.log('[rvOpdrachtForm] Geselecteerde vloer types:', types);
  
  return types;
}

/**
 * Initialiseert het opdracht formulier voor de vloer reiniging aanvraag
 */
export function initRvOpdrachtForm() {
  console.log('[rvOpdrachtForm] Initialiseren van formulier:', FORM_NAME);
  
  // Haal het schema op
  const schema = getFormSchema(FORM_NAME);
  
  // Controleer of schema bestaat
  if (!schema) {
    console.error(`[rvOpdrachtForm] Schema '${FORM_NAME}' niet gevonden in formSchemas.js!`);
    return;
  }
  
  // Laad eventueel bestaande flow data
  const flowData = loadFlowData('vloer-aanvraag');
  console.log('[rvOpdrachtForm] Bestaande flow data:', flowData);
  
  // Definieer de submit actie
  schema.submit = {
    action: async (formData) => {
      console.log('[rvOpdrachtForm] Submit action gestart met formData:', formData);
      
      const { 
        rv_oppervlakte_m2
      } = formData;
      
      const formElement = document.querySelector(schema.selector);
      
      // Custom validatie: Minimaal 1 m² verplicht
      const m2Num = parseInt(rv_oppervlakte_m2) || 0;
      if (m2Num < 1) {
        const error = new Error('Vul minimaal 1 m² in om door te gaan');
        error.code = 'M2_REQUIRED';
        throw error;
      }
      
      // Verzamel geselecteerde vloer types (minimaal 1 verplicht)
      const vloerTypes = getSelectedVloerTypes(formElement);
      
      if (vloerTypes.length === 0) {
        const error = new Error('Selecteer minimaal één type vloer');
        error.code = 'TYPE_REQUIRED';
        throw error;
      }
      
      // Sla alle gegevens op in flow data
      const updatedFlowData = loadFlowData('vloer-aanvraag') || {};
      updatedFlowData.rv_oppervlakte_m2 = rv_oppervlakte_m2;
      updatedFlowData.vloer_types = vloerTypes; // Array van labels
      
      // Sla ook individuele type checkboxes op
      updatedFlowData.rv_type_natuursteen = formData.rv_type_natuursteen || false;
      updatedFlowData.rv_type_marmer = formData.rv_type_marmer || false;
      updatedFlowData.rv_type_hout = formData.rv_type_hout || false;
      updatedFlowData.rv_type_pvc = formData.rv_type_pvc || false;
      updatedFlowData.rv_type_linoleum = formData.rv_type_linoleum || false;
      updatedFlowData.rv_type_tegels = formData.rv_type_tegels || false;
      updatedFlowData.rv_type_beton = formData.rv_type_beton || false;
      updatedFlowData.rv_type_vinyl = formData.rv_type_vinyl || false;
      
      saveFlowData('vloer-aanvraag', updatedFlowData);
      
      console.log('[rvOpdrachtForm] Flow data opgeslagen:', updatedFlowData);
      
      // 🎯 TRACK STEP COMPLETION
      logStepCompleted('vloerreinigen', 'opdracht', 2, {
        oppervlakte_m2: rv_oppervlakte_m2,
        vloer_types: vloerTypes.join(', '),
        aantal_types: vloerTypes.length
      }).catch(err => console.warn('[rvOpdrachtForm] Tracking failed:', err));
    },
    
    onSuccess: () => {
      console.log('[rvOpdrachtForm] Submit succesvol, navigeer naar volgende stap');
      
      // Import en initialiseer de volgende stap: dagdelen keuze
      import('./rvDagdelenForm.js').then(module => {
        console.log('[rvOpdrachtForm] Stap 3 (rvDagdelenForm) wordt geïnitialiseerd...');
        module.initRvDagdelenForm();
        goToFormStep(NEXT_FORM_NAME);
      }).catch(err => {
        console.error('[rvOpdrachtForm] Kon stap 3 niet laden:', err);
        goToFormStep(NEXT_FORM_NAME);
      });
    }
  };
  
  // Initialiseer de formHandler met het bijgewerkte schema
  formHandler.init(schema);
  
  // Haal form element op
  const formElement = document.querySelector(schema.selector);
  if (!formElement) {
    console.error('[rvOpdrachtForm] Form element niet gevonden!');
    return;
  }
  
  // Set default waarde 0 voor number input als leeg
  const m2Input = formElement.querySelector('[data-field-name="rv_oppervlakte_m2"]');
  if (m2Input && !m2Input.value) {
    m2Input.value = '0';
    // Update ook formHandler data
    if (formHandler.formData) {
      formHandler.formData.rv_oppervlakte_m2 = '0';
    }
  }
  
  console.log(`✅ [rvOpdrachtForm] Formulier '${FORM_NAME}' is succesvol geïnitialiseerd.`);
  
  // 🔙 PREV BUTTON HANDLER - Re-initialiseer vorige stap bij terug navigeren
  setupPrevButtonHandler();
}

/**
 * Setup prev button handler voor terug navigatie
 * Re-initialiseert stap 1 (adres) voordat er terug wordt genavigeerd
 */
let prevButtonHandler = null;

function setupPrevButtonHandler() {
  const prevButton = document.querySelector('[data-form-button-prev="rv_opdracht-form"]');
  
  if (!prevButton) {
    console.log('[rvOpdrachtForm] Geen prev button gevonden met [data-form-button-prev="rv_opdracht-form"]');
    return;
  }
  
  console.log('[rvOpdrachtForm] Prev button gevonden, event handler toevoegen...');
  
  // Verwijder oude handler indien aanwezig
  if (prevButtonHandler) {
    prevButton.removeEventListener('click', prevButtonHandler);
    console.log('[rvOpdrachtForm] ♻️ Oude prev button handler verwijderd');
  }
  
  // Definieer nieuwe handler
  prevButtonHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[rvOpdrachtForm] 🔙 Prev button clicked - navigeer naar stap 1 (adres)');
    
    // Re-initialiseer de VORIGE stap (stap 1 = rvAdresForm) VOOR navigatie
    import('./rvAdresForm.js').then(module => {
      console.log('[rvOpdrachtForm] ♻️ Re-init rvAdresForm voor terug navigatie...');
      module.initRvAdresForm();
      
      // NA re-init, ga naar vorige slide via Webflow functie
      if (typeof window.moveToPrevSlide === 'function') {
        console.log('[rvOpdrachtForm] Roep window.moveToPrevSlide() aan');
        window.moveToPrevSlide();
      } else {
        console.warn('[rvOpdrachtForm] window.moveToPrevSlide() niet beschikbaar, probeer fallback');
        // Fallback: probeer directe Splide navigatie
        const splideEl = document.querySelector('.splide');
        if (splideEl && splideEl.splide) {
          splideEl.splide.go('-1');
        }
      }
    }).catch(err => {
      console.error('[rvOpdrachtForm] ❌ Fout bij re-init rvAdresForm:', err);
      // Navigeer alsnog terug bij fout
      if (typeof window.moveToPrevSlide === 'function') {
        window.moveToPrevSlide();
      }
    });
  };
  
  // Voeg nieuwe handler toe
  prevButton.addEventListener('click', prevButtonHandler);
  
  console.log('[rvOpdrachtForm] ✅ Prev button handler toegevoegd');
}
