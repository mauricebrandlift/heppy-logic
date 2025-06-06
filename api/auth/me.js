// api/auth/me.js
/**
 * Me endpoint voor het ophalen van huidige gebruikersgegevens.
 * Verifieert de JWT token en retourneert gebruikersdata.
 */
import { httpClient } from '../utils/apiClient.js';
import { supabaseConfig } from '../config/index.js';

export default async function handler(req, res) {
  // CORS headers toevoegen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // OPTIONS requests afhandelen voor CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  // Alleen GET requests accepteren
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method niet toegestaan' });
  }
  try {
    // Haal token uit Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authenticatie vereist', 
        code: 'AUTH_REQUIRED'
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verifieer dat token geldig is door een directe API call naar Supabase Auth API
    const userResponse = await httpClient(`${supabaseConfig.url}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseConfig.anonKey
      }
    });
    
    if (!userResponse.ok) {
      return res.status(401).json({ 
        error: 'Ongeldige of verlopen sessie', 
        code: 'INVALID_TOKEN'
      });
    }
    
    // Parse user data
    const user = await userResponse.json();
    
    if (!user || !user.id) {
      return res.status(401).json({ 
        error: 'Ongeldige gebruikersdata', 
        code: 'INVALID_USER'
      });
    }        // Haal gebruikersprofiel op met rol informatie via directe API call
      const profileResponse = await httpClient(
        `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${user.id}&select=*`, 
        {
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!profileResponse.ok) {
        return res.status(500).json({ 
          error: 'Kan gebruikersprofiel niet ophalen', 
          code: 'PROFILE_ERROR'
        });
      }
      
      const profiles = await profileResponse.json();
      
      if (!profiles || profiles.length === 0) {
        return res.status(500).json({ 
          error: 'Kan gebruikersprofiel niet vinden', 
          code: 'PROFILE_NOT_FOUND'
        });
      }
      
      const profile = profiles[0];
      
      // Return de gebruiker met hun rol
      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          role: profile.rol,
          // Voeg andere relevante gebruikersdata toe
        }
      });
  } catch (error) {
    console.error('❌ [Auth API] Fout in me-endpoint:', error);
    return res.status(500).json({ 
      error: 'Er is een onverwachte fout opgetreden',
      code: 'SERVER_ERROR'
    });
  }
}
