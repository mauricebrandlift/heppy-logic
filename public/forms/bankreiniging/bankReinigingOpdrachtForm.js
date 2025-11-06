// public/forms/bankreiniging/bankReinigingOpdrachtForm.js
// Formulier handling voor stap 2 van de bank & stoelen reiniging aanvraag: meubel details

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { saveFlowData, loadFlowData } from '../logic/formStorage.js';
import { showError, hideError } from '../ui/formUi.js';
import { logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';

const FORM_NAME = 'rbs_opdracht-form';
const NEXT_FORM_NAME = 'rbs_dagdelen-form';

function goToFormStep(nextFormName) {
  console.log('[bankReinigingOpdrachtForm] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[bankReinigingOpdrachtForm] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[bankReinigingOpdrachtForm] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[bankReinigingOpdrachtForm] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[bankReinigingOpdrachtForm] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[bankReinigingOpdrachtForm] Geen slider navigatie functie gevonden.');
  return false;
}

/**
 * Custom validatie: minimaal 1 bank OF 1 stoel moet ingevuld zijn
 */
function validateMeubelAantallen(formData, formElement) {
  const banken = parseInt(formData.rbs_banken) || 0;
  const stoelen = parseInt(formData.rbs_stoelen) || 0;
  
  const totaal = banken + stoelen;
  
  console.log(`[bankReinigingOpdrachtForm] Validatie meubels: ${banken} banken + ${stoelen} stoelen = ${totaal}`);
  
  if (totaal < 1) {
    // Toon error in UI
    console.log('[bankReinigingOpdrachtForm] ⚠️ Totaal < 1, toon error');
    if (formElement) {
      const errorContainer = formElement.querySelector('[data-error-for="global"]');
      console.log('[bankReinigingOpdrachtForm] Error container gevonden:', !!errorContainer);
      if (errorContainer) {
        console.log('[bankReinigingOpdrachtForm] showError aangeroepen voor global error');
        showError(errorContainer, 'Vul minimaal 1 bank of 1 stoel in om door te gaan');
      } else {
        console.error('[bankReinigingOpdrachtForm] ❌ Geen [data-error-for="global"] element gevonden!');
      }
    } else {
      console.error('[bankReinigingOpdrachtForm] ❌ Geen formElement beschikbaar!');
    }
    
    return {
      valid: false,
      error: 'Vul minimaal 1 bank of 1 stoel in om door te gaan'
    };
  }
  
  return { valid: true };
}

/**
 * Valideer materiaal selectie en toon UI feedback
 */
function validateMaterialen(formElement) {
  const materialen = getSelectedMaterialen(formElement);
  
  console.log(`[bankReinigingOpdrachtForm] Validatie materialen: ${materialen.length} geselecteerd`);
  
  const errorContainer = formElement.querySelector('[data-error-for="rbs_materialen"]');
  
  if (materialen.length === 0) {
    if (errorContainer) {
      showError(errorContainer, 'Selecteer minimaal één materiaal');
    }
    return {
      valid: false,
      error: 'Selecteer minimaal één materiaal'
    };
  }
  
  // Verberg error als er wel materialen zijn geselecteerd
  if (errorContainer) {
    hideError(errorContainer);
  }
  
  return { valid: true };
}

/**
 * Verzamel geselecteerde materialen
 */
function getSelectedMaterialen(formElement) {
  const materialen = [];
  
  const materiaalCheckboxes = [
    { field: 'materiaal_stof', label: 'Stof' },
    { field: 'materiaal_leer', label: 'Leer' },
    { field: 'materiaal_kunstleer', label: 'Kunstleer' },
    { field: 'materiaal_fluweel', label: 'Fluweel' },
    { field: 'materiaal_suede', label: 'Suede' },
    { field: 'materiaal_anders', label: 'Weet ik niet / Anders' }
  ];
  
  materiaalCheckboxes.forEach(({ field, label }) => {
    const checkbox = formElement.querySelector(`[data-field-name="${field}"]`);
    if (checkbox && checkbox.checked) {
      materialen.push(label);
    }
  });
  
  console.log('[bankReinigingOpdrachtForm] Geselecteerde materialen:', materialen);
  
  return materialen;
}

/**
 * Initialiseert het opdracht formulier voor de bank & stoelen reiniging aanvraag
 */
export function initBankReinigingOpdrachtForm() {
  console.log('[bankReinigingOpdrachtForm] Initialiseren van formulier:', FORM_NAME);
  
  // Haal het schema op
  const schema = getFormSchema(FORM_NAME);
  
  // Controleer of schema bestaat
  if (!schema) {
    console.error(`[bankReinigingOpdrachtForm] Schema '${FORM_NAME}' niet gevonden in formSchemas.js!`);
    return;
  }
  
  // Laad eventueel bestaande flow data
  const flowData = loadFlowData('bankreiniging-aanvraag');
  console.log('[bankReinigingOpdrachtForm] Bestaande flow data:', flowData);
  
  // Definieer de submit actie
  schema.submit = {
    action: async (formData) => {
      console.log('[bankReinigingOpdrachtForm] Submit action gestart met formData:', formData);
      
      const { 
        rbs_banken, 
        rbs_stoelen, 
        rbs_zitvlakken, 
        rbs_kussens,
        rbs_specificaties
      } = formData;
      
      const formElement = document.querySelector(schema.selector);
      
      // Verzamel alle validatie errors EERST voordat we iets gooien
      let hasErrors = false;
      
      // Validatie 1: Zitvlakken minimaal 1
      const zitvlakkenNum = parseInt(rbs_zitvlakken) || 0;
      if (zitvlakkenNum < 1) {
        hasErrors = true;
        // Toon field-specific error
        const zitvlakkenField = formElement.querySelector('[data-field-name="rbs_zitvlakken"]');
        const errorContainer = formElement.querySelector('[data-error-for="rbs_zitvlakken"]');
        
        if (errorContainer) {
          showError(errorContainer, 'Vul minimaal 1 zitvlak in');
        }
        if (zitvlakkenField) {
          zitvlakkenField.classList.add('input-error');
        }
      }
      
      // Validatie 2: Minimaal 1 bank OF stoel
      const meubelValidatie = validateMeubelAantallen(formData, formElement);
      if (!meubelValidatie.valid) {
        hasErrors = true;
        // Error is al getoond in validateMeubelAantallen functie
      }
      
      // Validatie 3: Minimaal 1 materiaal geselecteerd
      const materiaalValidatie = validateMaterialen(formElement);
      if (!materiaalValidatie.valid) {
        hasErrors = true;
        // Error is al getoond in validateMaterialen functie
      }
      
      // Als er errors zijn, gooi één error met alle info
      if (hasErrors) {
        const error = new Error('Controleer de formuliervelden en probeer opnieuw');
        error.code = 'VALIDATION_FAILED';
        throw error;
      }
      
      // Verzamel geselecteerde materialen
      const materialen = getSelectedMaterialen(formElement);
      
      // Sla alle gegevens op in flow data
      const updatedFlowData = loadFlowData('bankreiniging-aanvraag') || {};
      updatedFlowData.rbs_banken = rbs_banken;
      updatedFlowData.rbs_stoelen = rbs_stoelen;
      updatedFlowData.rbs_zitvlakken = rbs_zitvlakken;
      updatedFlowData.rbs_kussens = rbs_kussens || '0'; // Default 0 als leeg
      updatedFlowData.rbs_specificaties = rbs_specificaties || '';
      updatedFlowData.materialen = materialen; // Array van labels
      
      // Sla ook individuele materiaal checkboxes op
      updatedFlowData.materiaal_stof = formData.materiaal_stof || false;
      updatedFlowData.materiaal_leer = formData.materiaal_leer || false;
      updatedFlowData.materiaal_kunstleer = formData.materiaal_kunstleer || false;
      updatedFlowData.materiaal_fluweel = formData.materiaal_fluweel || false;
      updatedFlowData.materiaal_suede = formData.materiaal_suede || false;
      updatedFlowData.materiaal_anders = formData.materiaal_anders || false;
      
      saveFlowData('bankreiniging-aanvraag', updatedFlowData);
      
      console.log('[bankReinigingOpdrachtForm] Flow data opgeslagen:', updatedFlowData);
      
      // 🎯 TRACK STEP COMPLETION
      logStepCompleted('bankreiniging', 'opdracht', 2, {
        banken: rbs_banken,
        stoelen: rbs_stoelen,
        zitvlakken: rbs_zitvlakken,
        kussens: rbs_kussens || '0',
        materialen: materialen.join(', '),
        heeft_specificaties: !!rbs_specificaties
      }).catch(err => console.warn('[bankReinigingOpdrachtForm] Tracking failed:', err));
    },
    
    onSuccess: () => {
      console.log('[bankReinigingOpdrachtForm] Submit succesvol, navigeer naar volgende stap');
      
      // Import en initialiseer de volgende stap: dagdelen keuze
      import('./rbsDagdelenForm.js').then(module => {
        console.log('[bankReinigingOpdrachtForm] Stap 3 (rbsDagdelenForm) wordt geïnitialiseerd...');
        module.initRbsDagdelenForm();
        goToFormStep(NEXT_FORM_NAME);
      }).catch(err => {
        console.error('[bankReinigingOpdrachtForm] Kon stap 3 niet laden:', err);
        goToFormStep(NEXT_FORM_NAME);
      });
    }
  };
  
  // Initialiseer de formHandler met het bijgewerkte schema
  formHandler.init(schema);
  
  // Haal form element op
  const formElement = document.querySelector(schema.selector);
  if (!formElement) {
    console.error('[bankReinigingOpdrachtForm] Form element niet gevonden!');
    return;
  }
  
  // Set default waarde 0 voor number inputs als ze leeg zijn
  const numberFields = ['rbs_banken', 'rbs_stoelen', 'rbs_zitvlakken', 'rbs_kussens'];
  numberFields.forEach(fieldName => {
    const input = formElement.querySelector(`[data-field-name="${fieldName}"]`);
    if (input && !input.value) {
      input.value = '0';
      // Update ook formHandler data
      if (formHandler.formData) {
        formHandler.formData[fieldName] = '0';
      }
    }
  });
  
  // Setup live validatie voor materiaal checkboxes
  const materiaalCheckboxes = formElement.querySelectorAll('[data-field-name^="materiaal_"]');
  materiaalCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      console.log(`[bankReinigingOpdrachtForm] Materiaal checkbox gewijzigd: ${checkbox.dataset.fieldName}`);
      // Valideer materialen bij elke wijziging (verberg error als er nu wel een materiaal is geselecteerd)
      validateMaterialen(formElement);
    });
  });
  
  // Doe GEEN initiële validatie van materialen (toon pas error bij submit)
  // De error wordt alleen getoond als gebruiker probeert te submitten zonder materiaal
  
  console.log(`✅ [bankReinigingOpdrachtForm] Formulier '${FORM_NAME}' is succesvol geïnitialiseerd.`);
  
  // 🔙 PREV BUTTON HANDLER - Re-initialiseer vorige stap bij terug navigeren
  setupPrevButtonHandler();
}

