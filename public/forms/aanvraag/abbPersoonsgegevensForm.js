// public/forms/aanvraag/abbPersoonsgegevensForm.js

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { saveFlowData, loadFlowData } from '../logic/formStorage.js';
import { authClient } from '../../utils/auth/authClient.js';
import { logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';

const FORM_NAME = 'abb_persoonsgegevens-form';
const NEXT_FORM_NAME = 'abb_betaling-form';

function goToFormStep(nextFormName) {
  console.log('[AbbPersoonsgegevens] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[AbbPersoonsgegevens] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[AbbPersoonsgegevens] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[AbbPersoonsgegevens] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[AbbPersoonsgegevens] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[AbbPersoonsgegevens] Geen slider navigatie functie gevonden.');
  return false;
}

export async function initAbbPersoonsgegevensForm() {
  console.log('👤 [AbbPersoonsgegevens] Initialiseren…');
  
  // Note: Tracking happens on EXIT in handleSubmit, not on entry
  
  const schema = getFormSchema(FORM_NAME);
  if (!schema) {
    console.error('[AbbPersoonsgegevens] Schema niet gevonden');
    return;
  }

  // ========== AUTH STATE DETECTION ==========
  // Check auth state bij load en toggle de juiste wrapper
  console.log('🔍 [AbbPersoonsgegevens] Checking auth state...');
  const authState = authClient.getAuthState();
  const role = authState?.role || 'guest';
  console.log(`👤 [AbbPersoonsgegevens] Auth state detected: ${role}`);
  
  if (authState?.user) {
    console.log('👤 [AbbPersoonsgegevens] User info:', {
      id: authState.user.id,
      email: authState.user.email || authState.user.emailadres,
      role: authState.user.role
    });
  } else {
    console.log('👤 [AbbPersoonsgegevens] Geen authenticated user gevonden');
  }
  
  toggleAuthWrappers(role);

  // Als klant: prefill met profiel data VOOR readonly fields worden toegepast
  if (role === 'klant' && authState?.user) {
    console.log('🔄 [AbbPersoonsgegevens] Klant detected, starten prefill...');
    await prefillAuthenticatedUser(authState.user);
  } else {
    console.log('ℹ️ [AbbPersoonsgegevens] Guest mode, geen prefill nodig');
  }
  
  // Apply readonly fields NA prefill zodat values al zijn ingesteld
  applyReadonlyFields();

  // Luister naar auth:success event (na login via modal)
  document.addEventListener('auth:success', handleAuthSuccess);
  console.log('👂 [AbbPersoonsgegevens] Luistert naar auth:success events');
  
  // Luister naar auth:state-changed event (na logout)
  document.addEventListener('auth:state-changed', handleAuthStateChanged);
  console.log('👂 [AbbPersoonsgegevens] Luistert naar auth:state-changed events');

  // ========== FORM HANDLER SETUP ==========
  schema.submit = {
    action: async (formData) => {
      const flow = loadFlowData('abonnement-aanvraag') || {};
      
      // Check auth state
      const currentAuthState = authClient.getAuthState();
      const isGuest = !currentAuthState || currentAuthState.role === 'guest';
      
      // Als guest: check of email al bestaat
      if (isGuest && formData.emailadres) {
        console.log('🔍 [AbbPersoonsgegevens] Guest aanvraag, checking email beschikbaarheid...');
        console.log('📧 [AbbPersoonsgegevens] Email to check:', formData.emailadres);
        
        try {
          const checkUrl = `/api/auth/check-email?email=${encodeURIComponent(formData.emailadres)}`;
          console.log('🌐 [AbbPersoonsgegevens] Fetching:', checkUrl);
          
          const checkResponse = await fetch(checkUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          console.log('📥 [AbbPersoonsgegevens] Response status:', checkResponse.status, checkResponse.ok);
          
          const checkData = await checkResponse.json();
          console.log('📦 [AbbPersoonsgegevens] Response data:', checkData);
          
          if (!checkResponse.ok) {
            console.error('❌ [AbbPersoonsgegevens] API error:', checkResponse.status, checkData);
            // Bij API error: laat door (fail open voor betere UX)
            console.warn('⚠️ [AbbPersoonsgegevens] Continuing despite API error');
            return; // Exit early, laat submit doorgaan
          }
          
          if (checkData.exists === true) {
            console.warn('⚠️ [AbbPersoonsgegevens] Email bestaat al:', formData.emailadres);
            
            // Toon error in het globale error element
            const formEl = document.querySelector(`[data-form-name="${FORM_NAME}"]`);
            const errorEl = formEl?.querySelector('[data-error-for="global"]');
            if (errorEl) {
              errorEl.textContent = 'Dit e-mailadres is al in gebruik. Log in of gebruik een ander e-mailadres.';
              errorEl.classList.remove('hide');
              errorEl.style.display = 'block';
              console.log('🚨 [AbbPersoonsgegevens] Error message displayed');
            } else {
              console.error('❌ [AbbPersoonsgegevens] Error element not found!');
            }
            
            // Gooi error om submit te stoppen
            throw new Error('Email bestaat al');
          }
          
          console.log('✅ [AbbPersoonsgegevens] Email is beschikbaar, continuing...');
        } catch (error) {
          console.error('🔥 [AbbPersoonsgegevens] Catch block:', error.message);
          
          if (error.message === 'Email bestaat al') {
            console.log('🛑 [AbbPersoonsgegevens] Blocking submit - email exists');
            throw error; // Re-throw om submit te stoppen
          }
          
          // Netwerk error: log maar block niet
          console.error('❌ [AbbPersoonsgegevens] Email check failed (network):', error);
          console.warn('⚠️ [AbbPersoonsgegevens] Continuing despite email check failure (network issue)');
        }
      } else {
        console.log('ℹ️ [AbbPersoonsgegevens] Skipping email check (not guest or no email):', { isGuest, email: formData.emailadres });
      }
      
      flow.voornaam = formData.voornaam;
      flow.achternaam = formData.achternaam;
      flow.telefoonnummer = formData.telefoonnummer;
      flow.emailadres = formData.emailadres;
      
      // Wachtwoord opslaan voor guest users (nodig voor auth user creatie na betaling)
      // Voor authenticated users slaan we geen wachtwoord op
      if (isGuest && formData.wachtwoord) {
        flow.wachtwoord = formData.wachtwoord; // TODO: In toekomst vervangen door magic link
      }
      
      // Markeer of user authenticated is voor latere account creatie logica
      if (currentAuthState?.role === 'klant') {
        flow.authenticatedUserId = currentAuthState.user?.id;
      }
      
      saveFlowData('abonnement-aanvraag', flow);
      
      // 🎯 TRACK STEP COMPLETION
      await logStepCompleted('abonnement', 'persoonsgegevens', 4, {
        voornaam: formData.voornaam,
        achternaam: formData.achternaam,
        emailadres: formData.emailadres,
        telefoonnummer: formData.telefoonnummer,
        isAuthenticated: currentAuthState?.role === 'klant',
        userId: currentAuthState?.user?.id || null
      }).catch(err => console.warn('[AbbPersoonsgegevens] Tracking failed:', err));
    },
    onSuccess: () => {
      console.log('✅ [AbbPersoonsgegevens] Opgeslagen, init betaalstap en ga door…');
      import('./abbBetalingForm.js')
        .then((m) => {
          if (m && typeof m.initAbbBetalingForm === 'function') {
            m.initAbbBetalingForm();
          }
          goToFormStep(NEXT_FORM_NAME);
        })
        .catch((err) => {
          console.error('[AbbPersoonsgegevens] Kon betaalstap niet laden:', err);
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
      console.log(`⏭️ [AbbPersoonsgegevens] Skip validatie voor ${fieldName} (wrapper hidden)`);
    }
    return isVisible;
  };

  formHandler.init(schema);

  // Prefill vanuit flow als aanwezig
  const flow = loadFlowData('abonnement-aanvraag') || {};
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
      formHandler.updateSubmitState('abb_persoonsgegevens-form');
    }
  }
  
  // 🔙 PREV BUTTON HANDLER - Re-initialiseer vorige stap bij terug navigeren
  setupPrevButtonHandler();
}

/**
 * Setup prev button handler voor terug navigatie
 * Re-initialiseert stap 4 (overzicht) voordat er terug wordt genavigeerd
 */
function setupPrevButtonHandler() {
  const prevButton = document.querySelector('[data-form-button-prev="abb_persoonsgegevens-form"]');
  
  if (!prevButton) {
    console.log('[AbbPersoonsgegevens] Geen prev button gevonden met [data-form-button-prev="abb_persoonsgegevens-form"]');
    return;
  }
  
  console.log('[AbbPersoonsgegevens] Prev button gevonden, event handler toevoegen...');
  
  prevButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[AbbPersoonsgegevens] 🔙 Prev button clicked - navigeer naar stap 4 (overzicht)');
    
    // Re-initialiseer de VORIGE stap (stap 4 = abbOverzicht) VOOR navigatie
    import('./abbOverzicht.js').then(module => {
      console.log('[AbbPersoonsgegevens] ♻️ Re-init abbOverzicht voor terug navigatie...');
      module.initAbbOverzicht();
      
      // NA re-init, ga naar vorige slide
      if (typeof window.moveToPrevSlide === 'function') {
        console.log('[AbbPersoonsgegevens] Roep window.moveToPrevSlide() aan');
        window.moveToPrevSlide();
      } else {
        console.warn('[AbbPersoonsgegevens] window.moveToPrevSlide() niet beschikbaar');
      }
    }).catch(err => {
      console.error('[AbbPersoonsgegevens] ❌ Fout bij re-init abbOverzicht:', err);
      if (typeof window.moveToPrevSlide === 'function') {
        window.moveToPrevSlide();
      }
    });
  });
  
  console.log('[AbbPersoonsgegevens] ✅ Prev button handler toegevoegd');
}

