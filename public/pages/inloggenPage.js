// public/pages/inloggenPage.js
/**
 * Initialisatie script voor de inlogpagina
 * Detecteert het login formulier en initialiseert de loginForm module
 */

import { initLoginForm } from '../forms/auth/loginForm.js';

document.addEventListener('DOMContentLoaded', () => {
  // Zoek het login formulier op basis van data-form-name attribuut
  const loginFormElement = document.querySelector('[data-form-name="inloggen-form"]');
  
  if (loginFormElement) {
    console.log('🔐 [InloggenPage] Login formulier gevonden, initialiseren...');
    initLoginForm();
  } else {
    console.log('🚫 [InloggenPage] Geen login formulier gevonden op deze pagina.');
  }
});
