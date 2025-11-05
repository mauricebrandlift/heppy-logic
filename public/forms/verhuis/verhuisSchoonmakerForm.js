/**
 * @fileoverview Verhuis/Opleverschoonmaak stap 3: Schoonmaker selectie formulier
 * Laadt beschikbare schoonmakers op basis van plaats, datum en benodigde uren.
 * Verschil met abonnement: geen dagdelen selectie, alleen schoonmaker keuze.
 */

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { loadFlowData, saveFlowData } from '../logic/formStorage.js';
import { fetchAvailableCleaners } from '../../utils/api/cleaners.js';

const FORM_NAME = 'vh_schoonmaker-form';
const FORM_SELECTOR = `[data-form-name="${FORM_NAME}"]`;
const NEXT_FORM_NAME = 'vh_overzicht-form';

/**
 * Navigatie helper (volgt abonnement patroon)
 */
function goToFormStep(nextFormName) {
  console.log('[Verhuis Schoonmaker Form] goToFormStep →', nextFormName);
  
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[Verhuis Schoonmaker Form] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[Verhuis Schoonmaker Form] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[Verhuis Schoonmaker Form] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[Verhuis Schoonmaker Form] Fallback moveToNextSlide');
    window.moveToNextSlide();
    return true;
  }

  console.error('[Verhuis Schoonmaker Form] Geen slider navigatie functie gevonden.');
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
 * Initialiseert het schoonmaker selectie formulier voor verhuis/opleverschoonmaak
 */
