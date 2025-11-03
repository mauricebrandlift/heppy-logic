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

  // ⚠️ BELANGRIJK: Initialiseer ALLEEN stap 1 (adres formulier)
  // Andere stappen worden lazy loaded via onSuccess handlers in de vorige stap
  // Dit voorkomt dat alle formulieren tegelijk initialiseren en data proberen te laden
  const adresFormElement = document.querySelector('[data-form-name="dr_adres-form"]');

  if (adresFormElement) {
    console.log('📍 Dieptereiniging adres formulier gevonden, initialiseren...');
    initDrAdresForm();
  } else {
    console.log('🚫 Geen dieptereiniging adres formulier gevonden op deze pagina.');
  }

  // Stap 2 (opdracht) wordt geïnitialiseerd door drAdresForm.js onSuccess handler
  // Stap 3 (schoonmaker) wordt geïnitialiseerd door drOpdrachtForm.js onSuccess handler
  // Stap 4 (persoonsgegevens) wordt geïnitialiseerd door drSchoonmakerForm.js onSuccess handler
  // etc.

  // 🔄 Splide event listener voor re-initialisatie bij terug navigeren
  // Wanneer gebruiker terug navigeert moet het formulier opnieuw worden geïnitialiseerd
  console.log('🎯 [DR Page] Zoeken naar Splide instance voor re-init listeners...');
  
  // Wacht tot Splide is geïnitialiseerd (kan asynchroon gebeuren)
  const checkSplide = () => {
    const splideElement = document.querySelector('.splide');
    if (splideElement && splideElement.splide) {
      const splide = splideElement.splide;
      console.log('✅ [DR Page] Splide instance gevonden, event listeners toevoegen');
      
      // Track welke forms al zijn geïnitialiseerd om dubbele inits te voorkomen
      const initializedForms = new Set();
      initializedForms.add('dr_adres-form'); // Stap 1 is al geïnitialiseerd
      
      splide.on('moved', (newIndex, prevIndex, destIndex) => {
        console.log(`🔄 [DR Page] Splide moved: ${prevIndex} → ${newIndex}`);
        
        // Haal het form element op van de actieve slide
        const activeSlide = splide.Components.Slides.getAt(newIndex);
        if (!activeSlide) return;
        
        const slideElement = activeSlide.slide;
        const formElement = slideElement.querySelector('[data-form-name]');
        
        if (!formElement) {
          console.log(`ℹ️ [DR Page] Geen form gevonden in slide ${newIndex}`);
          return;
        }
        
        const formName = formElement.getAttribute('data-form-name');
        console.log(`📋 [DR Page] Actieve form: ${formName}`);
        
        // Re-initialiseer formulier als het terug wordt bezocht (voorkomt stale event handlers)
        // Voorwaarde: form is NIET nieuw (zit al in initializedForms Set)
        // Dit betekent: gebruiker navigeerde vooruit, toen terug, en nu weer vooruit
        if (initializedForms.has(formName)) {
          console.log(`🔄 [DR Page] Re-initialiseer ${formName} (terug navigatie gedetecteerd)`);
          
          // Dynamisch importeren en re-initialiseren op basis van form name
          switch(formName) {
            case 'dr_adres-form':
              initDrAdresForm();
              break;
            case 'dr_opdracht-form':
              import('../forms/dieptereiniging/drOpdrachtForm.js').then(module => {
                module.initDrOpdrachtForm();
              });
              break;
            case 'dr_schoonmaker-form':
              import('../forms/dieptereiniging/drSchoonmakerForm.js').then(module => {
                module.initDrSchoonmakerForm();
              });
              break;
            default:
              console.log(`ℹ️ [DR Page] Geen re-init handler voor ${formName}`);
          }
        } else {
          // Eerste keer dat dit formulier wordt bezocht
          console.log(`✨ [DR Page] Eerste bezoek aan ${formName}, markeren als geïnitialiseerd`);
          initializedForms.add(formName);
        }
      });
    } else {
      // Splide nog niet klaar, probeer opnieuw
      setTimeout(checkSplide, 100);
    }
  };
  
  checkSplide();
});
