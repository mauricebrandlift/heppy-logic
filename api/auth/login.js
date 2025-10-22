// api/auth/login.js
/**
 * Login endpoint voor gebruikersauthenticatie.
 * Authenticatie wordt afgehandeld door directe API calls naar Supabase.
 */
import { httpClient } from '../utils/apiClient.js';
import { supabaseConfig } from '../config/index.js';

export default async function handler(req, res) {
  const requestStartTime = Date.now();
  const requestId = `login-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log('🔐 [Login API] ========== START LOGIN REQUEST ==========');
  console.log(`📋 [Login API] Request ID: ${requestId}`);
  console.log(`⏰ [Login API] Timestamp: ${new Date().toISOString()}`);
  console.log(`🌐 [Login API] Method: ${req.method}`);
  
  // CORS headers toevoegen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // OPTIONS requests afhandelen voor CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ [Login API] OPTIONS preflight handled');
    return res.status(204).end();
  }
  
  // Alleen POST requests accepteren
  if (req.method !== 'POST') {
    console.warn(`⚠️ [Login API] Invalid method: ${req.method}`);
    return res.status(405).json({ error: 'Method niet toegestaan' });
  }

  try {
    const { email, wachtwoord } = req.body;
    
    console.log(`📧 [Login API] Email: ${email ? `${email.substring(0, 3)}***@${email.split('@')[1] || ''}` : 'LEEG'}`);
    console.log(`🔑 [Login API] Password: ${wachtwoord ? '***' : 'LEEG'}`);
    
    // Valideer request data
    if (!email || !wachtwoord) {
      console.warn('⚠️ [Login API] Missing credentials in request');
      return res.status(400).json({ error: 'Email en wachtwoord zijn verplicht', code: 'MISSING_CREDENTIALS' });
    }    // Directe API call naar Supabase Auth API
    console.log('🔄 [Login API] Calling Supabase Auth API...');
    const supabaseStartTime = Date.now();
    
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
    
    const supabaseDuration = Date.now() - supabaseStartTime;
    console.log(`⏱️ [Login API] Supabase Auth response in ${supabaseDuration}ms`);
    console.log(`📊 [Login API] Response status: ${response.status}`);
    
    const data = await response.json();
    
    if (!response.ok) {
      const error = data.error || 'Authenticatie mislukt';
      console.error('❌ [Login API] Supabase Auth failed:', error);
      console.error('🔍 [Login API] Error details:', data);
      return res.status(401).json({
        error: 'E-mailadres of wachtwoord is onjuist',
        code: 'AUTH_FAILED'
      });
    }
    
    // Check voor error in response
    if (!data.user || !data.access_token) {
      console.error('❌ [Login API] Invalid response from Supabase:', data.error_description || 'Authenticatie mislukt');
      console.error('🔍 [Login API] Response data:', { hasUser: !!data.user, hasToken: !!data.access_token });
      // Geef een gebruikersvriendelijke melding terug
      return res.status(401).json({
        error: 'E-mailadres of wachtwoord is onjuist',
        code: 'AUTH_FAILED'
      });
    }

    console.log('✅ [Login API] Supabase Auth successful');
    console.log(`👤 [Login API] User ID: ${data.user.id}`);
    console.log(`📧 [Login API] User email: ${data.user.email}`);
    console.log(`🔑 [Login API] Token expires in: ${data.expires_in}s`);    // Haal gebruikersprofiel op met rol informatie via directe API call
    console.log('🔄 [Login API] Fetching user profile...');
    const profileStartTime = Date.now();
    
    const profileResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${data.user.id}&select=*`, 
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${data.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const profileDuration = Date.now() - profileStartTime;
    console.log(`⏱️ [Login API] Profile fetch in ${profileDuration}ms`);
    console.log(`📊 [Login API] Profile response status: ${profileResponse.status}`);

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error('❌ [Login API] Profile fetch failed:', errorText);
      return res.status(500).json({
        error: 'Kan gebruikersprofiel niet ophalen',
        code: 'PROFILE_ERROR'
      });
    }
    
    const profiles = await profileResponse.json();
    
    if (!profiles || profiles.length === 0) {
      console.error('❌ [Login API] No profile found for user:', data.user.id);
      return res.status(500).json({
        error: 'Kan gebruikersprofiel niet vinden',
        code: 'PROFILE_NOT_FOUND'
      });
    }
    
    const profile = profiles[0];
    
    console.log('✅ [Login API] Profile fetched successfully');
    console.log(`👤 [Login API] User role: ${profile.rol}`);
    console.log(`📋 [Login API] Profile data:`, {
      id: profile.id,
      rol: profile.rol,
      hasVoornaam: !!profile.voornaam,
      hasAchternaam: !!profile.achternaam
    });    // Geef gebruikersdata terug met rol en sessie
    const totalDuration = Date.now() - requestStartTime;
    
    console.log('✅ [Login API] Preparing response...');
    console.log(`⏱️ [Login API] Total request duration: ${totalDuration}ms`);
    console.log('🎉 [Login API] ========== LOGIN SUCCESS ==========');
    
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
    const totalDuration = Date.now() - requestStartTime;
    
    console.error('❌ [Login API] ========== UNEXPECTED ERROR ==========');
    console.error('❌ [Login API] Error message:', error.message);
    console.error('❌ [Login API] Error stack:', error.stack);
    console.error(`⏱️ [Login API] Failed after ${totalDuration}ms`);
    console.error('❌ [Login API] ========================================');
    
    return res.status(500).json({
      error: 'Er is een onverwachte fout opgetreden', 
      code: 'AUTH_ERROR'
    });
  }
}