export async function initVerhuisSchoonmakerForm() {
  console.log('🚀 [Verhuis Schoonmaker Form] ===== INITIALISATIE START =====');

  const formElement = document.querySelector(FORM_SELECTOR);
  console.log('[Verhuis Schoonmaker Form] Form element gevonden:', !!formElement);
  
  if (!formElement) {
    console.warn('⚠️ [Verhuis Schoonmaker Form] Form element niet gevonden');
    return;
  }

  // Initialiseer formHandler met schema
  const schema = getFormSchema(FORM_NAME);
  console.log('[Verhuis Schoonmaker Form] Schema geladen:', schema);
  
  if (schema) {
    // Zorg dat schema.name is gezet (fix voor formHandler)
    schema.name = FORM_NAME;
    
    // Voeg submit handler toe aan schema (volgt abonnement patroon)
    schema.submit.action = async (formData) => {
      console.log('[Verhuis Schoonmaker Form] Submit action:', formData);
      
      const selectedValue = formData.schoonmakerKeuze;
      
      // Bij "Geen voorkeur": gebruik auto-assign ID
      let schoonmakerId = selectedValue;
      if (selectedValue === 'geenVoorkeur') {
        const geenVoorkeurRadio = formStatus.geenVoorkeurElement?.querySelector('input[type="radio"]');
        const autoAssignId = geenVoorkeurRadio?.getAttribute('data-auto-assign-id');
        
        console.log('[Verhuis Schoonmaker Form] Geen voorkeur check:', {
          geenVoorkeurElement: !!formStatus.geenVoorkeurElement,
          geenVoorkeurRadio: !!geenVoorkeurRadio,
          autoAssignId: autoAssignId
        });
        
        if (autoAssignId) {
          schoonmakerId = autoAssignId;
          console.log('[Verhuis Schoonmaker Form] Geen voorkeur: auto-assign ID =', schoonmakerId);
        } else {
          console.error('[Verhuis Schoonmaker Form] Geen auto-assign ID gevonden - gebruik eerste beschikbare schoonmaker');
          // Fallback: zoek eerste schoonmaker in de lijst
          const firstSchoonmakerRadio = document.querySelector('[data-render-element="schoonmaker"] input[type="radio"]');
          if (firstSchoonmakerRadio && firstSchoonmakerRadio.value) {
            schoonmakerId = firstSchoonmakerRadio.value;
            console.log('[Verhuis Schoonmaker Form] Fallback: eerste schoonmaker ID =', schoonmakerId);
          } else {
            throw new Error('Geen schoonmaker beschikbaar');
          }
        }
      }
      
      // Sla op in flow storage
      const flowData = loadFlowData('verhuis-aanvraag') || {};
      flowData.schoonmakerKeuze = selectedValue;
      flowData.schoonmaker_id = schoonmakerId;
      
      // Sla voornaam van geselecteerde schoonmaker op voor overzicht (indien van toepassing)
      try {
        const formElement = document.querySelector(FORM_SELECTOR);
        if (formElement && selectedValue && selectedValue !== 'geenVoorkeur') {
          const selectedRadio = formElement.querySelector(`input[type="radio"][name="schoonmakerKeuze"][value="${selectedValue}"]`);
          if (selectedRadio) {
            const card = selectedRadio.closest('[data-render-element="schoonmaker"]');
            const naamEl = card ? card.querySelector('[data-schoonmaker="naam"]') : null;
            const voornaam = naamEl ? (naamEl.textContent || '').trim() : '';
            if (voornaam) {
              flowData.schoonmakerVoornaam = voornaam;
            }
          }
        } else {
          // Geen voorkeur of niets gekozen: geen naam tonen in overzicht
          if (flowData.schoonmakerVoornaam) delete flowData.schoonmakerVoornaam;
        }
      } catch (e) {
        console.warn('[Verhuis Schoonmaker Form] Kon voornaam niet opslaan voor overzicht:', e);
      }
      
      saveFlowData('verhuis-aanvraag', flowData);
      
      console.log('[Verhuis Schoonmaker Form] Saved choice:', {
        schoonmakerKeuze: selectedValue,
        schoonmaker_id: schoonmakerId,
        schoonmakerVoornaam: flowData.schoonmakerVoornaam || null
      });
    };
    
    // Voeg onSuccess handler toe (navigatie naar volgende stap)
    schema.submit.onSuccess = () => {
      console.log('[Verhuis Schoonmaker Form] Submit success, navigeer naar stap 4 (overzicht)...');
      
      // Initialiseer stap 4 (overzicht)
      import('./verhuisOverzichtForm.js').then(module => {
        console.log('[Verhuis Schoonmaker Form] Stap 4 (verhuisOverzichtForm) wordt geïnitialiseerd...');
        if (typeof module.initVerhuisOverzichtForm === 'function') {
          module.initVerhuisOverzichtForm();
        }
        
        // Navigeer naar volgende slide
        goToFormStep(NEXT_FORM_NAME);
      });
    };
    
    formHandler.init(schema);
    console.log('[Verhuis Schoonmaker Form] FormHandler geïnitialiseerd met submit handlers');
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
      console.log('[Verhuis Schoonmaker Form] Prototype clone gemaakt');
    }
    formStatus.schoonmakerTemplate.style.display = 'none';
  } else if (!formStatus.schoonmakerPrototype) {
    console.error('❌ [Verhuis Schoonmaker Form] Geen schoonmaker template gevonden');
  }

  // Haal bestaande keuze op (bij terugkomen)
  const existingChoice = formHandler.formData.schoonmakerKeuze || null;
  console.log('[Verhuis Schoonmaker Form] Bestaande keuze:', existingChoice);

  console.log('[Verhuis Schoonmaker Form] UI elementen check:', {
    schoonmakersWrapper: !!formStatus.schoonmakersWrapper,
    totaalElement: !!formStatus.totaalElement,
    geenVoorkeurElement: !!formStatus.geenVoorkeurElement,
    emptyElement: !!formStatus.emptyElement,
    template: !!formStatus.schoonmakerTemplate,
    prototype: !!formStatus.schoonmakerPrototype
  });

  // Laad schoonmakers (error handling gebeurt in loadCleaners zelf)
  console.log('[Verhuis Schoonmaker Form] Start laden schoonmakers...');
  await loadCleaners(existingChoice);

  // Setup event handlers
  setupEventHandlers();
  
  // 🔙 Setup prev button handler voor terug navigatie
  setupPrevButtonHandler();

  console.log('✅ [Verhuis Schoonmaker Form] ===== INITIALISATIE COMPLEET =====');
}

