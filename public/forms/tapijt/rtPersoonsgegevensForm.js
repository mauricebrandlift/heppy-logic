// public/forms/tapijt/rtPersoonsgegevensForm.js
// Persoonsgegevens stap voor tapijt reiniging offerte aanvraag

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { saveFlowData, loadFlowData } from '../logic/formStorage.js';
import { authClient } from '../../utils/auth/authClient.js';
import { logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';
import { API_CONFIG } from '../../config/apiConfig.js';
import { apiClient } from '../../utils/api/client.js';

const FORM_NAME = 'rt_persoonsgegevens-form';
const FLOW_KEY = 'tapijt-aanvraag';

function goToFormStep(nextFormName) {
  console.log('[RtPersoonsgegevens] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[RtPersoonsgegevens] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[RtPersoonsgegevens] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[RtPersoonsgegevens] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[RtPersoonsgegevens] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[RtPersoonsgegevens] Geen slider navigatie functie gevonden.');
  return false;
}

export async function initRtPersoonsgegevensForm() {
  console.log('👤 [RtPersoonsgegevens] Initialiseren…');
  
  const schema = getFormSchema(FORM_NAME);
  if (!schema) {
    console.error('[RtPersoonsgegevens] Schema niet gevonden');
    return;
  }

  // Zorg dat schema.name is gezet
  schema.name = FORM_NAME;

  // ========== AUTH STATE DETECTION ==========
  // Check auth state bij load en toggle de juiste wrapper
  console.log('🔍 [RtPersoonsgegevens] Checking auth state...');
  const authState = authClient.getAuthState();
  const role = authState?.role || 'guest';
  console.log(`👤 [RtPersoonsgegevens] Auth state detected: ${role}`);
  
  if (authState?.user) {
    console.log('👤 [RtPersoonsgegevens] User info:', {
      id: authState.user.id,
      email: authState.user.email || authState.user.emailadres,
      role: authState.user.role
    });
  } else {
    console.log('👤 [RtPersoonsgegevens] Geen authenticated user gevonden');
  }
  
  toggleAuthWrappers(role);

  // Als klant: prefill met profiel data VOOR readonly fields worden toegepast
  if (role === 'klant' && authState?.user) {
    console.log('🔄 [RtPersoonsgegevens] Klant detected, starten prefill...');
    await prefillAuthenticatedUser(authState.user);
  } else {
    console.log('ℹ️ [RtPersoonsgegevens] Guest mode, geen prefill nodig');
  }
  
  // Apply readonly fields NA prefill zodat values al zijn ingesteld
  applyReadonlyFields();

  // Luister naar auth:success event (na login via modal)
  document.addEventListener('auth:success', handleAuthSuccess);
  console.log('👂 [RtPersoonsgegevens] Luistert naar auth:success events');
  
  // Luister naar auth:state-changed event (na logout)
  document.addEventListener('auth:state-changed', handleAuthStateChanged);
  console.log('👂 [RtPersoonsgegevens] Luistert naar auth:state-changed events');

  // ========== FORM HANDLER SETUP ==========
  schema.submit = {
    action: async (formData) => {
      const flow = loadFlowData(FLOW_KEY) || {};
      
      // Check auth state
      const currentAuthState = authClient.getAuthState();
      const isGuest = !currentAuthState || currentAuthState.role === 'guest';
      
      // Als guest: check of email al bestaat
      if (isGuest && formData.emailadres) {
        console.log('🔍 [RtPersoonsgegevens] Guest aanvraag, checking email beschikbaarheid...');
        console.log('📧 [RtPersoonsgegevens] Email to check:', formData.emailadres);
        
        try {
          const checkUrl = `${API_CONFIG.BASE_URL}/routes/auth/check-email?email=${encodeURIComponent(formData.emailadres)}`;
          console.log('🌐 [RtPersoonsgegevens] Fetching:', checkUrl);
          
          const checkResponse = await fetch(checkUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          console.log('📥 [RtPersoonsgegevens] Response status:', checkResponse.status, checkResponse.ok);
          
          const checkData = await checkResponse.json();
          console.log('📦 [RtPersoonsgegevens] Response data:', checkData);
          
          if (!checkResponse.ok) {
            console.error('❌ [RtPersoonsgegevens] API error:', checkResponse.status, checkData);
            // Bij API error: laat door (fail open voor betere UX)
            console.warn('⚠️ [RtPersoonsgegevens] Continuing despite API error');
            return; // Exit early, laat submit doorgaan
          }
          
          if (checkData.exists === true) {
            console.warn('⚠️ [RtPersoonsgegevens] Email bestaat al:', formData.emailadres);
            
            // Gooi error met user-friendly message die formHandler kan tonen
            throw new Error('Dit e-mailadres is al in gebruik. Log in of gebruik een ander e-mailadres.');
          }
          
          console.log('✅ [RtPersoonsgegevens] Email is beschikbaar, continuing...');
        } catch (error) {
          console.error('🔥 [RtPersoonsgegevens] Catch block:', error.message);
          
          // Als het een user-facing error is (email bestaat), gooi door naar formHandler
          if (error.message.includes('e-mailadres is al in gebruik')) {
            console.log('🛑 [RtPersoonsgegevens] Blocking submit - email exists');
            throw error; // formHandler zal deze message tonen in [data-error-for="global"]
          }
          
          // Netwerk error: log maar block niet
          console.error('❌ [RtPersoonsgegevens] Email check failed (network):', error);
          console.warn('⚠️ [RtPersoonsgegevens] Continuing despite email check failure (network issue)');
        }
      } else {
        console.log('ℹ️ [RtPersoonsgegevens] Skipping email check (not guest or no email):', { isGuest, email: formData.emailadres });
      }
      
      // Sla persoonsgegevens op
      flow.voornaam = formData.voornaam;
      flow.achternaam = formData.achternaam;
      flow.telefoonnummer = formData.telefoonnummer;
      flow.emailadres = formData.emailadres;
      
      // Wachtwoord opslaan voor guest users (OPTIONEEL voor offerte flow)
      // Voor authenticated users slaan we geen wachtwoord op
      if (isGuest && formData.wachtwoord) {
        flow.wachtwoord = formData.wachtwoord;
      }
      
      // Markeer of user authenticated is voor latere account creatie logica
      if (currentAuthState?.role === 'klant') {
        flow.authenticatedUserId = currentAuthState.user?.id;
      }
      
      saveFlowData(FLOW_KEY, flow);
      
      console.log('✅ [RtPersoonsgegevens] Persoonsgegevens opgeslagen:', {
        voornaam: formData.voornaam,
        achternaam: formData.achternaam,
        emailadres: formData.emailadres,
        telefoonnummer: formData.telefoonnummer,
        isAuthenticated: currentAuthState?.role === 'klant'
      });
    },
    onSuccess: async () => {
      console.log('✅ [RtPersoonsgegevens] Opgeslagen, verstuur offerte aanvraag naar backend…');
      
      // Track step 5 completion
      await logStepCompleted('tapijt', 'persoonsgegevens', 5, {
        flow: FLOW_KEY,
        authenticated: authClient.getAuthState()?.role === 'klant'
      });
      
      // STAP: Verstuur offerte aanvraag naar backend
      try {
        console.log('📤 [RtPersoonsgegevens] Sending offerte aanvraag to API...');
        
        // Laad ALLE flow data
        const flow = loadFlowData(FLOW_KEY) || {};
        console.log('📦 [RtPersoonsgegevens] Flow data geladen:', flow);
        
        // Prepare request body
        const requestBody = {
          type: 'tapijt',
          // Persoonsgegevens
          voornaam: flow.voornaam,
          achternaam: flow.achternaam,
          email: flow.emailadres,
          telefoon: flow.telefoonnummer,
          wachtwoord: flow.wachtwoord || null,  // Optioneel voor offerte
          // Adres
          straat: flow.straatnaam,
          huisnummer: flow.huisnummer,
          toevoeging: flow.toevoeging || null,
          postcode: flow.postcode,
          plaats: flow.plaats,
          // Dagdelen voorkeur
          dagdelenVoorkeur: flow.dagdelenVoorkeur || null,
          geenVoorkeurDagdelen: flow.geenVoorkeurDagdelen || false,
          // Tapijt reiniging specifieke data
          rt_totaal_m2: flow.rt_totaal_m2,
          rt_opties: flow.opties || [],
          rt_opties_allergie: flow.rt_opties_allergie || false,
          rt_opties_ontgeuren_urine: flow.rt_opties_ontgeuren_urine || false,
          rt_opties_ontgeuren_overig: flow.rt_opties_ontgeuren_overig || false
        };
        
        console.log('📋 [RtPersoonsgegevens] Request body:', requestBody);
        
        // API call via apiClient wrapper (handles CORS, headers, timeout, error handling)
        const data = await apiClient('/routes/offerte-create', {
          method: 'POST',
          body: JSON.stringify(requestBody)
        }, 10000); // 10 second timeout voor offerte creatie
        console.log('✅ [RtPersoonsgegevens] Offerte aanvraag succesvol:', data);
        
        // Clear flow data (aanvraag is verstuurd)
        localStorage.removeItem(FLOW_KEY);
        console.log('🗑️ [RtPersoonsgegevens] Flow data verwijderd uit localStorage');
        
        // Navigate naar success pagina
        console.log('📍 [RtPersoonsgegevens] Navigeer naar success pagina...');
        window.location.href = '/aanvragen/succes/reinigen-tapijt';
        
      } catch (error) {
        console.error('❌ [RtPersoonsgegevens] Offerte aanvraag failed:', error);
        // Error wordt getoond door formHandler in global error div
        throw error;
      }
    }
  };
  
  // Custom validatie: alleen valideer velden in de zichtbare wrapper
  schema.shouldValidateField = (fieldName, fieldElement) => {
    if (!fieldElement) return false;
    
    // Check of het veld in een auth-state wrapper zit
    const wrapper = fieldElement.closest('[data-auth-state]');
    if (!wrapper) {
      // Geen wrapper, altijd valideren
      return true;
    }
    
    // Alleen valideren als de wrapper zichtbaar is
    const isVisible = wrapper.style.display !== 'none';
    if (!isVisible) {
      console.log(`⏭️ [RtPersoonsgegevens] Skip validatie voor ${fieldName} (wrapper hidden)`);
    }
    return isVisible;
  };

  formHandler.init(schema);

  // Prefill vanuit flow als aanwezig
  const flow = loadFlowData(FLOW_KEY) || {};
  const formEl = document.querySelector(schema.selector);
  if (formEl) {
    const map = {
      voornaam: flow.voornaam,
      achternaam: flow.achternaam,
      telefoonnummer: flow.telefoonnummer,
      emailadres: flow.emailadres,
    };
    Object.entries(map).forEach(([k, v]) => {
      if (v != null) {
        const el = formEl.querySelector(`[data-field-name="${k}"]`);
        if (el) el.value = v;
        formHandler.formData[k] = String(v);
      }
    });
    // Na prefill: update submit state
    if (typeof formHandler.updateSubmitState === 'function') {
      formHandler.updateSubmitState(FORM_NAME);
    }
  }
  
  // 🔙 PREV BUTTON HANDLER - Re-initialiseer vorige stap bij terug navigeren
  setupPrevButtonHandler();
}

/**
 * Setup prev button handler voor terug navigatie
 * Re-initialiseert stap 4 (overzicht) voordat er terug wordt genavigeerd
 */
// Store handler reference om duplicate listeners te voorkomen
let prevButtonHandler = null;

function setupPrevButtonHandler() {
  const prevButton = document.querySelector('[data-form-button-prev="rt_persoonsgegevens-form"]');
  
  if (!prevButton) {
    console.log('[RtPersoonsgegevens] Geen prev button gevonden met [data-form-button-prev="rt_persoonsgegevens-form"]');
    return;
  }
  
  console.log('[RtPersoonsgegevens] Prev button gevonden, event handler toevoegen...');
  
  // Verwijder oude handler indien aanwezig
  if (prevButtonHandler) {
    prevButton.removeEventListener('click', prevButtonHandler);
    console.log('[RtPersoonsgegevens] ♻️ Oude prev button handler verwijderd');
  }
  
  // Definieer nieuwe handler
  prevButtonHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[RtPersoonsgegevens] 🔙 Prev button clicked - navigeer naar stap 4 (overzicht)');
    
    // Re-initialiseer de VORIGE stap (stap 4 = tapijtOverzichtForm) VOOR navigatie
    import('./tapijtOverzichtForm.js').then(module => {
      console.log('[RtPersoonsgegevens] ♻️ Re-init tapijtOverzichtForm voor terug navigatie...');
      module.initTapijtOverzichtForm();
      
      // NA re-init, ga naar vorige slide
      if (typeof window.moveToPrevSlide === 'function') {
        console.log('[RtPersoonsgegevens] Roep window.moveToPrevSlide() aan');
        window.moveToPrevSlide();
      } else {
        console.warn('[RtPersoonsgegevens] window.moveToPrevSlide() niet beschikbaar');
      }
    }).catch(err => {
      console.error('[RtPersoonsgegevens] ❌ Fout bij re-init tapijtOverzicht:', err);
      if (typeof window.moveToPrevSlide === 'function') {
        window.moveToPrevSlide();
      }
    });
  };
  
  // Voeg nieuwe handler toe
  prevButton.addEventListener('click', prevButtonHandler);
  
  console.log('[RtPersoonsgegevens] ✅ Prev button handler toegevoegd');
}

// ========== AUTH HELPER FUNCTIONS ==========

/**
 * Toggle visibility van auth state wrappers op basis van rol
 * @param {string} role - De huidige rol (guest, klant, admin, schoonmaker)
 */
function toggleAuthWrappers(role) {
  console.log(`🔄 [RtPersoonsgegevens] Toggling wrappers voor role: ${role}`);
  
  const wrappers = document.querySelectorAll('[data-auth-state]');
  console.log(`📦 [RtPersoonsgegevens] Gevonden ${wrappers.length} wrapper(s) met [data-auth-state]`);
  
  let visibleCount = 0;
  let hiddenCount = 0;
  
  wrappers.forEach(wrapper => {
    const wrapperRole = wrapper.getAttribute('data-auth-state');
    if (wrapperRole === role) {
      wrapper.style.display = ''; // Toon
      visibleCount++;
      console.log(`👁️ [RtPersoonsgegevens] ✅ Wrapper "${wrapperRole}" GETOOND`);
    } else {
      wrapper.style.display = 'none'; // Verberg
      hiddenCount++;
      console.log(`👁️ [RtPersoonsgegevens] ❌ Wrapper "${wrapperRole}" verborgen`);
    }
  });
  
  console.log(`📊 [RtPersoonsgegevens] Wrapper toggle compleet: ${visibleCount} zichtbaar, ${hiddenCount} verborgen`);
}

/**
 * Pas readonly attribuut toe op velden met data-readonly="true"
 * Webflow workaround: kan niet direct readonly zetten, dus via JS
 */
function applyReadonlyFields() {
  console.log('🔒 [RtPersoonsgegevens] Applying readonly fields...');
  
  const readonlyFields = document.querySelectorAll('[data-readonly="true"]');
  console.log(`📋 [RtPersoonsgegevens] Gevonden ${readonlyFields.length} readonly veld(en)`);
  
  readonlyFields.forEach(field => {
    field.setAttribute('readonly', 'readonly');
    field.classList.add('is-readonly'); // Voor eventuele styling
    const fieldName = field.getAttribute('data-field-name') || field.name || 'unknown';
    console.log(`🔒 [RtPersoonsgegevens] ✅ Veld "${fieldName}" set to readonly`);
  });
  
  if (readonlyFields.length > 0) {
    console.log('✅ [RtPersoonsgegevens] Readonly fields toegepast');
  }
}

/**
 * Prefill formulier met authenticated user data
 * @param {Object} user - User object van authClient
 */
async function prefillAuthenticatedUser(user) {
  console.log('👤 [RtPersoonsgegevens] === START PREFILL ===');
  console.log('👤 [RtPersoonsgegevens] User object ontvangen:', {
    id: user?.id,
    email: user?.email || user?.emailadres,
    role: user?.role,
    voornaam: user?.voornaam,
    achternaam: user?.achternaam,
    telefoonnummer: user?.telefoonnummer
  });
  
  try {
    if (!user) {
      console.warn('⚠️ [RtPersoonsgegevens] Geen user data beschikbaar');
      return;
    }

    const formEl = document.querySelector(`[data-form-name="${FORM_NAME}"]`);
    if (!formEl) {
      console.warn('⚠️ [RtPersoonsgegevens] Formulier element niet gevonden voor:', FORM_NAME);
      return;
    }

    console.log('✅ [RtPersoonsgegevens] Formulier element gevonden');
    
    // Zoek de zichtbare klant wrapper
    const klantWrapper = formEl.querySelector('[data-auth-state="klant"]');
    if (!klantWrapper) {
      console.warn('⚠️ [RtPersoonsgegevens] Klant wrapper niet gevonden');
      return;
    }
    
    console.log('✅ [RtPersoonsgegevens] Klant wrapper gevonden');

    // Map user data naar form velden
    const fieldMap = {
      voornaam: user.voornaam || '',
      achternaam: user.achternaam || '',
      telefoonnummer: user.telefoonnummer || '',
      emailadres: user.emailadres || user.email || ''
    };

    console.log('📋 [RtPersoonsgegevens] Field map voor prefill:', fieldMap);

    // Prefill velden - ZOEK IN DE KLANT WRAPPER
    let prefilledCount = 0;
    let skippedCount = 0;
    
    Object.entries(fieldMap).forEach(([fieldName, value]) => {
      if (value != null && value !== '') {
        // Zoek veld BINNEN de klant wrapper
        const field = klantWrapper.querySelector(`[data-field-name="${fieldName}"]`);
        if (field) {
          console.log(`🔍 [RtPersoonsgegevens] Veld "${fieldName}" gevonden. Current value: "${field.value}", Setting to: "${value}"`);
          field.value = value;
          formHandler.formData[fieldName] = String(value);
          console.log(`🔍 [RtPersoonsgegevens] Na update - DOM value: "${field.value}", formData: "${formHandler.formData[fieldName]}"`);
          
          // Check in welke wrapper het veld zit
          const wrapper = field.closest('[data-auth-state]');
          if (wrapper) {
            const wrapperState = wrapper.getAttribute('data-auth-state');
            const wrapperDisplay = window.getComputedStyle(wrapper).display;
            console.log(`🔍 [RtPersoonsgegevens] Veld "${fieldName}" zit in wrapper "${wrapperState}", display: ${wrapperDisplay}`);
          }
          
          prefilledCount++;
          console.log(`✅ [RtPersoonsgegevens] Prefilled ${fieldName}: "${value}"`);
        } else {
          console.warn(`⚠️ [RtPersoonsgegevens] Field niet gevonden: ${fieldName}`);
        }
      } else {
        skippedCount++;
        console.log(`ℹ️ [RtPersoonsgegevens] Skipped ${fieldName} (geen waarde)`);
      }
    });

    console.log(`📊 [RtPersoonsgegevens] Prefill stats: ${prefilledCount} gevuld, ${skippedCount} overgeslagen`);

    // Sla ook op in flow storage met authenticated flag
    const flow = loadFlowData(FLOW_KEY) || {};
    flow.voornaam = fieldMap.voornaam;
    flow.achternaam = fieldMap.achternaam;
    flow.telefoonnummer = fieldMap.telefoonnummer;
    flow.emailadres = fieldMap.emailadres;
    flow.authenticatedUserId = user.id;
    saveFlowData(FLOW_KEY, flow);

    console.log('✅ [RtPersoonsgegevens] Flow data bijgewerkt met authenticated user info');
    
    // Update submit button state na prefill
    if (typeof formHandler.updateSubmitState === 'function') {
      formHandler.updateSubmitState(FORM_NAME);
      console.log('✅ [RtPersoonsgegevens] Submit state bijgewerkt na prefill');
    }

  } catch (error) {
    console.error('❌ [RtPersoonsgegevens] Fout bij prefill:', error);
  }
  
  console.log('👤 [RtPersoonsgegevens] === EINDE PREFILL ===');
}

/**
 * Handle auth:success event (na login via modal)
 * @param {CustomEvent} event - Event met user data
 */
async function handleAuthSuccess(event) {
  console.log('🎉 [RtPersoonsgegevens] auth:success event ontvangen');
  
  const user = event.detail?.user;
  if (!user) {
    console.warn('⚠️ [RtPersoonsgegevens] Geen user data in auth:success event');
    return;
  }

  console.log('👤 [RtPersoonsgegevens] User logged in:', {
    id: user.id,
    email: user.email || user.emailadres,
    role: user.role
  });

  // Toggle naar klant wrapper
  toggleAuthWrappers('klant');
  
  // Prefill met user data
  await prefillAuthenticatedUser(user);
  
  // Apply readonly fields
  applyReadonlyFields();
  
  console.log('✅ [RtPersoonsgegevens] Auth success afgehandeld');
}

/**
 * Handle auth:state-changed event (na logout)
 * @param {CustomEvent} event - Event met nieuwe auth state
 */
function handleAuthStateChanged(event) {
  console.log('🔄 [RtPersoonsgegevens] auth:state-changed event ontvangen');
  
  const newState = event.detail;
  const role = newState?.role || 'guest';
  
  console.log('👤 [RtPersoonsgegevens] Nieuwe auth state:', role);
  
  // Toggle naar nieuwe wrapper
  toggleAuthWrappers(role);
  
  // Als guest: clear readonly fields
  if (role === 'guest') {
    const readonlyFields = document.querySelectorAll('[data-readonly="true"]');
    readonlyFields.forEach(field => {
      field.removeAttribute('readonly');
      field.classList.remove('is-readonly');
      field.value = ''; // Clear waarde
    });
    
    // Clear flow data
    const flow = loadFlowData(FLOW_KEY) || {};
    delete flow.voornaam;
    delete flow.achternaam;
    delete flow.telefoonnummer;
    delete flow.emailadres;
    delete flow.authenticatedUserId;
    saveFlowData(FLOW_KEY, flow);
    
    console.log('✅ [RtPersoonsgegevens] Guest mode: fields gecleared');
  }
}
