/**
 * @fileoverview Dieptereiniging stap 3: Schoonmaker selectie formulier
 * Laadt beschikbare schoonmakers op basis van plaats, datum en benodigde uren.
 * Verschil met abonnement: geen dagdelen selectie, alleen schoonmaker keuze.
 */

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { loadFlowData, saveFlowData } from '../logic/formStorage.js';
import { fetchAvailableCleaners } from '../../utils/api/cleaners.js';

const FORM_NAME = 'dr_schoonmaker-form';
const FORM_SELECTOR = `[data-form-name="${FORM_NAME}"]`;
const NEXT_FORM_NAME = 'dr_persoonsgegevens-form';

/**
 * Navigatie helper (volgt abonnement patroon)
 */
function goToFormStep(nextFormName) {
  console.log('[DR Schoonmaker Form] goToFormStep →', nextFormName);
  
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[DR Schoonmaker Form] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[DR Schoonmaker Form] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[DR Schoonmaker Form] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[DR Schoonmaker Form] Fallback moveToNextSlide');
    window.moveToNextSlide();
    return true;
  }

  console.error('[DR Schoonmaker Form] Geen slider navigatie functie gevonden.');
  return false;
}

// Status object voor dit formulier (volgt abonnement patroon)
const formStatus = {
  isLoading: false,
  schoonmakersWrapper: null,    // [data-element="schoonmakers-list"]
  schoonmakerTemplate: null,    // [data-render-element="schoonmaker"]
  schoonmakerPrototype: null,   // Clean clone van template
  totaalSchoonmakers: 0,
  totaalElement: null,          // [data-element="schoonmakers-total"]
  geenVoorkeurElement: null,    // [data-element="schoonmakers-geen-voorkeur"]
  emptyElement: null            // [data-element="schoonmakers-empty"]
};

/**
 * Reset radio button state (volgt abonnement patroon)
 */
function resetRadioState(container, contextLabel = '') {
  if (!container) return;

  const radio = container.querySelector('input[type="radio"]');
  const label = radio ? radio.closest('label, .w-radio') : null;
  
  if (radio) {
    radio.checked = false;
    radio.removeAttribute('checked');
    radio.removeAttribute('aria-checked');
  }
  
  if (label) {
    label.removeAttribute('aria-checked');
    label.classList.remove('w--redirected-checked');
  }
  
  // Remove Webflow redirected classes
  const redirectedTargets = container.querySelectorAll('.w--redirected-checked, .w--redirected-focus');
  redirectedTargets.forEach(el => {
    el.classList.remove('w--redirected-checked', 'w--redirected-focus');
  });
  
  // Remove custom is-checked classes
  const isCheckedTargets = container.querySelectorAll('.is-checked');
  isCheckedTargets.forEach(el => el.classList.remove('is-checked'));
}

/**
 * Initialiseert het schoonmaker selectie formulier voor dieptereiniging
 */
