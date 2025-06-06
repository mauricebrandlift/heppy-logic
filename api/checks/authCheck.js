// api/checks/authCheck.js
/**
 * Authenticatie controle utilities voor API routes
 */
import { httpClient } from '../utils/apiClient.js';
import { supabaseConfig } from '../config/index.js';

/**
 * Verifieert een JWT token en retourneert gebruikersdata
 * @param {string} token - JWT token uit Authorization header
 * @returns {Object} Gebruikersdata met rol
 * @throws {Error} Als token ongeldig is of gebruiker niet gevonden
 */
export async function verifyAuth(token) {
  if (!token) {
    throw new Error('Geen token aanwezig');
  }
  
  try {
    // Verifieer dat token geldig is door een directe API call naar Supabase Auth API
    const userResponse = await httpClient(`${supabaseConfig.url}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseConfig.anonKey
      }
    });
    
    if (!userResponse.ok) {
      throw new Error('Ongeldige of verlopen token');
    }
    
    // Parse user data
    const user = await userResponse.json();
    
    if (!user || !user.id) {
      throw new Error('Ongeldige gebruikersdata');
    }
      // Haal gebruikersprofiel op met rol informatie via directe API call
    const profileResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?uuid=eq.${user.id}&select=*`, 
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!profileResponse.ok) {
      throw new Error('Gebruikersprofiel niet gevonden');
    }
    
    const profiles = await profileResponse.json();
    
    if (!profiles || profiles.length === 0) {
      throw new Error('Gebruikersprofiel niet gevonden');
    }
      const profile = profiles[0];
  
    // Returneer de gebruiker met hun rol
    return {
      id: user.id,
      email: user.email,
      role: profile.rol,
      profile
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Controleert of gebruiker de vereiste rol heeft
 * @param {Array|string} toegestaneRollen - Rol of rollen die toegestaan zijn
 * @returns {Function} Middleware functie
 */
export function checkRole(toegestaneRollen) {
  return async (req, res, user) => {
    // Als er geen gebruiker is door vorige middleware
    if (!user) {
      return false;
    }
    
    // Converteer enkele rol naar array voor consistente controle
    const rollen = Array.isArray(toegestaneRollen) ? toegestaneRollen : [toegestaneRollen];
    
    // Controleer of gebruikersrol in toegestane rollen zit
    if (!rollen.includes(user.role)) {
      return false;
    }
    
    return true;
  };
}
