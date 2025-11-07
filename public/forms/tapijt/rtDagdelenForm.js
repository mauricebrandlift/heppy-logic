// public/forms/tapijt/rtDagdelenForm.js
// Formulier handling voor stap 3 van de tapijt reiniging aanvraag: dagdelen voorkeur

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { saveFlowData, loadFlowData } from '../logic/formStorage.js';
import { logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';
import { convertUIDagdelenNaarDB } from '../logic/dagdelenHelper.js';

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
 * Verzamel alle geselecteerde dagdelen (inclusief "geen voorkeur")
 * @param {HTMLElement} formElement - Het formulier element
 * @returns {Array<string>} - Array van data-dagdeel waarden
 */
function getSelectedDagdelenIncludingNoPreference(formElement) {
  const checkboxes = formElement.querySelectorAll('input[type="checkbox"][data-field-name="dagdeel"]:checked');
  return Array.from(checkboxes)
    .map(cb => cb.getAttribute('data-dagdeel'))
    .filter(Boolean);
}

/**
 * Check of "geen voorkeur" is geselecteerd
 * @param {Array<string>} selectedDagdelen - Array van geselecteerde dagdeel waarden
 * @returns {boolean}
 */
function hasNoPreference(selectedDagdelen) {
  return selectedDagdelen.includes('geen-voorkeur');
}

/**
 * Haal reguliere dagdelen (excl. "geen voorkeur")
 * @param {Array<string>} selectedDagdelen - Array van geselecteerde dagdeel waarden
 * @returns {Array<string>}
 */
function getRegularDagdelen(selectedDagdelen) {
  return selectedDagdelen.filter(d => d !== 'geen-voorkeur');
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
        throw new Error('Formulier element niet gevonden');
      }
      
      // Verzamel alle geselecteerde checkboxes (incl. geen voorkeur)
      const selectedDagdelen = getSelectedDagdelenIncludingNoPreference(formElement);
      console.log('[rtDagdelenForm] Geselecteerde dagdelen:', selectedDagdelen);
      
      // Validatie: minimaal 1 dagdeel OF "geen voorkeur" moet geselecteerd zijn
      if (selectedDagdelen.length === 0) {
        const error = new Error('Selecteer minimaal één dagdeel of kies "Geen voorkeur"');
        error.code = 'NO_DAGDELEN_SELECTED';
        throw error;
      }
      
      // Check of "geen voorkeur" is aangevinkt
      const geenVoorkeur = hasNoPreference(selectedDagdelen);
      
      // Haal reguliere dagdelen (zonder "geen voorkeur")
      const regularDagdelen = getRegularDagdelen(selectedDagdelen);
      
      // Sla flow data op
      const updatedFlowData = {
        ...flowData,
        geenVoorkeurDagdelen: geenVoorkeur,
      };
      
      // Als er reguliere dagdelen zijn geselecteerd, converteer naar DB formaat
      if (regularDagdelen.length > 0) {
        const dagdelenDB = convertUIDagdelenNaarDB(regularDagdelen);
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
        geenVoorkeurDagdelen: geenVoorkeur,
        dagdelenVoorkeur: updatedFlowData.dagdelenVoorkeur || null,
        aantalDagdelen: regularDagdelen.length
      }).catch(err => console.warn('[rtDagdelenForm] Tracking failed:', err));
      
      console.log('[rtDagdelenForm] Submit succesvol, navigeer naar volgende stap');
    },
    
    onSuccess: () => {
      console.log('[rtDagdelenForm] onSuccess - Navigeer naar overzicht');
      
      // Lazy load overzicht stap
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
  
  // Initialiseer de formHandler met het bijgewerkte schema
  formHandler.init(schema);
  
  // Haal form element op
  const formElement = document.querySelector(schema.selector);
  if (!formElement) {
    console.error(`❌ [rtDagdelenForm] Formulier element niet gevonden: ${schema.selector}`);
    return;
  }
  
  // Setup "geen voorkeur" exclusieve logica
  setupGeenVoorkeurLogic(formElement);
  
  // Setup checkbox change listeners om submit button state te updaten
  setupCheckboxListeners(formElement);
  
  // Initial submit button state (disabled als geen selectie)
  updateSubmitButtonState(formElement);
  
  console.log('✅ [rtDagdelenForm] Formulier succesvol geïnitialiseerd.');
  
  // 🔙 PREV BUTTON HANDLER
  setupPrevButtonHandler();
}

/**
 * Update submit button state based op checkbox selectie
 * @param {HTMLElement} formElement - Het formulier element
 */
function updateSubmitButtonState(formElement) {
  const selectedDagdelen = getSelectedDagdelenIncludingNoPreference(formElement);
  const isValid = selectedDagdelen.length > 0;
  
  const submitButton = formElement.querySelector(`[data-form-button="${FORM_NAME}"]`);
  if (submitButton) {
    if (isValid) {
      submitButton.classList.remove('is-disabled');
      submitButton.style.pointerEvents = '';
      submitButton.style.opacity = '';
    } else {
      submitButton.classList.add('is-disabled');
      submitButton.style.pointerEvents = 'none';
      submitButton.style.opacity = '0.5';
    }
    console.log(`[rtDagdelenForm] Submit button ${isValid ? 'enabled ✅' : 'disabled ❌'} (${selectedDagdelen.length} dagdelen geselecteerd)`);
  }
}

