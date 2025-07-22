// public/pages/sollicitatiePage.js
/**
 * Initialisatie script voor de sollicitatie pagina (/schoonmaak-vacatures)
 * Detecteert het sollicitatie formulier en initialiseert de sollicitatieForm module
 */

import { initSollicitatieForm } from '../forms/sollicitatie/sollAlgemeenForm.js';

document.addEventListener('DOMContentLoaded', () => {
  // Zoek het sollicitatie formulier op basis van data-form-name attribuut
  const sollicitatieFormElement = document.querySelector('[data-form-name="soll_algemeen"]');
  
  if (sollicitatieFormElement) {
    console.log('💼 [SollicitatiePage] Sollicitatie formulier gevonden, initialiseren...');
    initSollicitatieForm();
  } else {
    console.log('🚫 [SollicitatiePage] Geen sollicitatie formulier gevonden op deze pagina.');
  }
});
