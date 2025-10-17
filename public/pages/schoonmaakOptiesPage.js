// public/pages/schoonmaakOptiesPage.js
// Initialiseert de schoonmaak opties pagina waar de frequentie gekozen wordt.

import { initSchoonmaakFrequentieForm } from '../forms/schoonmaak/schoonmaakFrequentieForm.js';

document.addEventListener('DOMContentLoaded', () => {
  const formElement = document.querySelector('[data-form-name="schoonmaak-frequentie-form"]');
  if (formElement) {
    console.log('📍 Schoonmaak frequentie formulier gevonden, initialiseren...');
    initSchoonmaakFrequentieForm();
  } else {
    console.log('🚫 Geen schoonmaak frequentie formulier gevonden op deze pagina.');
  }
});
