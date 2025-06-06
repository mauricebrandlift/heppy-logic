// public/pages/dashboardAdminPage.js
/**
 * Initialisatie voor alle admin dashboard pagina's
 * Zorgt voor authenticatie en laadt relevante functies
 */
import { initDashboardAuth } from '../utils/auth/dashboardAuth.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('👑 [AdminDashboard] Pagina geladen');

  // Initialiseer authenticatie met rol controle
  const user = initDashboardAuth({
    requiredRole: 'admin',
    redirectIfWrongRole: true
  });

  // Stop als gebruiker niet geauthenticeerd is
  if (!user) return;

  // Initialiseer dashboard specifieke functies
  // Dit is waar je de verschillende functies voor het admin dashboard initialiseert
  initAdminDashboardFuncties();

  console.log('✅ [AdminDashboard] Initialisatie voltooid');
});

/**
 * Initialisatie van admin dashboard functies
 * Dit kan later worden uitgebreid met specifieke functionaliteiten
 */
function initAdminDashboardFuncties() {
  // Deze functie kan later worden uitgebreid wanneer er meer 
  // admin-specifieke functionaliteit moet worden geïnitialiseerd
  
  // Voorbeeld: data ophalen voor admindashboard
  const dashboardContent = document.querySelector('[data-dashboard="admin-content"]');
  if (dashboardContent) {
    // Hier kan je bijvoorbeeld een API call doen om admin-overzichtgegevens op te halen
    // en deze in het dashboard te tonen
  }
}