/**
 * Setup prev button handler voor terug navigatie
 * Re-initialiseert stap 1 (adres) voordat er terug wordt genavigeerd
 */
let prevButtonHandler = null;

function setupPrevButtonHandler() {
  const prevButton = document.querySelector('[data-form-button-prev="rbs_opdracht-form"]');
  
  if (!prevButton) {
    console.log('[bankReinigingOpdrachtForm] Geen prev button gevonden met [data-form-button-prev="rbs_opdracht-form"]');
    return;
  }
  
  console.log('[bankReinigingOpdrachtForm] Prev button gevonden, event handler toevoegen...');
  
  // Verwijder oude handler indien aanwezig
  if (prevButtonHandler) {
    prevButton.removeEventListener('click', prevButtonHandler);
    console.log('[bankReinigingOpdrachtForm] ♻️ Oude prev button handler verwijderd');
  }
  
  // Definieer nieuwe handler
  prevButtonHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[bankReinigingOpdrachtForm] 🔙 Prev button clicked - navigeer naar stap 1 (adres)');
    
    // Re-initialiseer de VORIGE stap (stap 1 = rbsAdresForm) VOOR navigatie
    import('./rbsAdresForm.js').then(module => {
      console.log('[bankReinigingOpdrachtForm] ♻️ Re-init rbsAdresForm voor terug navigatie...');
      module.initRbsAdresForm();
      
      // NA re-init, ga naar vorige slide via Webflow functie
      if (typeof window.moveToPrevSlide === 'function') {
        console.log('[bankReinigingOpdrachtForm] Roep window.moveToPrevSlide() aan');
        window.moveToPrevSlide();
      } else {
        console.warn('[bankReinigingOpdrachtForm] window.moveToPrevSlide() niet beschikbaar, probeer fallback');
        // Fallback: probeer directe Splide navigatie
        const splideEl = document.querySelector('.splide');
        if (splideEl && splideEl.splide) {
          splideEl.splide.go('-1');
        }
      }
    }).catch(err => {
      console.error('[bankReinigingOpdrachtForm] ❌ Fout bij re-init rbsAdresForm:', err);
      // Navigeer alsnog terug bij fout
      if (typeof window.moveToPrevSlide === 'function') {
        window.moveToPrevSlide();
      }
    });
  };
  
  // Voeg nieuwe handler toe
  prevButton.addEventListener('click', prevButtonHandler);
  
  console.log('[bankReinigingOpdrachtForm] ✅ Prev button handler toegevoegd');
}
