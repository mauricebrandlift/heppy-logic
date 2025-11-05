// public/pages/verhuisAanvraagPage.js

import { initVhAdresForm } from '../forms/verhuis/vhAdresForm.js';
import { initLoginModal } from '../utils/auth/loginModal.js';
import { initLogoutHandlers } from '../utils/auth/logoutHandler.js';
import './paymentReturnHandler.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialiseer login modal (beschikbaar op alle stappen van het aanvraag proces)
  initLoginModal();
  
  // Initialiseer logout handlers
  initLogoutHandlers();

  // ⚠️ BELANGRIJK: Initialiseer ALLEEN stap 1 (adres formulier)
  // Andere stappen worden lazy loaded via onSuccess handlers in de vorige stap
  // Dit voorkomt dat alle formulieren tegelijk initialiseren en data proberen te laden
  const adresFormElement = document.querySelector('[data-form-name="vh_adres-form"]');

  if (adresFormElement) {
    console.log('📍 Verhuis/opleverschoonmaak adres formulier gevonden, initialiseren...');
    initVhAdresForm();
  } else {
    console.log('🚫 Geen verhuis/opleverschoonmaak adres formulier gevonden op deze pagina.');
  }

  // Stap 2 (opdracht) wordt geïnitialiseerd door vhAdresForm.js onSuccess handler
  // Stap 3 (schoonmaker) wordt geïnitialiseerd door verhuisOpdrachtForm.js onSuccess handler
  // Stap 4 (overzicht) wordt geïnitialiseerd door verhuisSchoonmakerForm.js onSuccess handler
  // Stap 5 (persoonsgegevens) wordt geïnitialiseerd door verhuisOverzichtForm.js onSuccess handler
  // Stap 6 (betaling) wordt geïnitialiseerd door vhPersoonsgegevensForm.js onSuccess handler
  // etc.

  // ℹ️ RE-INITIALISATIE BIJ TERUG NAVIGEREN
  // Terug navigatie wordt nu afgehandeld door prev button handlers in elk formulier
  // Zie setupPrevButtonHandler() in alle form bestanden (verhuisOpdrachtForm, verhuisSchoonmakerForm, verhuisOverzicht, etc.)
  // Deze handlers re-initialiseren de vorige stap VOOR de slide change om stale handlers te voorkomen
});
