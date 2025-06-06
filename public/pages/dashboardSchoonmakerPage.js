// public/pages/dashboardSchoonmakerPage.js
/**
 * Initialisatie voor alle schoonmaker dashboard pagina's
 * Zorgt voor authenticatie en laadt relevante functies
 */
import { initDashboardAuth } from '../utils/auth/dashboardAuth.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('🧹 [SchoonmakerDashboard] Pagina geladen');

  // Initialiseer authenticatie met rol controle
  const user = initDashboardAuth({
    requiredRole: 'schoonmaker',
    redirectIfWrongRole: true
  });

  // Stop als gebruiker niet geauthenticeerd is
  if (!user) return;

  // Initialiseer dashboard specifieke functies
  // Dit is waar je de verschillende functies voor het schoonmaker dashboard initialiseert
  initSchoonmakerDashboardFuncties();

  console.log('✅ [SchoonmakerDashboard] Initialisatie voltooid');
});

/**
 * Initialisatie van schoonmaker dashboard functies
 * Dit kan later worden uitgebreid met specifieke functionaliteiten
 */
function initSchoonmakerDashboardFuncties() {
  // Deze functie kan later worden uitgebreid wanneer er meer 
  // schoonmaker-specifieke functionaliteit moet worden geïnitialiseerd
  
  // Voorbeeld: data ophalen voor schoonmakerdashboard
  const dashboardContent = document.querySelector('[data-dashboard="schoonmaker-content"]');
  if (dashboardContent) {
    // Hier kan je bijvoorbeeld een API call doen om schoonmakergegevens op te halen
    // en deze in het dashboard te tonen
  }
}
