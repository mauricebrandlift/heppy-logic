// public/forms/aanvraag/abbPersoonsgegevensForm.js

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { saveFlowData, loadFlowData } from '../logic/formStorage.js';

const FORM_NAME = 'abb_persoonsgegevens-form';
const NEXT_FORM_NAME = 'abb_betaling-form';

function goToFormStep(nextFormName) {
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      return true;
    }
    console.warn('[AbbPersoonsgegevens] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    window.moveToNextSlide();
    return true;
  }

  console.error('[AbbPersoonsgegevens] Geen slider navigatie functie gevonden.');
  return false;
}

export function initAbbPersoonsgegevensForm() {
  console.log('👤 [AbbPersoonsgegevens] Initialiseren…');
  const schema = getFormSchema(FORM_NAME);
  if (!schema) {
    console.error('[AbbPersoonsgegevens] Schema niet gevonden');
    return;
  }

  schema.submit = {
    action: async (formData) => {
      const flow = loadFlowData('abonnement-aanvraag') || {};
      flow.voornaam = formData.voornaam;
      flow.achternaam = formData.achternaam;
      flow.telefoonnummer = formData.telefoonnummer;
      flow.emailadres = formData.emailadres;
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
