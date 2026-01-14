// public/pages/dashboardKlantPage.js
/**
 * Initialisatie voor alle klant dashboard pagina's
 * Zorgt voor authenticatie en laadt relevante functies
 */
import { initDashboardAuth } from '../utils/auth/dashboardAuth.js';
import { initDashboardOverview } from '../forms/dashboardKlant/overviewInit.js';
import { initBestellingDetail } from '../forms/dashboardKlant/bestellingDetailInit.js';
import { initFacturenOverzicht } from '../forms/dashboardKlant/facturenInit.js';
import { initAccountBeheren } from '../forms/dashboardKlant/accountBeherenInit.js';
import { initAbonnementDetail } from '../forms/dashboardKlant/abonnementDetailInit.js';
import { initOpdrachtDetail } from '../forms/dashboardKlant/opdrachtenDetailInit.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🏠 [KlantDashboard] Pagina geladen');

  // Initialiseer authenticatie met rol controle (nu async vanwege server-side verificatie)
  const user = await initDashboardAuth({
    requiredRole: 'klant',
    redirectIfWrongRole: true
  });

  // Stop als gebruiker niet geauthenticeerd is
  if (!user) return;

  // Initialiseer dashboard specifieke functies
  await initKlantDashboardFuncties();

  console.log('✅ [KlantDashboard] Initialisatie voltooid');
});

/**
 * Initialisatie van klant dashboard functies
 * Detecteert welke pagina actief is en laadt de juiste functionaliteit
 */
async function initKlantDashboardFuncties() {
  // Check welke pagina we hebben
  const overviewPage = document.querySelector('[data-dashboard-page="overview"]');
  const bestellingDetailPage = document.querySelector('[data-dashboard-page="bestelling-detail"]');
  const facturenPage = document.querySelector('[data-dashboard-page="facturen"]');
  const accountBeherenPage = document.querySelector('[data-dashboard-page="account-beheren"]');
  const abonnementDetailPage = document.querySelector('[data-dashboard-page="abonnement-detail"]');
  const opdrachtDetailPage = document.querySelector('[data-dashboard-page="opdracht-detail"]');
  
  if (overviewPage) {
    console.log('📊 [KlantDashboard] Overview pagina gedetecteerd');
    await initDashboardOverview();
  }
  
  if (bestellingDetailPage) {
    console.log('📦 [KlantDashboard] Bestelling detail pagina gedetecteerd');
    await initBestellingDetail();
  }
  
  if (facturenPage) {
    console.log('📄 [KlantDashboard] Facturen pagina gedetecteerd');
    await initFacturenOverzicht();
  }
  
  if (accountBeherenPage) {
    console.log('⚙️ [KlantDashboard] Account beheren pagina gedetecteerd');
    await initAccountBeheren();
  }
  
  if (abonnementDetailPage) {
    console.log('📋 [KlantDashboard] Abonnement detail pagina gedetecteerd');
    await initAbonnementDetail();
  }
  
  if (opdrachtDetailPage) {
    console.log('🧹 [KlantDashboard] Opdracht detail pagina gedetecteerd');
    await initOpdrachtDetail();
  }
  
  // Hier komen later andere pagina checks:
  // const schoonmakerProfielPage = document.querySelector('[data-dashboard-page="schoonmaker-profiel"]');
  // etc.
}