/**
 * Setup checkbox change listeners om submit button state te updaten
 * @param {HTMLElement} formElement - Het formulier element
 */
function setupCheckboxListeners(formElement) {
  const allCheckboxes = formElement.querySelectorAll('input[type="checkbox"][data-field-name="dagdeel"]');
  
  allCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateSubmitButtonState(formElement);
    });
  });
  
  console.log(`[rtDagdelenForm] ${allCheckboxes.length} checkbox listeners toegevoegd voor submit button state`);
}

/**
 * Setup logica voor "geen voorkeur" checkbox
 * Als "geen voorkeur" wordt aangevinkt, worden alle andere dagdelen uitgevinkt
 * Als een dagdeel wordt aangevinkt, wordt "geen voorkeur" uitgevinkt
 */
function setupGeenVoorkeurLogic(formElement) {
  const geenVoorkeurCheckbox = formElement.querySelector('[data-dagdeel="geen-voorkeur"]');
  const dagdeelCheckboxes = formElement.querySelectorAll('[data-dagdeel]:not([data-dagdeel="geen-voorkeur"])');
  
  if (!geenVoorkeurCheckbox) {
    console.warn('⚠️ [rtDagdelenForm] "Geen voorkeur" checkbox niet gevonden');
    return;
  }
  
  // Als "geen voorkeur" wordt aangeklikt
  geenVoorkeurCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      console.log('[rtDagdelenForm] "Geen voorkeur" aangevinkt, uncheck alle dagdelen');
      
      // Uncheck alle dagdeel checkboxes
      dagdeelCheckboxes.forEach(cb => {
        if (cb.checked) {
          cb.checked = false;
          
          // Update Webflow styling
          const label = cb.closest('label.w-checkbox, label.radio-fancy_field');
          if (label) {
            label.classList.remove('is-checked');
            const icon = label.querySelector('.w-checkbox-input, .radio-fancy_checkmark');
            if (icon) {
              icon.classList.remove('w--redirected-checked');
            }
          }
        }
      });
    }
  });
  
  // Als een dagdeel checkbox wordt aangeklikt
  dagdeelCheckboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      if (e.target.checked && geenVoorkeurCheckbox.checked) {
        console.log('[rtDagdelenForm] Dagdeel aangevinkt, uncheck "geen voorkeur"');
        
        // Uncheck "geen voorkeur"
        geenVoorkeurCheckbox.checked = false;
        
        // Update Webflow styling
        const label = geenVoorkeurCheckbox.closest('label.w-checkbox, label.radio-fancy_field');
        if (label) {
          label.classList.remove('is-checked');
          const icon = label.querySelector('.w-checkbox-input, .radio-fancy_checkmark');
          if (icon) {
            icon.classList.remove('w--redirected-checked');
          }
        }
      }
    });
  });
  
  console.log('[rtDagdelenForm] "Geen voorkeur" logica ingesteld');
}

/**
 * Setup prev button handler voor terug navigatie
 */
function setupPrevButtonHandler() {
  const formElement = document.querySelector(`[data-form-name="${FORM_NAME}"]`);
  if (!formElement) {
    console.warn('⚠️ [rtDagdelenForm] Form element niet gevonden');
    return;
  }
  
  const prevButton = formElement.querySelector(`[data-form-button-prev="${FORM_NAME}"]`);
  if (!prevButton) {
    console.warn('⚠️ [rtDagdelenForm] Prev button niet gevonden');
    return;
  }
  
  console.log('[rtDagdelenForm] Prev button gevonden, event handler toevoegen...');
  
  prevButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[rtDagdelenForm] 🔙 Prev button clicked - ga terug naar opdracht stap');
    
    // Lazy load vorige stap
    try {
      const module = await import('./tapijtOpdrachtForm.js');
      console.log('[rtDagdelenForm] ♻️ Re-init tapijtOpdrachtForm voor terug navigatie...');
      module.initTapijtOpdrachtForm();
      
      // NA re-init, ga naar vorige slide via Webflow functie
      if (typeof window.moveToPrevSlide === 'function') {
        console.log('[rtDagdelenForm] Roep window.moveToPrevSlide() aan');
        window.moveToPrevSlide();
      } else {
        console.warn('[rtDagdelenForm] window.moveToPrevSlide() niet beschikbaar, probeer fallback');
        // Fallback: probeer goToFormStep
        goToFormStep('rt_opdracht-form');
      }
    } catch (err) {
      console.error('[rtDagdelenForm] ❌ Fout bij re-init tapijtOpdrachtForm:', err);
      // Navigeer alsnog terug bij fout
      if (typeof window.moveToPrevSlide === 'function') {
        window.moveToPrevSlide();
      } else {
        goToFormStep('rt_opdracht-form');
      }
    }
  });
  
  console.log('[rtDagdelenForm] ✅ Prev button handler toegevoegd');
}