// ========== AUTH HELPER FUNCTIONS ==========

/**
 * Toggle visibility van auth state wrappers op basis van rol
 * @param {string} role - De huidige rol (guest, klant, admin, schoonmaker)
 */
function toggleAuthWrappers(role) {
  console.log(`🔄 [AbbPersoonsgegevens] Toggling wrappers voor role: ${role}`);
  
  const wrappers = document.querySelectorAll('[data-auth-state]');
  console.log(`📦 [AbbPersoonsgegevens] Gevonden ${wrappers.length} wrapper(s) met [data-auth-state]`);
  
  let visibleCount = 0;
  let hiddenCount = 0;
  
  wrappers.forEach(wrapper => {
    const wrapperRole = wrapper.getAttribute('data-auth-state');
    if (wrapperRole === role) {
      wrapper.style.display = ''; // Toon
      visibleCount++;
      console.log(`👁️ [AbbPersoonsgegevens] ✅ Wrapper "${wrapperRole}" GETOOND`);
    } else {
      wrapper.style.display = 'none'; // Verberg
      hiddenCount++;
      console.log(`👁️ [AbbPersoonsgegevens] ❌ Wrapper "${wrapperRole}" verborgen`);
    }
  });
  
  console.log(`📊 [AbbPersoonsgegevens] Wrapper toggle compleet: ${visibleCount} zichtbaar, ${hiddenCount} verborgen`);
}

