// public/forms/aanvraag/abbPersoonsgegevensForm.js

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { saveFlowData, loadFlowData } from '../logic/formStorage.js';
import { authClient } from '../../utils/auth/authClient.js';

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
  applyReadonlyFields();

  // Als klant: prefill met profiel data
  if (role === 'klant' && authState?.user) {
    console.log('🔄 [AbbPersoonsgegevens] Klant detected, starten prefill...');
    await prefillAuthenticatedUser(authState.user);
  } else {
    console.log('ℹ️ [AbbPersoonsgegevens] Guest mode, geen prefill nodig');
  }

  // Luister naar auth:success event (na login via modal)
  document.addEventListener('auth:success', handleAuthSuccess);
  console.log('👂 [AbbPersoonsgegevens] Luistert naar auth:success events');

  // ========== FORM HANDLER SETUP ==========
  schema.submit = {
    action: async (formData) => {
      const flow = loadFlowData('abonnement-aanvraag') || {};
      flow.voornaam = formData.voornaam;
      flow.achternaam = formData.achternaam;
      flow.telefoonnummer = formData.telefoonnummer;
      flow.emailadres = formData.emailadres;
      
      // Markeer of user authenticated is voor latere account creatie logica
      const currentAuthState = authClient.getAuthState();
      if (currentAuthState?.role === 'klant') {
        flow.authenticatedUserId = currentAuthState.user?.id;
      }
      
      // wachtwoord niet in plain opslaan in flow; voor nu alleen in submit-payload later te gebruiken
      saveFlowData('abonnement-aanvraag', flow);
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
    role: user?.role
  });
  
  try {
    // Haal volledige profiel op via authClient (bevat meer details)
    console.log('🔄 [AbbPersoonsgegevens] Fetching volledige profiel via authClient.getCurrentUser()...');
    const currentUser = await authClient.getCurrentUser();
    
    if (!currentUser) {
      console.warn('⚠️ [AbbPersoonsgegevens] getCurrentUser() returned null/undefined');
      return;
    }

    console.log('✅ [AbbPersoonsgegevens] Profiel opgehaald:', {
      id: currentUser.id,
      voornaam: currentUser.voornaam,
      achternaam: currentUser.achternaam,
      telefoonnummer: currentUser.telefoonnummer,
      email: currentUser.emailadres || currentUser.email
    });

    const formEl = document.querySelector(`[data-form-name="${FORM_NAME}"]`);
    if (!formEl) {
      console.warn('⚠️ [AbbPersoonsgegevens] Formulier element niet gevonden voor:', FORM_NAME);
      return;
    }

    console.log('✅ [AbbPersoonsgegevens] Formulier element gevonden');

    // Map user data naar form velden
    const fieldMap = {
      voornaam: currentUser.voornaam,
      achternaam: currentUser.achternaam,
      telefoonnummer: currentUser.telefoonnummer,
      emailadres: currentUser.emailadres || currentUser.email
    };

    console.log('📋 [AbbPersoonsgegevens] Field map voor prefill:', fieldMap);

    // Prefill velden
    let prefilledCount = 0;
    let skippedCount = 0;
    
    Object.entries(fieldMap).forEach(([fieldName, value]) => {
      if (value != null && value !== '') {
        const field = formEl.querySelector(`[data-field-name="${fieldName}"]`);
        if (field) {
          field.value = value;
          formHandler.formData[fieldName] = String(value);
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
    flow.authenticatedUserId = currentUser.id;
    saveFlowData('abonnement-aanvraag', flow);
    
    console.log('💾 [AbbPersoonsgegevens] Flow data opgeslagen met authenticatedUserId:', currentUser.id);

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
  applyReadonlyFields();
  
  // Als klant: prefill met profiel data
  if (role === 'klant' && user) {
    console.log('🔄 [AbbPersoonsgegevens] Klant ingelogd, starten prefill na login...');
    await prefillAuthenticatedUser(user);
  } else if (role === 'guest') {
    console.log('ℹ️ [AbbPersoonsgegevens] Guest state na event, geen prefill');
  } else {
    console.log(`ℹ️ [AbbPersoonsgegevens] Role ${role}, geen prefill actie`);
  }
  
  // Als admin/schoonmaker: toon melding dat ze niet kunnen bestellen
  if (role === 'admin' || role === 'schoonmaker') {
    console.warn(`⚠️ [AbbPersoonsgegevens] ${role.toUpperCase()} kan geen abonnement aanvragen`);
    console.warn('⚠️ [AbbPersoonsgegevens] Wrapper voor admin/schoonmaker moet blokkeer-melding tonen');
    // De wrapper voor admin/schoonmaker zou een blokmelding moeten tonen
  }
  
  console.log('✅ [AbbPersoonsgegevens] === AUTH SUCCESS HANDLING COMPLEET ===');
}
