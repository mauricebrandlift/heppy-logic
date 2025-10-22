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
  const authState = authClient.getAuthState();
  const role = authState?.role || 'guest';
  console.log(`👤 [AbbPersoonsgegevens] Auth state detected: ${role}`);
  
  toggleAuthWrappers(role);
  applyReadonlyFields();

  // Als klant: prefill met profiel data
  if (role === 'klant' && authState?.user) {
    await prefillAuthenticatedUser(authState.user);
  }

  // Luister naar auth:success event (na login via modal)
  document.addEventListener('auth:success', handleAuthSuccess);

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
  const wrappers = document.querySelectorAll('[data-auth-state]');
  
  wrappers.forEach(wrapper => {
    const wrapperRole = wrapper.getAttribute('data-auth-state');
    if (wrapperRole === role) {
      wrapper.style.display = ''; // Toon
      console.log(`👁️ [AbbPersoonsgegevens] Wrapper "${wrapperRole}" getoond`);
    } else {
      wrapper.style.display = 'none'; // Verberg
    }
  });
}

/**
 * Pas readonly attribuut toe op velden met data-readonly="true"
 * Webflow workaround: kan niet direct readonly zetten, dus via JS
 */
function applyReadonlyFields() {
  const readonlyFields = document.querySelectorAll('[data-readonly="true"]');
  
  readonlyFields.forEach(field => {
    field.setAttribute('readonly', 'readonly');
    field.classList.add('is-readonly'); // Voor eventuele styling
    console.log(`🔒 [AbbPersoonsgegevens] Veld "${field.name}" set to readonly`);
  });
}

/**
 * Prefill formulier met authenticated user data
 * @param {Object} user - User object van authClient
 */
async function prefillAuthenticatedUser(user) {
  console.log('👤 [AbbPersoonsgegevens] Prefilling voor authenticated klant:', user);
  
  try {
    // Haal volledige profiel op via authClient (bevat meer details)
    const currentUser = await authClient.getCurrentUser();
    
    if (!currentUser) {
      console.warn('[AbbPersoonsgegevens] Kon geen user profiel ophalen');
      return;
    }

    const formEl = document.querySelector(`[data-form-name="${FORM_NAME}"]`);
    if (!formEl) {
      console.warn('[AbbPersoonsgegevens] Formulier element niet gevonden');
      return;
    }

    // Map user data naar form velden
    const fieldMap = {
      voornaam: currentUser.voornaam,
      achternaam: currentUser.achternaam,
      telefoonnummer: currentUser.telefoonnummer,
      emailadres: currentUser.emailadres || currentUser.email
    };

    // Prefill velden
    Object.entries(fieldMap).forEach(([fieldName, value]) => {
      if (value != null && value !== '') {
        const field = formEl.querySelector(`[data-field-name="${fieldName}"]`);
        if (field) {
          field.value = value;
          formHandler.formData[fieldName] = String(value);
          console.log(`✅ [AbbPersoonsgegevens] Prefilled ${fieldName}: ${value}`);
        }
      }
    });

    // Sla ook op in flow storage met authenticated flag
    const flow = loadFlowData('abonnement-aanvraag') || {};
    flow.voornaam = fieldMap.voornaam;
    flow.achternaam = fieldMap.achternaam;
    flow.telefoonnummer = fieldMap.telefoonnummer;
    flow.emailadres = fieldMap.emailadres;
    flow.authenticatedUserId = currentUser.id;
    saveFlowData('abonnement-aanvraag', flow);

    // Update submit state na prefill
    if (typeof formHandler.updateSubmitState === 'function') {
      formHandler.updateSubmitState(FORM_NAME);
    }
  } catch (error) {
    console.error('[AbbPersoonsgegevens] Error tijdens prefill:', error);
  }
}

/**
 * Handle auth:success event (na succesvolle login via modal)
 * @param {CustomEvent} event - Het auth:success event
 */
async function handleAuthSuccess(event) {
  console.log('🎉 [AbbPersoonsgegevens] Auth success event ontvangen:', event.detail);
  
  const { role, user } = event.detail;
  
  // Toggle wrappers naar nieuwe auth state
  toggleAuthWrappers(role);
  applyReadonlyFields();
  
  // Als klant: prefill met profiel data
  if (role === 'klant' && user) {
    await prefillAuthenticatedUser(user);
  }
  
  // Als admin/schoonmaker: toon melding dat ze niet kunnen bestellen
  if (role === 'admin' || role === 'schoonmaker') {
    console.warn(`⚠️ [AbbPersoonsgegevens] ${role} kan geen abonnement aanvragen`);
    // De wrapper voor admin/schoonmaker zou een blokmelding moeten tonen
  }
}