export async function initDrSchoonmakerForm() {
  console.log('🚀 [DR Schoonmaker Form] ===== INITIALISATIE START =====');

  const formElement = document.querySelector(FORM_SELECTOR);
  console.log('[DR Schoonmaker Form] Form element gevonden:', !!formElement);
  
  if (!formElement) {
    console.warn('⚠️ [DR Schoonmaker Form] Form element niet gevonden');
    return;
  }

  // Initialiseer formHandler met schema
  const schema = getFormSchema(FORM_NAME);
  console.log('[DR Schoonmaker Form] Schema geladen:', schema);
  
  if (schema) {
    // Voeg submit handler toe aan schema (volgt abonnement patroon)
    schema.submit.action = async (formData) => {
      console.log('[DR Schoonmaker Form] Submit action:', formData);
      
      const selectedValue = formData.schoonmakerKeuze;
      
      // Bij "Geen voorkeur": gebruik auto-assign ID
      let schoonmakerId = selectedValue;
      if (selectedValue === 'geenVoorkeur') {
        const geenVoorkeurRadio = formStatus.geenVoorkeurElement?.querySelector('input[type="radio"]');
        const autoAssignId = geenVoorkeurRadio?.getAttribute('data-auto-assign-id');
        
        if (autoAssignId) {
          schoonmakerId = autoAssignId;
          console.log('[DR Schoonmaker Form] Geen voorkeur: auto-assign ID =', schoonmakerId);
        } else {
          console.error('[DR Schoonmaker Form] Geen auto-assign ID gevonden');
          throw new Error('Geen schoonmaker beschikbaar');
        }
      }
      
      // Sla op in flow storage
      const flowData = loadFlowData('dieptereiniging-aanvraag') || {};
      flowData.schoonmakerKeuze = selectedValue;
      flowData.schoonmaker_id = schoonmakerId;
      saveFlowData('dieptereiniging-aanvraag', flowData);
      
      console.log('[DR Schoonmaker Form] Saved choice:', {
        schoonmakerKeuze: selectedValue,
        schoonmaker_id: schoonmakerId
      });
    };
    
    // Voeg onSuccess handler toe (navigatie naar volgende stap)
    schema.submit.onSuccess = () => {
      console.log('[DR Schoonmaker Form] Submit success, navigeer naar stap 4...');
      
      // Initialiseer stap 4 (persoonsgegevens)
      import('./drPersoonsgegevensForm.js').then(module => {
        console.log('[DR Schoonmaker Form] Stap 4 (drPersoonsgegevensForm) wordt geïnitialiseerd...');
        if (typeof module.initDrPersoonsgegevensForm === 'function') {
          module.initDrPersoonsgegevensForm();
        }
        
        // Navigeer naar volgende slide
        goToFormStep('dr_persoonsgegevens-form');
      });
    };
    
    formHandler.init(schema);
    console.log('[DR Schoonmaker Form] FormHandler geïnitialiseerd met submit handlers');
  }

  // Vind en sla UI containers op (volgt abonnement patroon)
  formStatus.schoonmakersWrapper = document.querySelector('[data-element="schoonmakers-list"]');
  formStatus.totaalElement = document.querySelector('[data-element="schoonmakers-total"]');
  formStatus.geenVoorkeurElement = document.querySelector('[data-element="schoonmakers-geen-voorkeur"]');
  formStatus.emptyElement = document.querySelector('[data-element="schoonmakers-empty"]');
  
  // Vind template en maak prototype clone (BELANGRIJK!)
  formStatus.schoonmakerTemplate = document.querySelector('[data-render-element="schoonmaker"]');
  
  if (formStatus.schoonmakerTemplate) {
    if (!formStatus.schoonmakerPrototype) {
      formStatus.schoonmakerPrototype = formStatus.schoonmakerTemplate.cloneNode(true);
      resetRadioState(formStatus.schoonmakerPrototype, 'prototype');
      console.log('[DR Schoonmaker Form] Prototype clone gemaakt');
    }
    formStatus.schoonmakerTemplate.style.display = 'none';
  } else if (!formStatus.schoonmakerPrototype) {
    console.error('❌ [DR Schoonmaker Form] Geen schoonmaker template gevonden');
  }

  // Haal bestaande keuze op (bij terugkomen)
  const existingChoice = formHandler.formData.schoonmakerKeuze || null;
  console.log('[DR Schoonmaker Form] Bestaande keuze:', existingChoice);

  console.log('[DR Schoonmaker Form] UI elementen check:', {
    schoonmakersWrapper: !!formStatus.schoonmakersWrapper,
    totaalElement: !!formStatus.totaalElement,
    geenVoorkeurElement: !!formStatus.geenVoorkeurElement,
    emptyElement: !!formStatus.emptyElement,
    template: !!formStatus.schoonmakerTemplate,
    prototype: !!formStatus.schoonmakerPrototype
  });

  // Laad schoonmakers (error handling gebeurt in loadCleaners zelf)
  console.log('[DR Schoonmaker Form] Start laden schoonmakers...');
  await loadCleaners(existingChoice);

  // Setup event handlers
  setupEventHandlers();

  console.log('✅ [DR Schoonmaker Form] ===== INITIALISATIE COMPLEET =====');
}

/**
 * Laadt beschikbare schoonmakers van de API
 */
