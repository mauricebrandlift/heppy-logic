// public/pages/geenDekkingPage.js
// Initialiseert de geen-dekking wachtlijst pagina.

import { initGeenDekkingForm } from '../forms/wachtlijst/geenDekkingForm.js';

document.addEventListener('DOMContentLoaded', () => {
  const formElement = document.querySelector('[data-form-name="geen-dekking_form"]');
  if (formElement) {
    console.log('📍 Geen-dekking formulier gevonden, initialiseren...');
    initGeenDekkingForm();
  } else {
    console.log('🚫 Geen geen-dekking formulier gevonden op deze pagina.');
  }
});
