// api/auth/logout.js
/**
 * Logout endpoint voor het uitloggen van gebruikers.
 * Beëindigt de sessie in Supabase door een directe API call.
 */
import { httpClient } from '../utils/apiClient.js';
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
    
    // Log gebruiker uit door directe API call naar Supabase Auth API
    const response = await httpClient(`${supabaseConfig.url}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ [Auth API] Uitlog fout:', error);
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