async function loadCleaners(existingChoice) {
  console.log('📦 [DR Schoonmaker Form] loadCleaners() START');

  // Toon loading state
  updateLoadingState(true);
  
  if (formStatus.schoonmakersWrapper) formStatus.schoonmakersWrapper.style.display = 'none';
  if (formStatus.emptyElement) formStatus.emptyElement.style.display = 'none';

  try {
    // Haal flow data op via loadFlowData helper
    const flowData = loadFlowData('dieptereiniging-aanvraag') || {};
    console.log('[DR Schoonmaker Form] Flow data geladen:', flowData);
    
    // Controleer vereiste velden (plaats = globaal veld, dr_datum en dr_uren = form-specific)
    if (!flowData.plaats || !flowData.dr_datum || !flowData.dr_uren) {
      console.error('❌ [DR Schoonmaker Form] Missing required flow data:', {
        plaats: flowData.plaats,
        dr_datum: flowData.dr_datum,
        dr_uren: flowData.dr_uren,
        allKeys: Object.keys(flowData)
      });
      throw new Error('Adres- of opdrachtgegevens ontbreken. Ga terug naar de vorige stap.');
    }

    console.log('🌐 [DR Schoonmaker Form] Fetching cleaners from API...', {
      plaats: flowData.plaats,
      datum: flowData.dr_datum,
      uren: flowData.dr_uren,
      type: 'dieptereiniging'
    });
    
    const response = await fetchAvailableCleaners({
      plaats: flowData.plaats,
      datum: flowData.dr_datum,
      minUren: flowData.dr_uren,
      type: 'dieptereiniging' // Signal to use dieptereiniging endpoint
    });

    console.log('📨 [DR Schoonmaker Form] API response:', response);

    const cleaners = response.cleaners || [];
    console.log(`👥 [DR Schoonmaker Form] Cleaners count: ${cleaners.length}`);

    if (cleaners.length === 0) {
      console.warn('⚠️ [DR Schoonmaker Form] Geen schoonmakers gevonden');
      if (formStatus.emptyElement) {
        formStatus.emptyElement.style.display = 'block';
      }
      return;
    }

    // Render schoonmakers
    console.log('[DR Schoonmaker Form] Start rendering schoonmakers...');
    renderCleaners(cleaners, existingChoice);

    // Toon lijst
    if (formStatus.schoonmakersWrapper) {
      formStatus.schoonmakersWrapper.style.display = 'block';
    }

  } catch (error) {
    console.error('❌ [DR Schoonmaker Form] ERROR in loadCleaners:', error);
    console.error('[DR Schoonmaker Form] Error stack:', error.stack);
    
    // Toon empty state
    if (formStatus.emptyElement) {
      formStatus.emptyElement.style.display = 'block';
    }
  } finally {
    updateLoadingState(false);
  }
  
  console.log('✅ [DR Schoonmaker Form] loadCleaners() COMPLEET');
}

/**
 * Update loading state (volgt abonnement patroon)
 */
function updateLoadingState(isLoading) {
  formStatus.isLoading = isLoading;
  
  const loadingSpinner = document.querySelector('[data-loading-spinner="schoonmakers"]');
  const contentContainer = document.querySelector('[data-schoonmakers-container]');
  
  if (loadingSpinner) {
    if (isLoading) {
      loadingSpinner.classList.remove('hide');
    } else {
      loadingSpinner.classList.add('hide');
    }
  }
  
  if (contentContainer) {
    contentContainer.style.opacity = isLoading ? '0.6' : '1';
    contentContainer.style.pointerEvents = isLoading ? 'none' : 'auto';
  }
}

/**
 * Rendert een enkele schoonmaker (volgt abonnement patroon)
 */
