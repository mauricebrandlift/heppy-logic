// api/auth/logout.js
/**
 * Logout endpoint voor het uitloggen van gebruikers.
 * Beëindigt de sessie in Supabase.
 */
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '../config/index.js';

export default async function handler(req, res) {
  // CORS headers toevoegen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // OPTIONS requests afhandelen voor CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  // Alleen POST requests accepteren
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method niet toegestaan' });
  }

  try {
    // Haal token uit Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authenticatie vereist' });
    }

    const token = authHeader.split(' ')[1];
    
    // Initialiseer Supabase client
    const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
    
    // Log gebruiker uit door sessie te beëindigen
    const { error } = await supabase.auth.admin.signOut(token);
    
    if (error) {
      console.error('❌ [Auth API] Uitlog fout:', error.message);
      return res.status(500).json({ error: 'Probleem bij uitloggen', code: 'LOGOUT_ERROR' });
    }
    
    return res.status(200).json({ message: 'Succesvol uitgelogd' });
  } catch (error) {
    console.error('❌ [Auth API] Onverwachte uitlog fout:', error);
    return res.status(500).json({ 
      error: 'Er is een onverwachte fout opgetreden', 
      code: 'SERVER_ERROR'
    });
  }
}
