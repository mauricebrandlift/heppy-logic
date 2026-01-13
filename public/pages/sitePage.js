// public/pages/sitePage.js
/**
 * Site-wide initialization script
 * Laadt algemene functionaliteit voor alle pagina's
 */
import '../utils/auth/siteAuth.js';
import './schoonmakerActiesRouter.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('🌐 [SitePage] Pagina geladen');
  
  // Initialiseer site-brede functionaliteit
  initCommonUI();
});

/**
 * Initialiseert gemeenschappelijke UI elementen
 */
function initCommonUI() {
  // Voeg hier algemene site-brede UI initialisatie toe
  // Bijvoorbeeld: 
  // - Mobiel menu toggle
  // - Scroll animaties
  // - Cookie consent banner
  // - etc.
  
  // Dit is een placeholder voor toekomstige site-brede functionaliteit
  console.log('🌐 [SitePage] Gemeenschappelijke UI geïnitialiseerd');
}