/**
 * Pas readonly attribuut toe op velden met data-readonly="true"
 * Webflow workaround: kan niet direct readonly zetten, dus via JS
 */
function applyReadonlyFields() {
  console.log('🔒 [AbbPersoonsgegevens] Applying readonly fields...');
  
  const readonlyFields = document.querySelectorAll('[data-readonly="true"]');
  console.log(`📋 [AbbPersoonsgegevens] Gevonden ${readonlyFields.length} readonly veld(en)`);
  
  readonlyFields.forEach(field => {
    field.setAttribute('readonly', 'readonly');
    field.classList.add('is-readonly'); // Voor eventuele styling
    const fieldName = field.getAttribute('data-field-name') || field.name || 'unknown';
    console.log(`🔒 [AbbPersoonsgegevens] ✅ Veld "${fieldName}" set to readonly`);
  });
  
  if (readonlyFields.length > 0) {
    console.log('✅ [AbbPersoonsgegevens] Readonly fields toegepast');
  }
}

/**
 * Prefill formulier met authenticated user data
 * @param {Object} user - User object van authClient
 */
async function prefillAuthenticatedUser(user) {
  console.log('👤 [AbbPersoonsgegevens] === START PREFILL ===');
  console.log('👤 [AbbPersoonsgegevens] User object ontvangen:', {
    id: user?.id,
    email: user?.email || user?.emailadres,
    role: user?.role,
    voornaam: user?.voornaam,
    achternaam: user?.achternaam,
    telefoonnummer: user?.telefoonnummer
  });
  
  try {
    // Gebruik data direct van user object (komt van login response)
    // De login API stuurt nu voornaam, achternaam, telefoonnummer mee
    if (!user) {
      console.warn('⚠️ [AbbPersoonsgegevens] Geen user data beschikbaar');
      return;
    }

    const formEl = document.querySelector(`[data-form-name="${FORM_NAME}"]`);
    if (!formEl) {
      console.warn('⚠️ [AbbPersoonsgegevens] Formulier element niet gevonden voor:', FORM_NAME);
      return;
    }

    console.log('✅ [AbbPersoonsgegevens] Formulier element gevonden');
    
    // Zoek de zichtbare klant wrapper
    const klantWrapper = formEl.querySelector('[data-auth-state="klant"]');
    if (!klantWrapper) {
      console.warn('⚠️ [AbbPersoonsgegevens] Klant wrapper niet gevonden');
      return;
    }
    
    console.log('✅ [AbbPersoonsgegevens] Klant wrapper gevonden');

    // Map user data naar form velden
    const fieldMap = {
      voornaam: user.voornaam || '',
      achternaam: user.achternaam || '',
      telefoonnummer: user.telefoonnummer || '',
      emailadres: user.emailadres || user.email || ''
    };

    console.log('📋 [AbbPersoonsgegevens] Field map voor prefill:', fieldMap);

    // Prefill velden - ZOEK IN DE KLANT WRAPPER
    let prefilledCount = 0;
    let skippedCount = 0;
    
    Object.entries(fieldMap).forEach(([fieldName, value]) => {
      if (value != null && value !== '') {
        // Zoek veld BINNEN de klant wrapper
        const field = klantWrapper.querySelector(`[data-field-name="${fieldName}"]`);
        if (field) {
          console.log(`🔍 [AbbPersoonsgegevens] Veld "${fieldName}" gevonden. Current value: "${field.value}", Setting to: "${value}"`);
          field.value = value;
          formHandler.formData[fieldName] = String(value);
          console.log(`🔍 [AbbPersoonsgegevens] Na update - DOM value: "${field.value}", formData: "${formHandler.formData[fieldName]}"`);
          
          // Check in welke wrapper het veld zit
          const wrapper = field.closest('[data-auth-state]');
          if (wrapper) {
            const wrapperState = wrapper.getAttribute('data-auth-state');
            const wrapperDisplay = window.getComputedStyle(wrapper).display;
            console.log(`🔍 [AbbPersoonsgegevens] Veld "${fieldName}" zit in wrapper "${wrapperState}", display: ${wrapperDisplay}`);
          }
          
          prefilledCount++;
          console.log(`✅ [AbbPersoonsgegevens] Prefilled ${fieldName}: "${value}"`);
        } else {
          console.warn(`⚠️ [AbbPersoonsgegevens] Field niet gevonden: ${fieldName}`);
        }
      } else {
        skippedCount++;
        console.log(`ℹ️ [AbbPersoonsgegevens] Skipped ${fieldName} (geen waarde)`);
      }
    });

    console.log(`📊 [AbbPersoonsgegevens] Prefill stats: ${prefilledCount} gevuld, ${skippedCount} overgeslagen`);

    // Sla ook op in flow storage met authenticated flag
    const flow = loadFlowData('abonnement-aanvraag') || {};
    flow.voornaam = fieldMap.voornaam;
    flow.achternaam = fieldMap.achternaam;
    flow.telefoonnummer = fieldMap.telefoonnummer;
    flow.emailadres = fieldMap.emailadres;
    flow.authenticatedUserId = user.id;
    saveFlowData('abonnement-aanvraag', flow);
    
    console.log('💾 [AbbPersoonsgegevens] Flow data opgeslagen met authenticatedUserId:', user.id);

    // Update submit state na prefill
    if (typeof formHandler.updateSubmitState === 'function') {
      formHandler.updateSubmitState(FORM_NAME);
      console.log('✅ [AbbPersoonsgegevens] Submit state geüpdatet');
    }
    
    console.log('🎉 [AbbPersoonsgegevens] === PREFILL COMPLEET ===');
  } catch (error) {
    console.error('❌ [AbbPersoonsgegevens] Error tijdens prefill:', error);
    console.error('🔍 [AbbPersoonsgegevens] Error details:', {
      message: error.message,
      stack: error.stack
    });
  }
}

