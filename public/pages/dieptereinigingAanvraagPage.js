// public/pages/dieptereinigingAanvraagPage.js

import { initDrAdresForm } from '../forms/dieptereiniging/drAdresForm.js';
import { initLoginModal } from '../utils/auth/loginModal.js';
import { initLogoutHandlers } from '../utils/auth/logoutHandler.js';
import './paymentReturnHandler.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialiseer login modal (beschikbaar op alle stappen van het aanvraag proces)
  initLoginModal();
  
  // Initialiseer logout handlers
  initLogoutHandlers();

  // Zoek het formulier op basis van de schema-selector met data-form-name
  const adresFormElement = document.querySelector('[data-form-name="dr_adres-form"]');

  if (adresFormElement) {
    console.log('📍 Dieptereiniging adres formulier gevonden, initialiseren...');
    initDrAdresForm();
  } else {
    console.log('🚫 Geen dieptereiniging adres formulier gevonden op deze pagina.');
  }

  // Check voor opdracht formulier (stap 2)
  const opdrachtFormElement = document.querySelector('[data-form-name="dr_opdracht-form"]');
  
  if (opdrachtFormElement) {
    console.log('📅 Dieptereiniging opdracht formulier gevonden, initialiseren...');
    import('../forms/dieptereiniging/drOpdrachtForm.js')
      .then((m) => {
        if (m && typeof m.initDrOpdrachtForm === 'function') {
          m.initDrOpdrachtForm();
        }
      })
      .catch((err) => {
        console.error('Kon opdracht formulier niet laden:', err);
      });
  }

  // Check voor schoonmaker formulier (stap 3)
  const schoonmakerFormElement = document.querySelector('[data-form-name="dr_schoonmaker-form"]');
  
  if (schoonmakerFormElement) {
    console.log('👷 Dieptereiniging schoonmaker formulier gevonden, initialiseren...');
    import('../forms/dieptereiniging/drSchoonmakerForm.js')
      .then((m) => {
        if (m && typeof m.initDrSchoonmakerForm === 'function') {
          m.initDrSchoonmakerForm();
        }
      })
      .catch((err) => {
        console.error('Kon schoonmaker formulier niet laden:', err);
      });
  }

  // Check voor persoonsgegevens formulier
  const persoonsgegevensFormElement = document.querySelector('[data-form-name="dr_persoonsgegevens-form"]');
  
  if (persoonsgegevensFormElement) {
    console.log('👤 Dieptereiniging persoonsgegevens formulier gevonden, initialiseren...');
    import('../forms/dieptereiniging/drPersoonsgegevensForm.js')
      .then((m) => {
        if (m && typeof m.initDrPersoonsgegevensForm === 'function') {
          m.initDrPersoonsgegevensForm();
        }
      })
      .catch((err) => {
        console.error('Kon persoonsgegevens formulier niet laden:', err);
      });
  }
});
