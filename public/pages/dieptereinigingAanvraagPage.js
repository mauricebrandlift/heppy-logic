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

  // 🔄 SLIDE CHANGE DETECTION - Re-initialiseer formulieren bij terug navigeren
  // Dit voorkomt stale event handlers en zorgt dat elk formulier werkt na heen-en-weer navigatie
  console.log('🎯 [DR Page] Instellen slide change detection voor form re-init...');
  
  // Track welke forms al een keer zijn geïnitialiseerd
  const visitedForms = new Set(['dr_adres-form']); // Stap 1 is al geïnitialiseerd
  let previouslyActiveForm = 'dr_adres-form';
  
  // Poller die elke 300ms checkt welk formulier actief/zichtbaar is
  // Dit werkt ongeacht hoe Webflow/Splide is geconfigureerd
  const checkActiveSlide = () => {
    // Vind de actieve slide (is-active class of display:block/flex)
    const slides = document.querySelectorAll('.splide__slide');
    let activeForm = null;
    let activeSlideIndex = -1;
    
    slides.forEach((slide, idx) => {
      const isActive = slide.classList.contains('is-active') || 
                      getComputedStyle(slide).display !== 'none';
      if (isActive) {
        const form = slide.querySelector('[data-form-name]');
        if (form) {
          activeForm = form.getAttribute('data-form-name');
          activeSlideIndex = idx;
        }
      }
    });
    
    // Als het actieve formulier is veranderd EN we hebben dit formulier al eerder bezocht
    if (activeForm && activeForm !== previouslyActiveForm) {
      console.log(`🔄 [DR Page] Slide changed: ${previouslyActiveForm} → ${activeForm} (slide ${activeSlideIndex})`);
      
      // Check of we dit formulier al eerder hebben bezocht
      if (visitedForms.has(activeForm)) {
        console.log(`♻️ [DR Page] Form ${activeForm} al eerder bezocht - RE-INITIALISEREN...`);
        
        // Re-initialiseer het formulier
        switch(activeForm) {
          case 'dr_adres-form':
            console.log('🔄 [DR Page] Re-init dr_adres-form');
            initDrAdresForm();
            break;
          case 'dr_opdracht-form':
            console.log('🔄 [DR Page] Re-init dr_opdracht-form');
            import('../forms/dieptereiniging/drOpdrachtForm.js').then(module => {
              module.initDrOpdrachtForm();
            }).catch(err => console.error('❌ [DR Page] Fout bij re-init dr_opdracht-form:', err));
            break;
          case 'dr_schoonmaker-form':
            console.log('🔄 [DR Page] Re-init dr_schoonmaker-form');
            import('../forms/dieptereiniging/drSchoonmakerForm.js').then(module => {
              module.initDrSchoonmakerForm();
            }).catch(err => console.error('❌ [DR Page] Fout bij re-init dr_schoonmaker-form:', err));
            break;
          default:
            console.log(`ℹ️ [DR Page] Geen re-init handler voor ${activeForm}`);
        }
      } else {
        // Eerste bezoek aan dit formulier - markeer als bezocht
        console.log(`✨ [DR Page] Eerste bezoek aan ${activeForm} - markeren als bezocht`);
        visitedForms.add(activeForm);
      }
      
      previouslyActiveForm = activeForm;
    }
  };
  
  // Start poller (elke 300ms checken)
  setInterval(checkActiveSlide, 300);
  console.log('✅ [DR Page] Slide change detection actief (300ms poll interval)');
});
