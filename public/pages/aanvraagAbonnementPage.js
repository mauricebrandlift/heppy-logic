// public/pages/aanvraagAbonnementPage.js

import { initAbbAdresForm } from '../forms/aanvraag/abbAdresForm.js';

document.addEventListener('DOMContentLoaded', () => {
  // Zoek het formulier op basis van de schema-selector met data-form-name
  const adresFormElement = document.querySelector('[data-form-name="abb_adres-form"]');

  if (adresFormElement) {
    console.log('📍 Abonnement adres formulier gevonden, initialiseren...');
    initAbbAdresForm();
  } else {
    console.log('🚫 Geen abonnement adres formulier gevonden op deze pagina.');
  }
});
