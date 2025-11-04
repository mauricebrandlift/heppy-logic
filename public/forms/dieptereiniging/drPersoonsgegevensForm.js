// public/forms/dieptereiniging/drPersoonsgegevensForm.js

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { saveFlowData, loadFlowData } from '../logic/formStorage.js';
import { authClient } from '../../utils/auth/authClient.js';

const FORM_NAME = 'dr_persoonsgegevens-form';
const NEXT_FORM_NAME = 'dr_betaling-form';

function goToFormStep(nextFormName) {
  console.log('[DrPersoonsgegevens] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[DrPersoonsgegevens] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[DrPersoonsgegevens] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[DrPersoonsgegevens] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[DrPersoonsgegevens] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[DrPersoonsgegevens] Geen slider navigatie functie gevonden.');
  return false;
}

export async function initDrPersoonsgegevensForm() {
  console.log('👤 [DrPersoonsgegevens] Initialiseren…');
  
  const schema = getFormSchema(FORM_NAME);
  if (!schema) {
    console.error('[DrPersoonsgegevens] Schema niet gevonden');
    return;
  }

  // Zorg dat schema.name is gezet
  schema.name = FORM_NAME;

  // ========== AUTH STATE DETECTION ==========
  // Check auth state bij load en toggle de juiste wrapper
  console.log('🔍 [DrPersoonsgegevens] Checking auth state...');
  const authState = authClient.getAuthState();
  const role = authState?.role || 'guest';
  console.log(`👤 [DrPersoonsgegevens] Auth state detected: ${role}`);
  
  if (authState?.user) {
    console.log('👤 [DrPersoonsgegevens] User info:', {
      id: authState.user.id,
      email: authState.user.email || authState.user.emailadres,
      role: authState.user.role
    });
  } else {
    console.log('👤 [DrPersoonsgegevens] Geen authenticated user gevonden');
  }
  
  toggleAuthWrappers(role);

  // Als klant: prefill met profiel data VOOR readonly fields worden toegepast
  if (role === 'klant' && authState?.user) {
    console.log('🔄 [DrPersoonsgegevens] Klant detected, starten prefill...');
    await prefillAuthenticatedUser(authState.user);
  } else {
    console.log('ℹ️ [DrPersoonsgegevens] Guest mode, geen prefill nodig');
  }
  
  // Apply readonly fields NA prefill zodat values al zijn ingesteld
  applyReadonlyFields();

  // Luister naar auth:success event (na login via modal)
  document.addEventListener('auth:success', handleAuthSuccess);
  console.log('👂 [DrPersoonsgegevens] Luistert naar auth:success events');
  
  // Luister naar auth:state-changed event (na logout)
  document.addEventListener('auth:state-changed', handleAuthStateChanged);
  console.log('👂 [DrPersoonsgegevens] Luistert naar auth:state-changed events');

  // ========== FORM HANDLER SETUP ==========
  schema.submit = {
    action: async (formData) => {
      const flow = loadFlowData('dieptereiniging-aanvraag') || {};
      
      // Check auth state
      const currentAuthState = authClient.getAuthState();
      const isGuest = !currentAuthState || currentAuthState.role === 'guest';
      
      // Als guest: check of email al bestaat
      if (isGuest && formData.emailadres) {
        console.log('🔍 [DrPersoonsgegevens] Guest aanvraag, checking email beschikbaarheid...');
        console.log('📧 [DrPersoonsgegevens] Email to check:', formData.emailadres);
        
        try {
          const checkUrl = `/api/auth/check-email?email=${encodeURIComponent(formData.emailadres)}`;
          console.log('🌐 [DrPersoonsgegevens] Fetching:', checkUrl);
          
          const checkResponse = await fetch(checkUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          console.log('📥 [DrPersoonsgegevens] Response status:', checkResponse.status, checkResponse.ok);
          
          const checkData = await checkResponse.json();
          console.log('📦 [DrPersoonsgegevens] Response data:', checkData);
          
          if (!checkResponse.ok) {
            console.error('❌ [DrPersoonsgegevens] API error:', checkResponse.status, checkData);
            // Bij API error: laat door (fail open voor betere UX)
            console.warn('⚠️ [DrPersoonsgegevens] Continuing despite API error');
            return; // Exit early, laat submit doorgaan
          }
          
          if (checkData.exists === true) {
            console.warn('⚠️ [DrPersoonsgegevens] Email bestaat al:', formData.emailadres);
            
            // Toon error in het globale error element
            const formEl = document.querySelector(`[data-form-name="${FORM_NAME}"]`);
            const errorEl = formEl?.querySelector('[data-error-for="global"]');
            if (errorEl) {
              errorEl.textContent = 'Dit e-mailadres is al in gebruik. Log in of gebruik een ander e-mailadres.';
              errorEl.classList.remove('hide');
              errorEl.style.display = 'block';
              console.log('🚨 [DrPersoonsgegevens] Error message displayed');
            } else {
              console.error('❌ [DrPersoonsgegevens] Error element not found!');
            }
            
            // Gooi error om submit te stoppen
            throw new Error('Email bestaat al');
          }
          
          console.log('✅ [DrPersoonsgegevens] Email is beschikbaar, continuing...');
        } catch (error) {
          console.error('🔥 [DrPersoonsgegevens] Catch block:', error.message);
          
          if (error.message === 'Email bestaat al') {
            console.log('🛑 [DrPersoonsgegevens] Blocking submit - email exists');
            throw error; // Re-throw om submit te stoppen
          }
          
          // Netwerk error: log maar block niet
          console.error('❌ [DrPersoonsgegevens] Email check failed (network):', error);
          console.warn('⚠️ [DrPersoonsgegevens] Continuing despite email check failure (network issue)');
        }
      } else {
        console.log('ℹ️ [DrPersoonsgegevens] Skipping email check (not guest or no email):', { isGuest, email: formData.emailadres });
      }
      
      flow.voornaam = formData.voornaam;
      flow.achternaam = formData.achternaam;
      flow.telefoonnummer = formData.telefoonnummer;
      flow.emailadres = formData.emailadres;
      
      // Wachtwoord opslaan voor guest users (nodig voor auth user creatie na betaling)
      // Voor authenticated users slaan we geen wachtwoord op
      if (isGuest && formData.wachtwoord) {
        flow.wachtwoord = formData.wachtwoord;
      }
      
      // Markeer of user authenticated is voor latere account creatie logica
      if (currentAuthState?.role === 'klant') {
        flow.authenticatedUserId = currentAuthState.user?.id;
      }
      
      saveFlowData('dieptereiniging-aanvraag', flow);
      
      console.log('✅ [DrPersoonsgegevens] Persoonsgegevens opgeslagen:', {
        voornaam: formData.voornaam,
        achternaam: formData.achternaam,
        emailadres: formData.emailadres,
        telefoonnummer: formData.telefoonnummer,
        isAuthenticated: currentAuthState?.role === 'klant'
      });
    },
    onSuccess: () => {
      console.log('✅ [DrPersoonsgegevens] Opgeslagen, init betaalstap en ga door…');
      import('./drBetalingForm.js')
        .then((m) => {
          if (m && typeof m.initDrBetalingForm === 'function') {
            m.initDrBetalingForm();
          }
          goToFormStep(NEXT_FORM_NAME);
        })
        .catch((err) => {
          console.error('[DrPersoonsgegevens] Kon betaalstap niet laden:', err);
          goToFormStep(NEXT_FORM_NAME);
        });
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
      console.log(`⏭️ [DrPersoonsgegevens] Skip validatie voor ${fieldName} (wrapper hidden)`);
    }
    return isVisible;
  };

  formHandler.init(schema);

  // Prefill vanuit flow als aanwezig
  const flow = loadFlowData('dieptereiniging-aanvraag') || {};
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
  const prevButton = document.querySelector('[data-form-button-prev="dr_persoonsgegevens-form"]');
  
  if (!prevButton) {
    console.log('[DrPersoonsgegevens] Geen prev button gevonden met [data-form-button-prev="dr_persoonsgegevens-form"]');
    return;
  }
  
  console.log('[DrPersoonsgegevens] Prev button gevonden, event handler toevoegen...');
  
  // Verwijder oude handler indien aanwezig
  if (prevButtonHandler) {
    prevButton.removeEventListener('click', prevButtonHandler);
    console.log('[DrPersoonsgegevens] ♻️ Oude prev button handler verwijderd');
  }
  
  // Definieer nieuwe handler
  prevButtonHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[DrPersoonsgegevens] 🔙 Prev button clicked - navigeer naar stap 4 (overzicht)');
    
    // Re-initialiseer de VORIGE stap (stap 4 = drOverzichtForm) VOOR navigatie
    import('./drOverzichtForm.js').then(module => {
      console.log('[DrPersoonsgegevens] ♻️ Re-init drOverzichtForm voor terug navigatie...');
      module.initDrOverzichtForm();
      
      // NA re-init, ga naar vorige slide
      if (typeof window.moveToPrevSlide === 'function') {
        console.log('[DrPersoonsgegevens] Roep window.moveToPrevSlide() aan');
        window.moveToPrevSlide();
      } else {
        console.warn('[DrPersoonsgegevens] window.moveToPrevSlide() niet beschikbaar');
      }
    }).catch(err => {
      console.error('[DrPersoonsgegevens] ❌ Fout bij re-init drOverzicht:', err);
      if (typeof window.moveToPrevSlide === 'function') {
        window.moveToPrevSlide();
      }
    });
  };
  
  // Voeg nieuwe handler toe
  prevButton.addEventListener('click', prevButtonHandler);
  
  console.log('[DrPersoonsgegevens] ✅ Prev button handler toegevoegd');
}

