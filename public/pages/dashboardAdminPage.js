// public/pages/dashboardAdminPage.js
/**
 * Initialisatie voor alle admin dashboard pagina's
 * Zorgt voor authenticatie en laadt relevante functies per pagina
 */
import { initDashboardAuth } from '../utils/auth/dashboardAuth.js';
import { initAdminKlantenOverview } from '../forms/dashboardAdmin/klantenOverviewInit.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('👑 [AdminDashboard] Pagina geladen');

  // Authenticatie + rolcheck (async ivm server-side verificatie via /auth/me)
  const user = await initDashboardAuth({
    requiredRole: 'admin',
    redirectIfWrongRole: true,
  });

  if (!user) return;

  await initAdminDashboardFuncties();

  console.log('✅ [AdminDashboard] Initialisatie voltooid');
});

/**
 * Detecteer welke admin dashboard pagina actief is en laad de juiste module
 */
async function initAdminDashboardFuncties() {
  const klantenPage = document.querySelector('[data-dashboard-page="admin-klanten"]');

  if (klantenPage) {
    console.log('👥 [AdminDashboard] Klanten overview gedetecteerd');
    await initAdminKlantenOverview();
    return;
  }

  // Voeg hier later andere admin pagina's toe, bv:
  // const schoonmakersPage = document.querySelector('[data-dashboard-page="admin-schoonmakers"]');
  // const abonnementenPage = document.querySelector('[data-dashboard-page="admin-abonnementen"]');
  // etc.

  console.log('ℹ️ [AdminDashboard] Geen specifieke pagina gedetecteerd');
}
