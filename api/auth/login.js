// api/auth/login.js
/**
 * Login endpoint voor gebruikersauthenticatie.
 * Authenticatie wordt afgehandeld door Supabase.
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
    const { email, wachtwoord } = req.body;
    
    // Valideer request data
    if (!email || !wachtwoord) {
      return res.status(400).json({ error: 'Email en wachtwoord zijn verplicht', code: 'MISSING_CREDENTIALS' });
    }

    // Initialiseer Supabase client met config uit api/config/index.js
    const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
    
    // Authenticeer met Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: wachtwoord
    });

    if (error) {
      console.error('❌ [Auth API] Login fout:', error.message);
      // Geef een gebruikersvriendelijke melding terug
      return res.status(401).json({
        error: 'E-mailadres of wachtwoord is onjuist',
        code: 'AUTH_FAILED'
      });
    }

    if (!data.user) {
      return res.status(401).json({
        error: 'Ongeldig account',
        code: 'INVALID_ACCOUNT'
      });
    }

    // Haal gebruikersprofiel op met rol informatie
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', data.user.id)
      .single();

    if (profileError) {
      console.error('❌ [Auth API] Profiel ophalen fout:', profileError.message);
      return res.status(500).json({
        error: 'Kan gebruikersprofiel niet ophalen',
        code: 'PROFILE_ERROR'
      });
    }

    // Geef gebruikersdata terug met rol en sessie
    return res.status(200).json({
      user: {
        id: data.user.id,
        email: data.user.email,
        role: profile.rol,
        // Voeg eventueel andere benodigde gebruikersdata toe
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
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