function renderSchoonmaker(schoonmaker) {
  const sourceTemplate = formStatus.schoonmakerPrototype || formStatus.schoonmakerTemplate;
  if (!sourceTemplate) {
    console.error('❌ [DR Schoonmaker Form] Geen schoonmaker template beschikbaar om te klonen');
    return null;
  }
  
  // Kloon vanaf PROTOTYPE (niet vanaf DOM template!)
  const schoonmakerEl = sourceTemplate.cloneNode(true);
  schoonmakerEl.style.display = 'block'; // Maak zichtbaar
  
  // Reset radio state (belangrijk voor Webflow!)
  resetRadioState(schoonmakerEl, 'clone');
  
  // Setup radio button
  const radioEl = schoonmakerEl.querySelector('input[type="radio"]');
  if (radioEl) {
    radioEl.value = schoonmaker.id;
    radioEl.setAttribute('data-field-name', 'schoonmakerKeuze');
    radioEl.name = 'schoonmakerKeuze';
    radioEl.checked = false;
    radioEl.removeAttribute('checked');
  }
  
  // Vul data in met data-schoonmaker attributen
  const naamEl = schoonmakerEl.querySelector('[data-schoonmaker="naam"]');
  if (naamEl) {
    naamEl.textContent = schoonmaker.voornaam; // Alleen voornaam zoals abonnement
  }
  
  const plaatsEl = schoonmakerEl.querySelector('[data-schoonmaker="plaats"]');
  if (plaatsEl) {
    plaatsEl.textContent = schoonmaker.plaats;
  }
  
  const fotoEl = schoonmakerEl.querySelector('[data-schoonmaker="schoonmaker-foto"]');
  if (fotoEl && schoonmaker.profielfoto) {
    fotoEl.src = schoonmaker.profielfoto;
    fotoEl.alt = `Foto van ${schoonmaker.voornaam}`;
  }
  
  // Rating
  const starsEl = schoonmakerEl.querySelector('[data-field-profile="stars"]');
  if (starsEl && schoonmaker.rating) {
    starsEl.textContent = parseFloat(schoonmaker.rating).toFixed(1);
  }
  
  // Aantal reviews
  const reviewsEl = schoonmakerEl.querySelector('[data-schoonmaker="total-reviews"]');
  if (reviewsEl && schoonmaker.aantal_beoordelingen) {
    reviewsEl.textContent = schoonmaker.aantal_beoordelingen;
  }
  
  // Render beschikbaarheid (indien aanwezig)
  if (schoonmaker.beschikbaarheid) {
    renderBeschikbaarheidGrid(schoonmakerEl, schoonmaker.beschikbaarheid);
  }
  
  return schoonmakerEl;
}

/**
 * Rendert alle schoonmakers in de lijst (volgt abonnement patroon)
 */
function renderCleaners(cleaners, existingChoice) {
  console.log('🎨 [DR Schoonmaker Form] renderCleaners() START');
  console.log(`[DR Schoonmaker Form] Rendering ${cleaners.length} cleaners`);

  if (!formStatus.schoonmakersWrapper) {
    console.error('❌ [DR Schoonmaker Form] Geen schoonmakers wrapper gevonden');
    return;
  }

  // Leeg de wrapper (maar laat template intact) - VOLGT ABONNEMENT PATROON
  Array.from(formStatus.schoonmakersWrapper.children).forEach(child => {
    if (child !== formStatus.schoonmakerTemplate) {
      child.remove();
    }
  });
  
  console.log('[DR Schoonmaker Form] Wrapper geleegd, start rendering...');

  // Render elke schoonmaker
  cleaners.forEach((cleaner, index) => {
    console.log(`[DR Schoonmaker Form] Rendering cleaner ${index + 1}/${cleaners.length}:`, {
      id: cleaner.id,
      naam: cleaner.voornaam,
      plaats: cleaner.plaats
    });
    
    const schoonmakerEl = renderSchoonmaker(cleaner);
    if (schoonmakerEl) {
      formStatus.schoonmakersWrapper.appendChild(schoonmakerEl);
      console.log(`[DR Schoonmaker Form] ✅ Card ${index + 1} toegevoegd`);
    }
  });

  // Update totaal
  formStatus.totaalSchoonmakers = cleaners.length;
  if (formStatus.totaalElement) {
    formStatus.totaalElement.textContent = cleaners.length;
  }

  // Voeg "Geen voorkeur" optie toe (met auto-assign)
  addNoPreferenceOption(cleaners);

  // Clear selectie (submit button disabled tot keuze gemaakt)
  clearSchoonmakerKeuze();

  // Bind events op nieuwe radio's
  bindSchoonmakerRadioEvents();
  
  console.log('✅ [DR Schoonmaker Form] renderCleaners() COMPLEET');
}

/**
 * Voeg "Geen voorkeur" optie toe (volgt abonnement patroon)
 */
function addNoPreferenceOption(schoonmakersList = []) {
  if (!formStatus.geenVoorkeurElement) {
    console.warn('⚠️ [DR Schoonmaker Form] Geen voorkeur element niet gevonden');
    return;
  }

  const radio = formStatus.geenVoorkeurElement.querySelector('input[type="radio"]');
  if (radio) {
    radio.name = 'schoonmakerKeuze';
    radio.setAttribute('data-field-name', 'schoonmakerKeuze');
    if (!radio.value) radio.value = 'geenVoorkeur';
    
    // Auto-assign ID van eerste schoonmaker
    if (schoonmakersList.length > 0 && schoonmakersList[0].id) {
      radio.setAttribute('data-auto-assign-id', schoonmakersList[0].id);
      console.log('✅ [DR Schoonmaker Form] Auto-assign ID gezet:', schoonmakersList[0].id);
    } else {
      radio.removeAttribute('data-auto-assign-id');
    }
    
    // Default: niet geselecteerd
    radio.checked = false;
    radio.removeAttribute('checked');
  }
  
  resetRadioState(formStatus.geenVoorkeurElement, 'geen-voorkeur-init');
}