/**
 * Handle auth:success event (na succesvolle login via modal)
 * @param {CustomEvent} event - Het auth:success event
 */
async function handleAuthSuccess(event) {
  console.log('🎉 [AbbPersoonsgegevens] === AUTH SUCCESS EVENT ONTVANGEN ===');
  console.log('📢 [AbbPersoonsgegevens] Event detail:', event.detail);
  
  const { role, user } = event.detail;
  
  console.log(`🔄 [AbbPersoonsgegevens] Nieuwe auth state: ${role}`);
  console.log('👤 [AbbPersoonsgegevens] User info:', {
    id: user?.id,
    email: user?.email || user?.emailadres,
    role: user?.role
  });
  
  // Toggle wrappers naar nieuwe auth state
  toggleAuthWrappers(role);
  
  // Als klant: prefill met profiel data VOOR readonly
  if (role === 'klant' && user) {
    console.log('🔄 [AbbPersoonsgegevens] Klant ingelogd, starten prefill na login...');
    await prefillAuthenticatedUser(user);
  } else if (role === 'guest') {
    console.log('ℹ️ [AbbPersoonsgegevens] Guest state na event, geen prefill');
  } else {
    console.log(`ℹ️ [AbbPersoonsgegevens] Role ${role}, geen prefill actie`);
  }
  
  // Apply readonly NA prefill
  applyReadonlyFields();
  
  // Als admin/schoonmaker: toon melding dat ze niet kunnen bestellen
  if (role === 'admin' || role === 'schoonmaker') {
    console.warn(`⚠️ [AbbPersoonsgegevens] ${role.toUpperCase()} kan geen abonnement aanvragen`);
    console.warn('⚠️ [AbbPersoonsgegevens] Wrapper voor admin/schoonmaker moet blokkeer-melding tonen');
    // De wrapper voor admin/schoonmaker zou een blokmelding moeten tonen
  }
  
  console.log('✅ [AbbPersoonsgegevens] === AUTH SUCCESS HANDLING COMPLEET ===');
}

