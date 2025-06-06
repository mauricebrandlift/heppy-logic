// public/utils/auth/siteAuth.js
/**
 * Site-wide authentication utilities
 * Voor het tonen/verbergen van elementen op basis van authenticatie en rol
 */
import { authClient } from './authClient.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialiseer site-brede authenticatie UI updates
  initSiteAuthUI();
  
  // Voeg event listeners toe voor auth events
  listenForAuthEvents();
});

/**
 * Initialiseert site-brede UI elementen op basis van auth status
 */
function initSiteAuthUI() {
  updateAuthBasedElements();
}

/**
 * Luister naar auth events voor dynamische UI updates
 */
function listenForAuthEvents() {
  // Login event
  window.addEventListener('heppy:auth:login', () => {
    console.log('🔔 [SiteAuth] Login event ontvangen');
    updateAuthBasedElements();
  });
  
  // Logout event
  window.addEventListener('heppy:auth:logout', () => {
    console.log('🔔 [SiteAuth] Logout event ontvangen');
    updateAuthBasedElements();
  });
}

/**
 * Update UI elementen op basis van authenticatie status
 */
function updateAuthBasedElements() {
  // Check authenticatie status
  const isAuthenticated = authClient.isAuthenticated();
  const user = isAuthenticated ? authClient.getAuthState().user : null;
  const userRole = user ? user.role : null;
  
  // Elementen om te tonen voor geauthenticeerde gebruikers
  const authOnlyElements = document.querySelectorAll('[data-auth="required"]');
  
  // Elementen om te tonen voor niet-geauthenticeerde gebruikers
  const noAuthElements = document.querySelectorAll('[data-auth="none"]');
  
  // Elementen met specifieke rollen
  const roleElements = document.querySelectorAll('[data-auth-role]');
  
  // Update auth-only elementen
  authOnlyElements.forEach(element => {
    element.style.display = isAuthenticated ? '' : 'none';
  });
  
  // Update no-auth elementen
  noAuthElements.forEach(element => {
    element.style.display = !isAuthenticated ? '' : 'none';
  });
  
  // Update role-specific elementen
  roleElements.forEach(element => {
    const requiredRoles = element.getAttribute('data-auth-role').split(',');
    const hasRequiredRole = userRole && requiredRoles.includes(userRole);
    element.style.display = hasRequiredRole ? '' : 'none';
  });
  
  // Vul gebruikersinformatie in navigatie-elementen
  if (isAuthenticated && user) {
    const userNameElements = document.querySelectorAll('[data-user-field="naam"], [data-user-field="name"]');
    userNameElements.forEach(element => {
      element.textContent = user.name || user.email.split('@')[0];
    });
    
    // Voeg dashboard link toe aan menu items
    const dashboardLinkElements = document.querySelectorAll('[data-nav-link="dashboard"]');
    dashboardLinkElements.forEach(element => {
      element.href = authClient.getDashboardUrl();
    });
  }
}