/**
 * Laadt beschikbare schoonmakers van de API
 */
async function loadCleaners(existingChoice) {
  console.log('📦 [Verhuis Schoonmaker Form] loadCleaners() START');

  // Toon loading state
  updateLoadingState(true);
  
  // Verberg empty state (volgt abonnement patroon: laat wrapper intact)
  if (formStatus.emptyElement) formStatus.emptyElement.style.display = 'none';

  try {
    // Haal flow data op via loadFlowData helper
    const flowData = loadFlowData('verhuis-aanvraag') || {};
    console.log('[Verhuis Schoonmaker Form] Flow data geladen:', flowData);
    
    // Controleer vereiste velden (plaats = globaal veld, vh_datum en vh_uren = form-specific)
    if (!flowData.plaats || !flowData.vh_datum || !flowData.vh_uren) {
      console.error('❌ [Verhuis Schoonmaker Form] Missing required flow data:', {
        plaats: flowData.plaats,
        vh_datum: flowData.vh_datum,
        vh_uren: flowData.vh_uren,
        allKeys: Object.keys(flowData)
      });
      throw new Error('Adres- of opdrachtgegevens ontbreken. Ga terug naar de vorige stap.');
    }

    console.log('🌐 [Verhuis Schoonmaker Form] Fetching cleaners from API...', {
      plaats: flowData.plaats,
      datum: flowData.vh_datum,
      uren: flowData.vh_uren,
      type: 'verhuis_opleverschoonmaak'
    });
    
    const response = await fetchAvailableCleaners({
      plaats: flowData.plaats,
      datum: flowData.vh_datum,
      minUren: flowData.vh_uren,
      type: 'verhuis_opleverschoonmaak' // Signal to use verhuis endpoint
    });

    console.log('📨 [Verhuis Schoonmaker Form] API response:', { 
      type: typeof response,
      hasCleaners: 'cleaners' in response,
      data: response
    });

    // Extract cleaners array from response object (fix voor object vs array issue)
    const cleaners = response.cleaners || response;
    console.log('👥 [Verhuis Schoonmaker Form] Extracted cleaners array:', {
      isArray: Array.isArray(cleaners),
      length: cleaners?.length,
      data: cleaners
    });

    if (cleaners.length === 0) {
      console.warn('⚠️ [Verhuis Schoonmaker Form] Geen schoonmakers gevonden');
      if (formStatus.emptyElement) {
        formStatus.emptyElement.style.display = 'block';
      }
      return;
    }

    // Render schoonmakers (wrapper styling blijft intact - volgt abonnement patroon)
    console.log('[Verhuis Schoonmaker Form] Start rendering schoonmakers...');
    renderCleaners(cleaners, existingChoice);

  } catch (error) {
    console.error('❌ [Verhuis Schoonmaker Form] ERROR in loadCleaners:', error);
    console.error('[Verhuis Schoonmaker Form] Error stack:', error.stack);
    
    // Toon empty state
    if (formStatus.emptyElement) {
      formStatus.emptyElement.style.display = 'block';
    }
  } finally {
    updateLoadingState(false);
  }
  
  console.log('✅ [Verhuis Schoonmaker Form] loadCleaners() COMPLEET');
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
    console.error('❌ [Verhuis Schoonmaker Form] Geen schoonmaker template beschikbaar om te klonen');
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
  console.log('🎨 [Verhuis Schoonmaker Form] renderCleaners() START');
  console.log(`[Verhuis Schoonmaker Form] Rendering ${cleaners.length} cleaners`);

  if (!formStatus.schoonmakersWrapper) {
    console.error('❌ [Verhuis Schoonmaker Form] Geen schoonmakers wrapper gevonden');
    return;
  }

  // Leeg de wrapper (maar laat template intact) - VOLGT ABONNEMENT PATROON
  Array.from(formStatus.schoonmakersWrapper.children).forEach(child => {
    if (child !== formStatus.schoonmakerTemplate) {
      child.remove();
    }
  });
  
  console.log('[Verhuis Schoonmaker Form] Wrapper geleegd, start rendering...');

  // Update totaal met mooie tekst (VOLGT ABONNEMENT PATROON)
  formStatus.totaalSchoonmakers = cleaners.length;
  try {
    if (formStatus.totaalElement) {
      if (cleaners.length > 0) {
        formStatus.totaalElement.style.display = '';
        const schoonmakerText = cleaners.length === 1 ? 'schoonmaker' : 'schoonmakers';
        formStatus.totaalElement.textContent = `${cleaners.length} ${schoonmakerText} beschikbaar`;
      } else {
        formStatus.totaalElement.style.display = 'none';
        formStatus.totaalElement.textContent = '';
      }
    }
  } catch (e) {
    console.error('[Verhuis Schoonmaker Form] Error updating totaalElement:', e);
  }

  // Geen voorkeur element tonen/verbergen (VOLGT ABONNEMENT PATROON)
  try {
    if (formStatus.geenVoorkeurElement) {
      formStatus.geenVoorkeurElement.style.display = cleaners.length > 0 ? '' : 'none';
    }
  } catch (e) {
    console.error('[Verhuis Schoonmaker Form] Error updating geenVoorkeurElement:', e);
  }

  // Empty element tonen/verbergen (VOLGT ABONNEMENT PATROON)
  try {
    if (formStatus.emptyElement) {
      formStatus.emptyElement.style.display = cleaners.length === 0 ? '' : 'none';
    }
  } catch (e) {
    console.error('[Verhuis Schoonmaker Form] Error updating emptyElement:', e);
  }

  if (cleaners.length === 0) {
    console.warn('[Verhuis Schoonmaker Form] Geen schoonmakers om te renderen');
    return;
  }

  // Render elke schoonmaker
  cleaners.forEach((cleaner, index) => {
    console.log(`[Verhuis Schoonmaker Form] Rendering cleaner ${index + 1}/${cleaners.length}:`, {
      id: cleaner.id,
      naam: cleaner.voornaam,
      plaats: cleaner.plaats
    });
    
    const schoonmakerEl = renderSchoonmaker(cleaner);
    if (schoonmakerEl) {
      formStatus.schoonmakersWrapper.appendChild(schoonmakerEl);
      console.log(`[Verhuis Schoonmaker Form] ✅ Card ${index + 1} toegevoegd`);
    }
  });

  // Voeg "Geen voorkeur" optie toe (met auto-assign)
  addNoPreferenceOption(cleaners);

  // Clear selectie (submit button disabled tot keuze gemaakt)
  clearSchoonmakerKeuze();

  // Bind events op nieuwe radio's
  bindSchoonmakerRadioEvents();
  
  console.log('✅ [Verhuis Schoonmaker Form] renderCleaners() COMPLEET');
}

