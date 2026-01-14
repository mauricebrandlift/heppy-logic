// public/utils/auth/dashboardAuth.js
/**
 * Dashboard authentication controller
 * Controleert of gebruikers ingelogd zijn en de juiste rol hebben voor dashboard pagina's
 */
import { authClient } from './authClient.js';

/**
 * Dashboard paden per rol
 * Wordt gebruikt om te controleren of gebruiker toegang heeft tot het juiste dashboard
 */
const DASHBOARD_PATHS = {
  klant: '/dashboard/klant',
  schoonmaker: '/dashboard/schoonmaker',
  admin: '/dashboard/admin'
};

/**
 * Initialisatie van dashboard authenticatie
 * Controleert of gebruiker ingelogd is en de juiste rol heeft
 * 
 * @param {Object} options - Configuratie opties
 * @param {string} options.requiredRole - Vereiste rol voor huidige pagina (optioneel)
 * @param {boolean} options.redirectIfWrongRole - Of gebruiker omgeleid moet worden bij verkeerde rol
 * @returns {Object|null} Authenticated user object or null if not authenticated
 */
export async function initDashboardAuth(options = {}) {
  const { requiredRole = null, redirectIfWrongRole = true } = options;
  
  console.log('🔒 [DashboardAuth] Initialiseren...');
  
  // Controleer of gebruiker is ingelogd
  if (!authClient.isAuthenticated()) {
    console.log('🔒 [DashboardAuth] Gebruiker niet ingelogd, redirecting naar login pagina');
    window.location.href = '/inloggen?message=Je sessie is verlopen. Log opnieuw in.';
    return null;
  }
  
  // Haal auth state op (dit checkt ook token expiry timestamp)
  const authState = authClient.getAuthState();
  
  // Als getAuthState null teruggeeft, is de token expired (op basis van timestamp)
  if (!authState) {
    console.log('🔒 [DashboardAuth] Token expired (timestamp), redirecting naar login pagina');
    window.location.href = '/inloggen?message=Je sessie is verlopen. Log opnieuw in.';
    return null;
  }
  
  // EXTRA: Verifieer token server-side via /auth/me endpoint
  // Dit vangt tokens die geïnvalideerd zijn door Supabase (bijv. na wachtwoord wijziging)
  try {
    const { apiClient } = await import('../api/client.js');
    await apiClient('/auth/me', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authState.access_token}` }
    });
    console.log('✅ [DashboardAuth] Token verificatie geslaagd');
  } catch (error) {
    console.warn('⚠️ [DashboardAuth] Token verificatie gefaald:', error.message);
    // Token is invalid, clear en redirect
    localStorage.removeItem('heppy_auth');
    window.location.href = '/inloggen?message=Je sessie is ongeldig. Log opnieuw in.';
    return null;
  }
  
  const userRole = authState?.user?.role;
  
  if (!userRole) {
    console.error('❌ [DashboardAuth] Gebruikersrol ontbreekt, uitloggen en redirecten');
    authClient.logout('invalid');
    return null;
  }
  
  // Controleer of we op het juiste pad zijn voor de rol
  const currentPath = window.location.pathname;
  
  // Controleer of de route overeenkomt met de gebruikersrol
  // bijv. een klant mag alleen in /dashboard/klant/* URLs zijn
  const isCorrectDashboard = currentPath.startsWith(DASHBOARD_PATHS[userRole]);
  
  if (!isCorrectDashboard && redirectIfWrongRole) {
    console.warn(`⚠️ [DashboardAuth] Gebruiker met rol ${userRole} heeft geen toegang tot ${currentPath}`);
    window.location.href = authClient.getDashboardUrl();
    return null;
  }
  
  // Controleer specifieke rol vereiste indien opgegeven 
  if (requiredRole && userRole !== requiredRole && redirectIfWrongRole) {
    console.warn(`⚠️ [DashboardAuth] Pagina vereist rol ${requiredRole}, gebruiker heeft rol ${userRole}`);
    window.location.href = authClient.getDashboardUrl();
    return null;
  }
  
  console.log(`✅ [DashboardAuth] Gebruiker ingelogd als ${userRole}`);
  
  // Initialiseer uitlog buttons
  initLogoutButtons();
  
  // Vul gebruikersinformatie in waar nodig
  populateUserInfo(authState.user);
  
  return authState.user;
}

/**
 * Initialiseert logout knoppen
 */
function initLogoutButtons() {
  const logoutButtons = document.querySelectorAll('[data-action="logout"]');
  
  logoutButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('👋 [DashboardAuth] Uitloggen geïnitieerd door gebruiker');
      authClient.logout();
    });
  });
}

/**
 * Vult gebruikersinformatie in op de pagina
 * @param {Object} user - Gebruiker object 
 */
function populateUserInfo(user) {
  if (!user) return;
  
  // Zoek elementen met data-user-field attribuut en vul deze met gebruikersdata
  const userElements = document.querySelectorAll('[data-user-field]');
  
  userElements.forEach(element => {
    const fieldName = element.getAttribute('data-user-field');
    
    // Zet inhoud op basis van veld
    switch (fieldName) {
      case 'name':
      case 'naam':
        element.textContent = user.name || user.email.split('@')[0];
        break;
      case 'email':
        element.textContent = user.email;
        break;
      case 'role':
      case 'rol':
        element.textContent = user.role === 'klant' ? 'Klant' : 
                             user.role === 'schoonmaker' ? 'Schoonmaker' : 
                             user.role === 'admin' ? 'Admin' : user.role;
        break;
      default:
        // Voor andere velden, probeer direct uit user object te halen
        if (user[fieldName]) {
          element.textContent = user[fieldName];
        }
    }
  });
}
