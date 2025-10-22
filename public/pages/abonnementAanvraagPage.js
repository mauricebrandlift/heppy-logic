// public/pages/abonnementAanvraagPage.js

import { initAbbAdresForm } from '../forms/aanvraag/abbAdresForm.js';
import { initLoginModal } from '../utils/auth/loginModal.js';
import { initLogoutHandlers } from '../utils/auth/logoutHandler.js';
import './paymentReturnHandler.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialiseer login modal (beschikbaar op alle stappen van het aanvraag proces)
  initLoginModal();
  
  // Initialiseer logout handlers
  initLogoutHandlers();

  // Zoek het formulier op basis van de schema-selector met data-form-name
  const adresFormElement = document.querySelector('[data-form-name="abb_adres-form"]');

  if (adresFormElement) {
    console.log('📍 Abonnement adres formulier gevonden, initialiseren...');
    initAbbAdresForm();
  } else {
    console.log('🚫 Geen abonnement adres formulier gevonden op deze pagina.');
  }

  // Check voor persoonsgegevens formulier
  const persoonsgegevensFormElement = document.querySelector('[data-form-name="abb_persoonsgegevens-form"]');
  
  if (persoonsgegevensFormElement) {
    console.log('👤 Abonnement persoonsgegevens formulier gevonden, initialiseren...');
    import('../forms/aanvraag/abbPersoonsgegevensForm.js')
      .then((m) => {
        if (m && typeof m.initAbbPersoonsgegevensForm === 'function') {
          m.initAbbPersoonsgegevensForm();
        }
      })
      .catch((err) => {
        console.error('Kon persoonsgegevens formulier niet laden:', err);
      });
  }
});