/**
 * Voeg "Geen voorkeur" optie toe (volgt abonnement patroon)
 */
function addNoPreferenceOption(schoonmakersList = []) {
  if (!formStatus.geenVoorkeurElement) {
    console.warn('⚠️ [Verhuis Schoonmaker Form] Geen voorkeur element niet gevonden');
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
      console.log('✅ [Verhuis Schoonmaker Form] Auto-assign ID gezet:', schoonmakersList[0].id);
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
    console.warn('[Verhuis Schoonmaker Form] Kon keuze reset niet volledig doorvoeren:', e);
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
      console.log('[Verhuis Schoonmaker Form] Radio changed:', e.target.value);
      
      try {
        if (formHandler && typeof formHandler.handleInput === 'function') {
          formHandler.handleInput('schoonmakerKeuze', e, FORM_NAME);
        }
        if (formHandler && typeof formHandler.updateSubmitState === 'function') {
          formHandler.updateSubmitState(FORM_NAME);
        }
      } catch (err) {
        console.warn('[Verhuis Schoonmaker Form] Kon radio change niet verwerken:', err);
      }
    });
    
    radio.dataset.bound = '1';
  });
  
  console.log(`[Verhuis Schoonmaker Form] Events gebonden op ${radios.length} radio buttons`);
}

/**
 * Rendert beschikbaarheid grid visueel (volgt abonnement patroon)
 * Toont welke dagdelen beschikbaar zijn op basis van uren/dagdeel analyse
 */
