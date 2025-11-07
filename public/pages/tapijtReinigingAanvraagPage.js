// public/pages/tapijtReinigingAanvraagPage.js

import { initRtAdresForm } from '../forms/tapijt/rtAdresForm.js';
import { initLoginModal } from '../utils/auth/loginModal.js';
import { initLogoutHandlers } from '../utils/auth/logoutHandler.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialiseer login modal (beschikbaar op alle stappen van het aanvraag proces)
  initLoginModal();
  
  // Initialiseer logout handlers
  initLogoutHandlers();

  // ⚠️ BELANGRIJK: Initialiseer ALLEEN stap 1 (adres formulier)
  // Andere stappen worden lazy loaded via onSuccess handlers in de vorige stap
  // Dit voorkomt dat alle formulieren tegelijk initialiseren en data proberen te laden
  const adresFormElement = document.querySelector('[data-form-name="rt_adres-form"]');

  if (adresFormElement) {
    console.log('📍 Tapijt reiniging adres formulier gevonden, initialiseren...');
    initRtAdresForm();
  } else {
    console.log('🚫 Geen tapijt reiniging adres formulier gevonden op deze pagina.');
  }

  // Stap 2 (opdracht/tapijt details) wordt geïnitialiseerd door rtAdresForm.js onSuccess handler
  // Stap 3 (dagdelen) wordt geïnitialiseerd door tapijtOpdrachtForm.js onSuccess handler
  // Stap 4 (overzicht) wordt geïnitialiseerd door rtDagdelenForm.js onSuccess handler
  // Stap 5 (persoonsgegevens + offerte aanvraag) wordt geïnitialiseerd door tapijtOverzichtForm.js onSuccess handler

  // ℹ️ RE-INITIALISATIE BIJ TERUG NAVIGEREN
  // Terug navigatie wordt afgehandeld door prev button handlers in elk formulier
  // Zie setupPrevButtonHandler() in alle form bestanden
  // Deze handlers re-initialiseren de vorige stap VOOR de slide change om stale handlers te voorkomen
});
