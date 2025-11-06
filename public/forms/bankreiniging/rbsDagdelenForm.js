// public/forms/bankreiniging/rbsDagdelenForm.js
// Formulier handling voor stap 3 van de bank & stoelen reiniging aanvraag: dagdelen voorkeur

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { saveFlowData, loadFlowData } from '../logic/formStorage.js';
import { logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';
import { getSelectedDagdelenFromForm, convertUIDagdelenNaarDB } from '../logic/dagdelenHelper.js';

const FORM_NAME = 'rbs_dagdelen-form';
const NEXT_FORM_NAME = 'rbs_overzicht-form';

function goToFormStep(nextFormName) {
  console.log(`[rbsDagdelenForm] goToFormStep → ${nextFormName}`);
  
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
  
  console.log('[rbsDagdelenForm] Fallback moveToNextSlide (geen target match)');
  const moveEvent = new CustomEvent('moveToNextSlide');
  document.dispatchEvent(moveEvent);
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
export function initRbsDagdelenForm() {
  console.log('[rbsDagdelenForm] Initialiseren van formulier:', FORM_NAME);
  
  // Haal schema op
  const schema = getFormSchema(FORM_NAME);
  if (!schema) {
    console.error(`❌ [rbsDagdelenForm] Schema niet gevonden voor ${FORM_NAME}`);
    return;
  }
  
  // Laad bestaande flow data
  const flowData = loadFlowData('bankreiniging-aanvraag') || {};
  console.log('[rbsDagdelenForm] Bestaande flow data:', flowData);
  
  // Submit action
  schema.submit = {
    action: async (formData) => {
      console.log('[rbsDagdelenForm] Submit action gestart met formData:', formData);
      
      const formElement = document.querySelector(schema.selector);
      if (!formElement) {
        throw new Error('Formulier element niet gevonden');
      }
      
      // Verzamel alle geselecteerde checkboxes (incl. geen voorkeur)
      const selectedDagdelen = getSelectedDagdelenIncludingNoPreference(formElement);
      console.log('[rbsDagdelenForm] Geselecteerde dagdelen:', selectedDagdelen);
      
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
        console.log('[rbsDagdelenForm] Dagdelen opgeslagen (DB formaat):', dagdelenDB);
      } else {
        // Geen reguliere dagdelen, verwijder uit flow data
        delete updatedFlowData.dagdelenVoorkeur;
        console.log('[rbsDagdelenForm] Geen reguliere dagdelen geselecteerd');
      }
      
      saveFlowData('bankreiniging-aanvraag', updatedFlowData);
      console.log('[rbsDagdelenForm] Flow data opgeslagen:', updatedFlowData);
      
      // 🎯 TRACK STEP COMPLETION
      await logStepCompleted('bankreiniging', 'dagdelen', 3, {
        geenVoorkeurDagdelen: geenVoorkeur,
        dagdelenVoorkeur: updatedFlowData.dagdelenVoorkeur || null,
        aantalDagdelen: regularDagdelen.length
      }).catch(err => console.warn('[rbsDagdelenForm] Tracking failed:', err));
      
      console.log('[rbsDagdelenForm] Submit succesvol, navigeer naar volgende stap');
    },
    
    onSuccess: () => {
      console.log('[rbsDagdelenForm] onSuccess - Navigeer naar overzicht');
      
      // Lazy load overzicht stap
      import('./bankReinigingOverzichtForm.js').then(module => {
        console.log('[rbsDagdelenForm] Stap 4 (bankReinigingOverzichtForm) wordt geïnitialiseerd...');
        module.initBankReinigingOverzichtForm();
        goToFormStep(NEXT_FORM_NAME);
      }).catch(err => {
        console.error('[rbsDagdelenForm] Kon stap 4 niet laden:', err);
        goToFormStep(NEXT_FORM_NAME);
      });
    }
  };
  
  // Initialiseer de formHandler met het bijgewerkte schema
  formHandler.init(schema);
  
  // Haal form element op
  const formElement = document.querySelector(schema.selector);
  if (!formElement) {
    console.error(`❌ [rbsDagdelenForm] Formulier element niet gevonden: ${schema.selector}`);
    return;
  }
  
  // Setup "geen voorkeur" exclusieve logica
  setupGeenVoorkeurLogic(formElement);
  
  console.log('✅ [rbsDagdelenForm] Formulier succesvol geïnitialiseerd.');
  
  // 🔙 PREV BUTTON HANDLER
  setupPrevButtonHandler();
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
    console.warn('⚠️ [rbsDagdelenForm] "Geen voorkeur" checkbox niet gevonden');
    return;
  }
  
  // Als "geen voorkeur" wordt aangeklikt
  geenVoorkeurCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      console.log('[rbsDagdelenForm] "Geen voorkeur" aangevinkt, uncheck alle dagdelen');
      
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
        console.log('[rbsDagdelenForm] Dagdeel aangevinkt, uncheck "geen voorkeur"');
        
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
  
  console.log('[rbsDagdelenForm] "Geen voorkeur" logica ingesteld');
}

/**
 * Setup prev button handler voor terug navigatie
 */
function setupPrevButtonHandler() {
  const formElement = document.querySelector(`[data-form-name="${FORM_NAME}"]`);
  if (!formElement) return;
  
  const prevButton = formElement.querySelector(`[data-form-button-prev="${FORM_NAME}"]`);
  if (!prevButton) {
    console.warn('⚠️ [rbsDagdelenForm] Prev button niet gevonden');
    return;
  }
  
  console.log('[rbsDagdelenForm] Prev button gevonden, event handler toevoegen...');
  
  prevButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[rbsDagdelenForm] Prev button clicked - ga terug naar opdracht stap');
    
    // Lazy load vorige stap
    try {
      const module = await import('./bankReinigingOpdrachtForm.js');
      console.log('[rbsDagdelenForm] Vorige stap (bankReinigingOpdrachtForm) wordt her-geïnitialiseerd...');
      module.initBankReinigingOpdrachtForm();
      
      // Navigeer terug
      goToFormStep('rbs_opdracht-form');
    } catch (err) {
      console.error('[rbsDagdelenForm] Kon vorige stap niet laden:', err);
      goToFormStep('rbs_opdracht-form'); // Probeer toch te navigeren
    }
  });
  
  console.log('[rbsDagdelenForm] ✅ Prev button handler toegevoegd');
}
