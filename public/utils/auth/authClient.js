// public/utils/auth/authClient.js
/**
 * Authentication client voor frontend applicatie 
 * Beheert inloggen, uitloggen en sessiegegevens
 */
import { API_CONFIG } from '../../config/apiConfig.js';

export class AuthError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Auth storage key in localStorage
const AUTH_STORAGE_KEY = 'heppy_auth';

// Auth event types 
const AUTH_EVENTS = {
  LOGIN: 'heppy:auth:login',
  LOGOUT: 'heppy:auth:logout',
  SESSION_EXPIRED: 'heppy:auth:expired'
};

export const authClient = {
  /**
   * Logt een gebruiker in met emailadres en wachtwoord
   * @param {string} emailadres - Gebruiker emailadres
   * @param {string} wachtwoord - Gebruiker wachtwoord
   * @returns {Promise<{user, session}>} Gebruikersdata en sessie
   */
  async login(emailadres, wachtwoord) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.LOGIN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailadres, wachtwoord })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new AuthError(
          data.error || 'Inloggen mislukt', 
          response.status,
          data.code
        );
      }

      // Bewaar auth data in localStorage
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        user: data.user,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }));

      // Dispatch event zodat app onderdelen kunnen reageren op auth wijziging
      window.dispatchEvent(new CustomEvent(AUTH_EVENTS.LOGIN, {
        detail: { user: data.user }
      }));

      return data;
    } catch (error) {
      console.error('Auth fout:', error);
      throw error;
    }
  },

  /**
   * Haal huidige authenticatie status op
   * @returns {Object|null} Huidige auth data of null indien niet geauthenticeerd
   */
  getAuthState() {
    try {
      const authData = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!authData) return null;
      
      const parsed = JSON.parse(authData);
      
      // Controleer of token verlopen is
      if (parsed.expires_at && new Date(parsed.expires_at * 1000) < new Date()) {
        this.logout('expired');
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error('Fout bij ophalen auth status:', error);
      return null;
    }
  },

  /**
   * Log huidige gebruiker uit
   * @param {string} reason - Optionele reden voor uitloggen
   */
  async logout(reason) {
    try {
      // Roep logout endpoint aan indien nodig
      const authData = this.getAuthState();
      if (authData?.access_token) {
        await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.LOGOUT}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authData.access_token}`
          }
        }).catch(err => {
          // Negeer API fouten bij uitloggen; we loggen lokaal altijd uit
          console.warn('Uitlog API fout (genegeerd):', err);
        });
      }
    } finally {
      // Altijd localStorage wissen, ongeacht API succes
      localStorage.removeItem(AUTH_STORAGE_KEY);
      
      // Dispatch event voor UI updates
      window.dispatchEvent(new CustomEvent(AUTH_EVENTS.LOGOUT, {
        detail: { reason }
      }));
      
      // Redirect naar home of login pagina als reden niet 'redirect' is
      // Dit voorkomt oneindige redirects
      if (reason !== 'redirect') {
        window.location.href = '/inloggen';
      }
    }
  },

  /**
   * Controleer of gebruiker specifieke rol heeft
   * @param {string|Array} rollen - Rol of array van rollen om te controleren
   * @returns {boolean} Of gebruiker vereiste rol heeft
   */
  hasRole(rollen) {
    const auth = this.getAuthState();
    if (!auth || !auth.user || !auth.user.role) return false;
    
    if (Array.isArray(rollen)) {
      return rollen.includes(auth.user.role);
    }
    
    return auth.user.role === rollen;
  },

  /**
   * Haal dashboard URL op gebaseerd op gebruikersrol
   * @returns {string} Dashboard URL
   */
  getDashboardUrl() {
    const auth = this.getAuthState();
    if (!auth || !auth.user || !auth.user.role) return '/inloggen';
    
    switch (auth.user.role) {
      case 'klant':
        return '/dashboard/klant/overview';
      case 'schoonmaker':
        return '/dashboard/schoonmaker/overview';
      case 'admin':
        return '/dashboard/admin/overview';
      default:
        return '/inloggen';
    }
  },

  /**
   * Haal huidige gebruiker op via API (vernieuwt data)
   * @returns {Promise<Object>} User object met profiel data
   */
  async getCurrentUser() {
    const authData = this.getAuthState();
    if (!authData || !authData.access_token) {
      throw new AuthError('Niet ingelogd', 401, 'NOT_AUTHENTICATED');
    }

    // Haal uitgebreide profiel data op via profile endpoint
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PROFILE}`, {
      headers: {
        Authorization: `Bearer ${authData.access_token}`
      }
    });

    if (!response.ok) {
      const data = await response.json();
      if (response.status === 401) {
        this.logout('expired');
      }
      throw new AuthError(data.error || 'Sessie fout', response.status, data.code);
    }

    const data = await response.json();
    // Profile endpoint retourneert { profile: {...} }
    return data.profile || data.user || data;
  },

  /**
   * Controleer of de huidige gebruiker is ingelogd
   * @returns {boolean} Of gebruiker is ingelogd
   */
  isAuthenticated() {
    const authState = this.getAuthState();
    return authState !== null && authState.access_token;
  },

  /**
   * Registreer event listener voor auth events
   * @param {string} event - Event type (login, logout, expired)
   * @param {Function} callback - Callback function
   */
  onAuthEvent(event, callback) {
    if (!AUTH_EVENTS[event]) {
      console.error(`Onbekend auth event: ${event}`);
      return;
    }
    window.addEventListener(AUTH_EVENTS[event], callback);
    return () => window.removeEventListener(AUTH_EVENTS[event], callback);
  }
};
