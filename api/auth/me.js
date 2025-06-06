// api/auth/me.js
/**
 * Me endpoint voor het ophalen van huidige gebruikersgegevens.
 * Verifieert de JWT token en retourneert gebruikersdata.
 */
import { createClient } from '@supabase/supabase-js';
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
    
    // Initialiseer Supabase client
    const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
    
    // Verifieer dat token geldig is
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ 
        error: 'Ongeldige of verlopen sessie', 
        code: 'INVALID_TOKEN'
      });
    }
    
    // Haal gebruikersprofiel op met rol informatie
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
      
    if (profileError) {
      return res.status(500).json({ 
        error: 'Kan gebruikersprofiel niet ophalen', 
        code: 'PROFILE_ERROR'
      });
    }
    
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
