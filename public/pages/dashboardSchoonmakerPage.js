// public/pages/dashboardSchoonmakerPage.js
/**
 * Initialisatie voor alle schoonmaker dashboard pagina's
 * Zorgt voor authenticatie en laadt relevante functies
 */
import { initDashboardAuth } from '../utils/auth/dashboardAuth.js';
import { initSchoonmakerOverview } from '../forms/dashboardSchoonmaker/overviewInit.js';
import { initBeschikbaarheidOverview } from '../forms/dashboardSchoonmaker/beschikbaarheidInit.js';
import { initAbonnementenOverview } from '../forms/dashboardSchoonmaker/abonnementenOverviewInit.js';
import { initGestopteAbonnementen } from '../forms/dashboardSchoonmaker/gestopteAbonnementenInit.js';
import { initEenmaligeAangenomen } from '../forms/dashboardSchoonmaker/eenmaligeAangenomenInit.js';
import { initAccountBeheren } from '../forms/dashboardSchoonmaker/accountBeherenInit.js';
import { initSchoonmakerAbonnementDetail } from '../forms/dashboardSchoonmaker/abonnementDetailInit.js';

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
    initAbonnementenOverview();
    initGestopteAbonnementen();
    initEenmaligeAangenomen();
    return;
  }

  const accountBeherenPage = document.querySelector('[data-dashboard-page="account-beheren"]');
  
  if (accountBeherenPage) {
    console.log('⚙️ [SchoonmakerDashboard] Account beheren pagina gedetecteerd');
    initAccountBeheren();
    return;
  }

  const abonnementDetailPage = document.querySelector('[data-dashboard-page="abonnement-detail"]');
  
  if (abonnementDetailPage) {
    console.log('📋 [SchoonmakerDashboard] Abonnement detail pagina gedetecteerd');
    initSchoonmakerAbonnementDetail();
    return;
  }
  
  // Andere pagina's kunnen hier worden toegevoegd:
  // const chatPage = document.querySelector('[data-dashboard-page="chat"]');
  // const uitbetalingenPage = document.querySelector('[data-dashboard-page="uitbetalingen"]');
  // etc.
  
  console.log('ℹ️ [SchoonmakerDashboard] Geen specifieke pagina gedetecteerd, standaard init');
}
