// public/pages/vloerReinigingAanvraagPage.js

import { initRvAdresForm } from '../forms/vloer/rvAdresForm.js';
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
  const adresFormElement = document.querySelector('[data-form-name="rv_adres-form"]');

  if (adresFormElement) {
    console.log('📍 Vloer reiniging adres formulier gevonden, initialiseren...');
    initRvAdresForm();
  } else {
    console.log('🚫 Geen vloer reiniging adres formulier gevonden op deze pagina.');
  }

  // Stap 2 (opdracht/vloer details) wordt geïnitialiseerd door rvAdresForm.js onSuccess handler
  // Stap 3 (dagdelen) wordt geïnitialiseerd door rvOpdrachtForm.js onSuccess handler
  // Stap 4 (overzicht) wordt geïnitialiseerd door rvDagdelenForm.js onSuccess handler
  // Stap 5 (persoonsgegevens + offerte aanvraag) wordt geïnitialiseerd door rvOverzichtForm.js onSuccess handler

  // ℹ️ RE-INITIALISATIE BIJ TERUG NAVIGEREN
  // Terug navigatie wordt afgehandeld door prev button handlers in elk formulier
  // Zie setupPrevButtonHandler() in alle form bestanden
  // Deze handlers re-initialiseren de vorige stap VOOR de slide change om stale handlers te voorkomen
});
