// public/pages/dashboardSchoonmakerPage.js
/**
 * Initialisatie voor alle schoonmaker dashboard pagina's
 * Zorgt voor authenticatie en laadt relevante functies
 */
import { initDashboardAuth } from '../utils/auth/dashboardAuth.js';
import { initSchoonmakerOverview } from '../forms/dashboardSchoonmaker/overviewInit.js';
import { initBeschikbaarheidOverview } from '../forms/dashboardSchoonmaker/beschikbaarheidInit.js';

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
  initSchoonmakerDashboardFuncties();

  console.log('✅ [SchoonmakerDashboard] Initialisatie voltooid');
});

/**
 * Initialisatie van schoonmaker dashboard functies
 * Detecteert welke pagina actief is en initialiseert de juiste module
 */
function initSchoonmakerDashboardFuncties() {
  // Check welke dashboard pagina actief is
  const overviewPage = document.querySelector('[data-dashboard-page="overview"]');
  
  if (overviewPage) {
    console.log('📊 [SchoonmakerDashboard] Overview pagina gedetecteerd');
    initSchoonmakerOverview();
    initBeschikbaarheidOverview();
    return;
  }
  
  // Andere pagina's kunnen hier worden toegevoegd:
  // const accountPage = document.querySelector('[data-dashboard-page="account"]');
  // const chatPage = document.querySelector('[data-dashboard-page="chat"]');
  // etc.
  
  console.log('ℹ️ [SchoonmakerDashboard] Geen specifieke pagina gedetecteerd, standaard init');
}
