// public/pages/abonnementAanvraagPage.js
/**
 * Abonnement Aanvraag Page Controller
 * 
 * Deze module beheert de multi-stap formulierstroom voor abonnementsaanvragen:
 * 1. Adres invoer en controle (abbAdresForm)
 * 2. Schoonmaak opdracht details (abbOpdrachtForm)
 * 3. Volgende stappen (nog toe te voegen)
 * 
 * De stroom werkt als volgt:
 * - Bij pageload wordt alleen het eerste formulier geïnitialiseerd
 * - Elk formulier initialiseert het volgende formulier vanuit zijn onSuccess handler
 * - Data wordt doorgegeven via formStorage mechanisme
 */

import { initAbbAdresForm } from '../forms/aanvraag/abbAdresForm.js';
// Andere formulieren worden dynamisch geladen via de success handlers

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 [AbonnementAanvraagPage] Pagina wordt geïnitialiseerd...');
  
  // Zoek alle formulieren op deze pagina en geef debug info
  const allForms = document.querySelectorAll('[data-form-name]');
  console.log(`🔍 [AbonnementAanvraagPage] ${allForms.length} formulier(en) gevonden op deze pagina.`);
  allForms.forEach(form => {
    console.log(`- Formulier gevonden: ${form.getAttribute('data-form-name')}`);
  });
  
  // Zoek het eerste formulier op basis van de schema-selector 
  const adresFormElement = document.querySelector('[data-form-name="abb_adres-form"]');

  if (adresFormElement) {
    console.log('📍 [AbonnementAanvraagPage] Adres formulier gevonden, initialiseren...');
    // Initialiseer alleen het eerste formulier direct
    // De volgende formulieren worden via de success handlers geladen
    initAbbAdresForm();
  } else {
    console.warn('🚫 [AbonnementAanvraagPage] Geen adres formulier gevonden. Controleer HTML markup.');
  }
  
  // Controleer voor debug doeleinden of de andere formulieren aanwezig zijn in de DOM
  const opdrachtFormElement = document.querySelector('[data-form-name="abb_opdracht-form"]');
  if (opdrachtFormElement) {
    console.log('📍 [AbonnementAanvraagPage] Opdracht formulier aanwezig in DOM (wordt later geïnitialiseerd).');
  } else {
    console.warn('⚠️ [AbonnementAanvraagPage] Opdracht formulier niet gevonden in DOM. Controleer HTML markup.');
  }
});