/**
 * Leegt schoonmaker selectie (volgt abonnement patroon)
 */
function clearSchoonmakerKeuze() {
  const formElement = document.querySelector(FORM_SELECTOR);
  if (!formElement) return;

  // Uncheck alle radio's
  const radios = formElement.querySelectorAll('input[type="radio"][name="schoonmakerKeuze"]');
  radios.forEach(r => {
    r.checked = false;
    r.removeAttribute('checked');
  });

  if (formStatus.geenVoorkeurElement) {
    resetRadioState(formStatus.geenVoorkeurElement, 'clear');
  }

  // Reset formHandler state
  try {
    if (formHandler && typeof formHandler.runWithFormContext === 'function') {
      formHandler.runWithFormContext(FORM_NAME, () => {
        if (formHandler.formData) {
          formHandler.formData.schoonmakerKeuze = '';
        }
        if (typeof formHandler.updateSubmitState === 'function') {
          formHandler.updateSubmitState(FORM_NAME);
        }
      });
    }
  } catch (e) {
    console.warn('[DR Schoonmaker Form] Kon keuze reset niet volledig doorvoeren:', e);
  }
}

/**
 * Bind events op radio buttons (volgt abonnement patroon)
 */
function bindSchoonmakerRadioEvents() {
  const formElement = document.querySelector(FORM_SELECTOR);
  if (!formElement) return;

  const radios = formElement.querySelectorAll('input[type="radio"][name="schoonmakerKeuze"]');
  
  radios.forEach(radio => {
    // Skip als al gebonden
    if (radio.dataset.bound === '1') return;
    
    radio.addEventListener('change', (e) => {
      console.log('[DR Schoonmaker Form] Radio changed:', e.target.value);
      
      try {
        if (formHandler && typeof formHandler.handleInput === 'function') {
          formHandler.handleInput('schoonmakerKeuze', e, FORM_NAME);
        }
        if (formHandler && typeof formHandler.updateSubmitState === 'function') {
          formHandler.updateSubmitState(FORM_NAME);
        }
      } catch (err) {
        console.warn('[DR Schoonmaker Form] Kon radio change niet verwerken:', err);
      }
    });
    
    radio.dataset.bound = '1';
  });
  
  console.log(`[DR Schoonmaker Form] Events gebonden op ${radios.length} radio buttons`);
}

/**
 * Rendert beschikbaarheid grid visueel (geen interactie)
 * Toont welke uren beschikbaar zijn op de gekozen dag
 */
function renderBeschikbaarheidGrid(card, beschikbaarheid) {
  if (!beschikbaarheid || !Array.isArray(beschikbaarheid)) {
    console.log('[DR Schoonmaker Form] No beschikbaarheid data');
    return;
  }

  console.log('[DR Schoonmaker Form] Rendering beschikbaarheid grid:', beschikbaarheid);

  // Beschikbaarheid is array van { dag, dagdeel, start_tijd, eind_tijd }
  // Voor dieptereiniging: toon alleen relevante tijdslots
  beschikbaarheid.forEach(slot => {
    const dag = slot.dag; // bijv. 'maandag'
    const dagdeel = slot.dagdeel; // bijv. 'ochtend'
    
    // Zoek het grid element voor deze combinatie
    const gridElement = card.querySelector(`[data-schoonmaker-dagdeel="${dag}-${dagdeel}"]`);
    if (gridElement) {
      // Markeer als beschikbaar (bijv. via class)
      gridElement.classList.add('beschikbaar');
      
      // Optioneel: toon tijden
      gridElement.setAttribute('title', `${slot.start_tijd} - ${slot.eind_tijd}`);
    }
  });
}

/**
 * Setup event handlers voor formulier
 * Submit wordt afgehandeld door formHandler via schema
 */
function setupEventHandlers() {
  console.log('[DR Schoonmaker Form] Event handlers setup - radio events worden gebonden na render');
  // Radio events worden gebonden in bindSchoonmakerRadioEvents() na rendering
  // Submit wordt afgehandeld door formHandler via schema.submit.action
}