function renderBeschikbaarheidGrid(card, beschikbaarheid) {
  if (!beschikbaarheid || !Array.isArray(beschikbaarheid)) {
    console.log('[Verhuis Schoonmaker Form] No beschikbaarheid data');
    return;
  }

  console.log('[Verhuis Schoonmaker Form] Rendering beschikbaarheid grid:', beschikbaarheid);

  try {
    // Haal benodigde uren op uit flow data
    const flowData = loadFlowData('verhuis-aanvraag') || {};
    const requiredHours = parseFloat(flowData.vh_uren) || 0;
    
    // Bereken dagdeel beschikbaarheid (volgt abonnement logica)
    const daypartAvailability = berekenDagdeelBeschikbaarheid(beschikbaarheid, requiredHours);
    
    // Update alle dagdeel elementen
    const daypartElems = card.querySelectorAll('[data-field-name="schoonmaker-dagdeel"]');
    daypartElems.forEach(el => {
      const key = el.getAttribute('data-schoonmaker-dagdeel'); // bv ma-ochtend
      const isAvailable = !!daypartAvailability[key];
      
      // Vind child wrappers (vinkje en kruisje)
      const availEl = el.querySelector('.beschikbaarheid_item_check-wrp.is-available');
      const unavailEl = el.querySelector('.beschikbaarheid_item_check-wrp.is-unavalable, .beschikbaarheid_item_check-wrp.is-unavailable');
      
      // Toon vinkje of kruisje (nooit beide)
      if (availEl) availEl.style.display = isAvailable ? 'flex' : 'none';
      if (unavailEl) unavailEl.style.display = isAvailable ? 'none' : 'flex';
    });
  } catch (e) {
    console.warn('[Verhuis Schoonmaker Form] Kon dagdeel beschikbaarheid niet renderen:', e);
  }
}

/**
 * Berekent dagdeel beschikbaarheid op basis van ruwe beschikbaarheidsuren
 * (Identiek aan abonnement logica voor consistentie)
 * @param {Array} slots - Array van { dag, uur, status } objecten
 * @param {number} requiredHours - Aantal benodigde uren
 * @returns {Object} mapping 'ma-ochtend' => boolean
 */
function berekenDagdeelBeschikbaarheid(slots, requiredHours) {
  const result = {};
  if (!Array.isArray(slots) || slots.length === 0) return result;
  
  // Dag mapping (Nederlands → afkorting)
  const dayMap = { 
    maandag: 'ma', 
    dinsdag: 'di', 
    woensdag: 'wo', 
    donderdag: 'do', 
    vrijdag: 'vr', 
    zaterdag: 'za', 
    zondag: 'zo' 
  };
  
  // Dagdeel tijdsvakken (start inclusive, end exclusive)
  const dayparts = [
    { code: 'ochtend', start: 7, end: 12 },
    { code: 'middag', start: 12, end: 17 },
    { code: 'avond', start: 17, end: 22 }
  ];
  
  // Groepeer beschikbare uren per dag
  const byDay = {};
  slots.forEach(s => {
    if (s.status !== 'beschikbaar') return;
    const h = parseInt(String(s.uur).split(':')[0], 10);
    if (isNaN(h)) return;
    if (!byDay[s.dag]) byDay[s.dag] = new Set();
    byDay[s.dag].add(h);
  });
  
  // Helper: vind aaneengesloten uurblokken
  function contiguousBlocks(hourSet) {
    const hours = Array.from(hourSet).sort((a,b) => a - b);
    const blocks = [];
    let start = null, prev = null;
    
    hours.forEach(h => {
      if (start === null) { 
        start = h; 
        prev = h; 
        return; 
      }
      if (h === prev + 1) { 
        prev = h; 
        return; 
      }
      // Block eindigt
      blocks.push({ start, end: prev + 1, length: (prev + 1) - start });
      start = h; 
      prev = h;
    });
    
    if (start !== null) {
      blocks.push({ start, end: prev + 1, length: (prev + 1) - start });
    }
    
    return blocks;
  }
  
  // Analyseer elk dagdeel per dag
  Object.entries(byDay).forEach(([dag, hourSet]) => {
    const blocks = contiguousBlocks(hourSet);
    
    dayparts.forEach(dp => {
      const key = `${dayMap[dag] || ''}-${dp.code}`;
      let available = false;
      
      // BELANGRIJKE WIJZIGING: Toon dagdeel als beschikbaar als er ENIGE overlap is
      // Dit is logischer voor eenmalige diensten: als ze om 10:00 starten met 6 uur werk,
      // kunnen ze in principe ook in de avond werken (vanaf 17:00) als ze dat willen
      
      // Check of er minimaal 1 uur overlap is tussen blokken en dagdeel
      available = blocks.some(b => {
        const overlapStart = Math.max(b.start, dp.start);
        const overlapEnd = Math.min(b.end, dp.end);
        return overlapStart < overlapEnd; // Er is overlap als start < end
      });
      
      result[key] = available;
    });
  });
  
  return result;
}

