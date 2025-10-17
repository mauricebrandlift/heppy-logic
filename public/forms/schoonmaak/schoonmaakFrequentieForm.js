// public/forms/schoonmaak/schoonmaakFrequentieForm.js
// Logica voor het standalone schoonmaak frequentie formulier.

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { saveGlobalFieldData } from '../logic/formStorage.js';

const FORM_NAME = 'schoonmaak-frequentie-form';

const REDIRECT_URLS = {
  eenmalig: 'https://heppy-schoonmaak.webflow.io/aanvragen/eenmalige-schoonmaak-aanvragen',
  perweek: 'https://heppy-schoonmaak.webflow.io/aanvragen/schoonmaak-abonnement-aanvragen',
  pertweeweek: 'https://heppy-schoonmaak.webflow.io/aanvragen/schoonmaak-abonnement-aanvragen',
};

export function initSchoonmaakFrequentieForm() {
  console.log(`[SchoonmaakFrequentieForm] Initialiseren van formulier: ${FORM_NAME}`);

  const schema = getFormSchema(FORM_NAME);
  if (!schema) {
    console.error(
      `[SchoonmaakFrequentieForm] Schema '${FORM_NAME}' niet gevonden in formSchemas.js.`
    );
    return;
  }

  schema.submit = {
    action: async (formData) => {
      const frequentie = formData.frequentie;
      const redirectUrl = REDIRECT_URLS[frequentie];

      if (!redirectUrl) {
        const error = new Error('Ongeldige schoonmaakoptie geselecteerd.');
        error.code = 'INVALID_SELECTION';
        throw error;
      }

      saveGlobalFieldData('frequentie', frequentie);

      window.location.href = redirectUrl;
    },
  };

  formHandler.init(schema);

  const formElement = document.querySelector(schema.selector);
  if (!formElement) {
    console.warn(
      `[SchoonmaakFrequentieForm] Form element ${schema.selector} niet gevonden na initialisatie.`
    );
    return;
  }

  console.log(
    `[SchoonmaakFrequentieForm] Formulier '${FORM_NAME}' is succesvol geïnitialiseerd.`
  );
}
