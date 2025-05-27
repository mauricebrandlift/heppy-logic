// public/pages/homePage.js

import { initAddressCheckForm } from '../forms/address/addressCheckForm.js';

document.addEventListener('DOMContentLoaded', () => {
  // Zoek het formulier op basis van de schema-selector met data-form-name
  const addressFormElement = document.querySelector('[data-form-name="postcode-form"]');

  if (addressFormElement) {
    console.log('📍 Address check form gevonden, initialiseren...');
    initAddressCheckForm();
  } else {
    console.log('🚫 Geen address check form gevonden op deze pagina.');
  }
});