/**
 * Handle auth:state-changed event (na logout)
 * @param {CustomEvent} event - Het auth:state-changed event
 */
function handleAuthStateChanged(event) {
  console.log('🔄 [AbbPersoonsgegevens] === AUTH STATE CHANGED EVENT ===');
  console.log('📢 [AbbPersoonsgegevens] Event detail:', event.detail);
  
  const { role } = event.detail;
  
  console.log(`🔄 [AbbPersoonsgegevens] State changed naar: ${role}`);
  
  // Toggle wrappers naar nieuwe state
  toggleAuthWrappers(role);
  
  // Clear form velden bij logout naar guest
  if (role === 'guest') {
    console.log('🧹 [AbbPersoonsgegevens] Clearing form fields voor guest state...');
    const formEl = document.querySelector(`[data-form-name="${FORM_NAME}"]`);
    if (formEl) {
      ['voornaam', 'achternaam', 'telefoonnummer', 'emailadres'].forEach(fieldName => {
        const field = formEl.querySelector(`[data-field-name="${fieldName}"]`);
        if (field) {
          field.value = '';
          field.removeAttribute('readonly');
          field.classList.remove('is-readonly');
        }
      });
      
      // Clear formHandler data
      formHandler.formData = {};
      
      // Update submit state
      if (typeof formHandler.updateSubmitState === 'function') {
        formHandler.updateSubmitState(FORM_NAME);
      }
    }
  }
  
  console.log('✅ [AbbPersoonsgegevens] === STATE CHANGE COMPLEET ===');
}
