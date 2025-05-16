/**
 * Orchestrator voor de adrescheck op de homepage.
 * @module public/pages/homePage
 * @version 1.0.0
 * @example
 * import { initAdressCheckForm } from '../forms/adress/adressCheckForm.js';
 * document.addEventListener('DOMContentLoaded', () => initAdressCheckForm());
 */

import { initAddressCheckForm } from '../forms/address/addressCheckForm.js';

// Initialisatie bij pagina-load
document.addEventListener('DOMContentLoaded', () => {
  initAddressCheckForm();
});

// Luister op voltooiing van de adrescheck (formuliernaam: postcode-form)
document.addEventListener('postcode-form:completed', (event) => {
  const { isCovered } = event.detail;

  // Navigeer afhankelijk van de dekking
  if (isCovered) {
    window.location.href = '/aanvragen/opties';
  } else {
    window.location.href = '/aanvragen/geen-dekking';
  }
});