// ========== AUTH HELPER FUNCTIONS ==========

/**
 * Toggle visibility van auth state wrappers op basis van rol
 * @param {string} role - De huidige rol (guest, klant, admin, schoonmaker)
 */
function toggleAuthWrappers(role) {
  console.log(`🔄 [DrPersoonsgegevens] Toggling wrappers voor role: ${role}`);
  
  const wrappers = document.querySelectorAll('[data-auth-state]');
  console.log(`📦 [DrPersoonsgegevens] Gevonden ${wrappers.length} wrapper(s) met [data-auth-state]`);
  
  let visibleCount = 0;
  let hiddenCount = 0;
  
  wrappers.forEach(wrapper => {
    const wrapperRole = wrapper.getAttribute('data-auth-state');
    if (wrapperRole === role) {
      wrapper.style.display = ''; // Toon
      visibleCount++;
      console.log(`👁️ [DrPersoonsgegevens] ✅ Wrapper "${wrapperRole}" GETOOND`);
    } else {
      wrapper.style.display = 'none'; // Verberg
      hiddenCount++;
      console.log(`👁️ [DrPersoonsgegevens] ❌ Wrapper "${wrapperRole}" verborgen`);
    }
  });
  
  console.log(`📊 [DrPersoonsgegevens] Wrapper toggle compleet: ${visibleCount} zichtbaar, ${hiddenCount} verborgen`);
}

