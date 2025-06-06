// api/checks/authCheck.js
/**
 * Authenticatie controle utilities voor API routes
 */
import { createClient } from '@supabase/supabase-js';
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
  
  // Initialiseer Supabase client
  const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
  
  // Verifieer dat token geldig is
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Ongeldige of verlopen token');
  }
  
  // Haal gebruikersprofiel op met rol
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();
    
  if (profileError) {
    throw new Error('Gebruikersprofiel niet gevonden');
  }
  
  // Returneer de gebruiker met hun rol
  return {
    id: user.id,
    email: user.email,
    role: profile.rol,
    profile
  };
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