/**
 * Setup event handlers voor formulier
 * Submit wordt afgehandeld door formHandler via schema
 */
function setupEventHandlers() {
  console.log('[Verhuis Schoonmaker Form] Event handlers setup - radio events worden gebonden na render');
  // Radio events worden gebonden in bindSchoonmakerRadioEvents() na rendering
  // Submit wordt afgehandeld door formHandler via schema.submit.action
}

/**
 * Setup prev button handler voor terug navigatie
 * Re-initialiseert stap 2 (opdracht) voordat er terug wordt genavigeerd
 */
// Store handler reference om duplicate listeners te voorkomen
let prevButtonHandler = null;

function setupPrevButtonHandler() {
  const prevButton = document.querySelector('[data-form-button-prev="vh_schoonmaker-form"]');
  
  if (!prevButton) {
    console.log('[Verhuis Schoonmaker Form] Geen prev button gevonden met [data-form-button-prev="vh_schoonmaker-form"]');
    return;
  }
  
  console.log('[Verhuis Schoonmaker Form] Prev button gevonden, event handler toevoegen...');
  
  // Verwijder oude handler indien aanwezig
  if (prevButtonHandler) {
    prevButton.removeEventListener('click', prevButtonHandler);
    console.log('[Verhuis Schoonmaker Form] ♻️ Oude prev button handler verwijderd');
  }
  
  // Definieer nieuwe handler
  prevButtonHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[Verhuis Schoonmaker Form] 🔙 Prev button clicked - navigeer naar stap 2 (opdracht)');
    
    // Re-initialiseer de VORIGE stap (stap 2 = verhuisOpdrachtForm) VOOR navigatie
    import('./verhuisOpdrachtForm.js').then(module => {
      console.log('[Verhuis Schoonmaker Form] ♻️ Re-init verhuisOpdrachtForm voor terug navigatie...');
      module.initVerhuisOpdrachtForm();
      
      // NA re-init, ga naar vorige slide via Webflow functie
      if (typeof window.moveToPrevSlide === 'function') {
        console.log('[Verhuis Schoonmaker Form] Roep window.moveToPrevSlide() aan');
        window.moveToPrevSlide();
      } else {
        console.warn('[Verhuis Schoonmaker Form] window.moveToPrevSlide() niet beschikbaar, probeer fallback');
        // Fallback: probeer directe Splide navigatie
        const splideEl = document.querySelector('.splide');
        if (splideEl && splideEl.splide) {
          splideEl.splide.go('-1');
        }
      }
    }).catch(err => {
      console.error('[Verhuis Schoonmaker Form] ❌ Fout bij re-init verhuisOpdrachtForm:', err);
      // Navigeer alsnog terug bij fout
      if (typeof window.moveToPrevSlide === 'function') {
        window.moveToPrevSlide();
      }
    });
  };
  
  // Voeg nieuwe handler toe
  prevButton.addEventListener('click', prevButtonHandler);
  
  console.log('[Verhuis Schoonmaker Form] ✅ Prev button handler toegevoegd');
}
