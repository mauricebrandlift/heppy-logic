// api/auth/login.js
/**
 * Login endpoint voor gebruikersauthenticatie.
 * Authenticatie wordt afgehandeld door directe API calls naar Supabase.
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
    const { email, wachtwoord } = req.body;
    
    // Valideer request data
    if (!email || !wachtwoord) {
      return res.status(400).json({ error: 'Email en wachtwoord zijn verplicht', code: 'MISSING_CREDENTIALS' });
    }    // Directe API call naar Supabase Auth API
    const response = await httpClient(`${supabaseConfig.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'X-Client-Info': 'heppy-api'
      },
      body: JSON.stringify({
        email,
        password: wachtwoord
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      const error = data.error || 'Authenticatie mislukt';
      console.error('❌ [Auth API] Login fout:', error);
      return res.status(401).json({
        error: 'E-mailadres of wachtwoord is onjuist',
        code: 'AUTH_FAILED'
      });
    }
    
    // Check voor error in response
    if (!data.user || !data.access_token) {
      console.error('❌ [Auth API] Login fout:', data.error_description || 'Authenticatie mislukt');
      // Geef een gebruikersvriendelijke melding terug
      return res.status(401).json({
        error: 'E-mailadres of wachtwoord is onjuist',
        code: 'AUTH_FAILED'
      });
    }

    // Haal gebruikersprofiel op met rol informatie via directe API call
    const profileResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?user_id=eq.${data.user.id}&select=*`, 
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${data.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!profileResponse.ok) {
      console.error('❌ [Auth API] Profiel ophalen fout:', await profileResponse.text());
      return res.status(500).json({
        error: 'Kan gebruikersprofiel niet ophalen',
        code: 'PROFILE_ERROR'
      });
    }
    
    const profiles = await profileResponse.json();
    
    if (!profiles || profiles.length === 0) {
      console.error('❌ [Auth API] Geen gebruikersprofiel gevonden');
      return res.status(500).json({
        error: 'Kan gebruikersprofiel niet vinden',
        code: 'PROFILE_NOT_FOUND'
      });
    }
    
    const profile = profiles[0];    // Geef gebruikersdata terug met rol en sessie
    return res.status(200).json({
      user: {
        id: data.user.id,
        email: data.user.email,
        role: profile.rol,
        // Voeg eventueel andere benodigde gebruikersdata toe
      },
      session: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + data.expires_in
      }
    });
  } catch (error) {
    console.error('❌ [Auth API] Onverwachte login fout:', error);
    return res.status(500).json({
      error: 'Er is een onverwachte fout opgetreden', 
      code: 'AUTH_ERROR'
    });
  }
}
