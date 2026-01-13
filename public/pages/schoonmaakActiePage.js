// public/pages/schoonmaakActiePage.js
/**
 * Schoonmaak Actie pagina
 * Schoonmaker kan via deze pagina een aanvraag/opdracht accepteren of afwijzen
 * 
 * Deze pagina initialiseert alleen het form - alle logica zit in schoonmaakActieForm.js
 */

import { initSchoonmaakActieForm } from '../forms/schoonmaker/schoonmaakActieForm.js';

/**
 * Initialiseer pagina
 */
function init() {
  // Check of form element bestaat
  const formElement = document.querySelector('[data-form-name="schoonmaak-actie-form"]');
  if (!formElement) {
    console.warn('Schoonmaak actie form niet gevonden op deze pagina');
    return;
  }

  // Initialiseer formulier - alle logica zit daar
  initSchoonmaakActieForm();
}

// Auto-init bij DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
