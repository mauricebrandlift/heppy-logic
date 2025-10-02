// public/pages/abonnementAanvraagPage.js

import { initAbbAdresForm } from '../forms/aanvraag/abbAdresForm.js';
import '../utils/slides.js';
import '../forms/aanvraag/abbSuccesForm.js';
import './paymentReturnHandler.js';

document.addEventListener('DOMContentLoaded', () => {
  // Zoek het formulier op basis van de schema-selector met data-form-name
  const adresFormElement = document.querySelector('[data-form-name="abb_adres-form"]');

  if (adresFormElement) {
    console.log('📍 Abonnement adres formulier gevonden, initialiseren...');
    initAbbAdresForm();
  } else {
    console.log('🚫 Geen abonnement adres formulier gevonden op deze pagina.');
  }
  // Success slide initialisatie wordt automatisch gedaan in abbSuccesForm.js als aanwezig
});