/**
 * Pas readonly attribuut toe op velden met data-readonly="true"
 * Webflow workaround: kan niet direct readonly zetten, dus via JS
 */
function applyReadonlyFields() {
  console.log('🔒 [DrPersoonsgegevens] Applying readonly fields...');
  
  const readonlyFields = document.querySelectorAll('[data-readonly="true"]');
  console.log(`📋 [DrPersoonsgegevens] Gevonden ${readonlyFields.length} readonly veld(en)`);
  
  readonlyFields.forEach(field => {
    field.setAttribute('readonly', 'readonly');
    field.classList.add('is-readonly'); // Voor eventuele styling
    const fieldName = field.getAttribute('data-field-name') || field.name || 'unknown';
    console.log(`🔒 [DrPersoonsgegevens] ✅ Veld "${fieldName}" set to readonly`);
  });
  
  if (readonlyFields.length > 0) {
    console.log('✅ [DrPersoonsgegevens] Readonly fields toegepast');
  }
}

/**
 * Prefill formulier met authenticated user data
 * @param {Object} user - User object van authClient
 */
async function prefillAuthenticatedUser(user) {
  console.log('👤 [DrPersoonsgegevens] === START PREFILL ===');
  console.log('👤 [DrPersoonsgegevens] User object ontvangen:', {
    id: user?.id,
    email: user?.email || user?.emailadres,
    role: user?.role,
    voornaam: user?.voornaam,
    achternaam: user?.achternaam,
    telefoonnummer: user?.telefoonnummer
  });
  
  try {
    if (!user) {
      console.warn('⚠️ [DrPersoonsgegevens] Geen user data beschikbaar');
      return;
    }

    const formEl = document.querySelector(`[data-form-name="${FORM_NAME}"]`);
    if (!formEl) {
      console.warn('⚠️ [DrPersoonsgegevens] Formulier element niet gevonden voor:', FORM_NAME);
      return;
    }

    console.log('✅ [DrPersoonsgegevens] Formulier element gevonden');
    
    // Zoek de zichtbare klant wrapper
    const klantWrapper = formEl.querySelector('[data-auth-state="klant"]');
    if (!klantWrapper) {
      console.warn('⚠️ [DrPersoonsgegevens] Klant wrapper niet gevonden');
      return;
    }
    
    console.log('✅ [DrPersoonsgegevens] Klant wrapper gevonden');

    // Map user data naar form velden
    const fieldMap = {
      voornaam: user.voornaam || '',
      achternaam: user.achternaam || '',
      telefoonnummer: user.telefoonnummer || '',
      emailadres: user.emailadres || user.email || ''
    };

    console.log('📋 [DrPersoonsgegevens] Field map voor prefill:', fieldMap);

    // Prefill velden - ZOEK IN DE KLANT WRAPPER
    let prefilledCount = 0;
    let skippedCount = 0;
    
    Object.entries(fieldMap).forEach(([fieldName, value]) => {
      if (value != null && value !== '') {
        // Zoek veld BINNEN de klant wrapper
        const field = klantWrapper.querySelector(`[data-field-name="${fieldName}"]`);
        if (field) {
          console.log(`🔍 [DrPersoonsgegevens] Veld "${fieldName}" gevonden. Current value: "${field.value}", Setting to: "${value}"`);
          field.value = value;
          formHandler.formData[fieldName] = String(value);
          console.log(`🔍 [DrPersoonsgegevens] Na update - DOM value: "${field.value}", formData: "${formHandler.formData[fieldName]}"`);
          
          // Check in welke wrapper het veld zit
          const wrapper = field.closest('[data-auth-state]');
          if (wrapper) {
            const wrapperState = wrapper.getAttribute('data-auth-state');
            const wrapperDisplay = window.getComputedStyle(wrapper).display;
            console.log(`🔍 [DrPersoonsgegevens] Veld "${fieldName}" zit in wrapper "${wrapperState}", display: ${wrapperDisplay}`);
          }
          
          prefilledCount++;
          console.log(`✅ [DrPersoonsgegevens] Prefilled ${fieldName}: "${value}"`);
        } else {
          console.warn(`⚠️ [DrPersoonsgegevens] Field niet gevonden: ${fieldName}`);
        }
      } else {
        skippedCount++;
        console.log(`ℹ️ [DrPersoonsgegevens] Skipped ${fieldName} (geen waarde)`);
      }
    });

    console.log(`📊 [DrPersoonsgegevens] Prefill stats: ${prefilledCount} gevuld, ${skippedCount} overgeslagen`);

    // Sla ook op in flow storage met authenticated flag
    const flow = loadFlowData('dieptereiniging-aanvraag') || {};
    flow.voornaam = fieldMap.voornaam;
    flow.achternaam = fieldMap.achternaam;
    flow.telefoonnummer = fieldMap.telefoonnummer;
    flow.emailadres = fieldMap.emailadres;
    flow.authenticatedUserId = user.id;
    saveFlowData('dieptereiniging-aanvraag', flow);

    console.log('✅ [DrPersoonsgegevens] Flow data bijgewerkt met authenticated user info');
    
    // Update submit button state na prefill
    if (typeof formHandler.updateSubmitState === 'function') {
      formHandler.updateSubmitState(FORM_NAME);
      console.log('✅ [DrPersoonsgegevens] Submit state bijgewerkt na prefill');
    }

  } catch (error) {
    console.error('❌ [DrPersoonsgegevens] Fout bij prefill:', error);
  }
  
  console.log('👤 [DrPersoonsgegevens] === EINDE PREFILL ===');
}

/**
 * Handle auth:success event (na login via modal)
 * @param {CustomEvent} event - Event met user data
 */
async function handleAuthSuccess(event) {
  console.log('🎉 [DrPersoonsgegevens] auth:success event ontvangen');
  
  const user = event.detail?.user;
  if (!user) {
    console.warn('⚠️ [DrPersoonsgegevens] Geen user data in auth:success event');
    return;
  }

  console.log('👤 [DrPersoonsgegevens] User logged in:', {
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
  
  console.log('✅ [DrPersoonsgegevens] Auth success afgehandeld');
}

/**
 * Handle auth:state-changed event (na logout)
 * @param {CustomEvent} event - Event met nieuwe auth state
 */
function handleAuthStateChanged(event) {
  console.log('🔄 [DrPersoonsgegevens] auth:state-changed event ontvangen');
  
  const newState = event.detail;
  const role = newState?.role || 'guest';
  
  console.log('👤 [DrPersoonsgegevens] Nieuwe auth state:', role);
  
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
    const flow = loadFlowData('dieptereiniging-aanvraag') || {};
    delete flow.voornaam;
    delete flow.achternaam;
    delete flow.telefoonnummer;
    delete flow.emailadres;
    delete flow.authenticatedUserId;
    saveFlowData('dieptereiniging-aanvraag', flow);
    
    console.log('✅ [DrPersoonsgegevens] Guest mode: fields gecleared');
  }
}
