// api/auth/me.js
/**
 * Me endpoint voor het ophalen van huidige gebruikersgegevens.
 * Verifieert de JWT token en retourneert gebruikersdata.
 */
import { httpClient } from '../utils/apiClient.js';
import { supabaseConfig } from '../config/index.js';

export default async function handler(req, res) {
  const requestStartTime = Date.now();
  const requestId = `me-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log('👤 [Me API] ========== START ME REQUEST ==========');
  console.log(`📋 [Me API] Request ID: ${requestId}`);
  console.log(`⏰ [Me API] Timestamp: ${new Date().toISOString()}`);
  console.log(`🌐 [Me API] Method: ${req.method}`);
  
  // CORS headers toevoegen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');
  
  // OPTIONS requests afhandelen voor CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ [Me API] OPTIONS preflight handled');
    return res.status(204).end();
  }
  
  // Alleen GET requests accepteren
  if (req.method !== 'GET') {
    console.warn(`⚠️ [Me API] Invalid method: ${req.method}`);
    return res.status(405).json({ error: 'Method niet toegestaan' });
  }
  try {
    // Haal token uit Authorization header
    const authHeader = req.headers.authorization;
    
    console.log(`🔑 [Me API] Authorization header: ${authHeader ? 'Present' : 'Missing'}`);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('⚠️ [Me API] Missing or invalid Authorization header');
      return res.status(401).json({ 
        error: 'Authenticatie vereist', 
        code: 'AUTH_REQUIRED'
      });
    }

    const token = authHeader.split(' ')[1];
    console.log(`🔑 [Me API] Token extracted: ${token.substring(0, 10)}...`);
    
    // Verifieer dat token geldig is door een directe API call naar Supabase Auth API
    console.log('🔄 [Me API] Verifying token with Supabase...');
    const verifyStartTime = Date.now();
    
    const userResponse = await httpClient(`${supabaseConfig.url}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseConfig.anonKey
      }
    });
    
    const verifyDuration = Date.now() - verifyStartTime;
    console.log(`⏱️ [Me API] Token verification in ${verifyDuration}ms`);
    console.log(`📊 [Me API] Verification status: ${userResponse.status}`);
    
    if (!userResponse.ok) {
      console.warn('⚠️ [Me API] Token verification failed');
      return res.status(401).json({ 
        error: 'Ongeldige of verlopen sessie', 
        code: 'INVALID_TOKEN'
      });
    }
    
    // Parse user data
    const user = await userResponse.json();
    
    if (!user || !user.id) {
      console.error('❌ [Me API] Invalid user data received from Supabase');
      return res.status(401).json({ 
        error: 'Ongeldige gebruikersdata', 
        code: 'INVALID_USER'
      });
    }

    console.log('✅ [Me API] Token verified successfully');
    console.log(`👤 [Me API] User ID: ${user.id}`);
    console.log(`📧 [Me API] User email: ${user.email}`);        // Haal gebruikersprofiel op met rol informatie via directe API call
      console.log('🔄 [Me API] Fetching user profile...');
      const profileStartTime = Date.now();
      
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
      
      const profileDuration = Date.now() - profileStartTime;
      console.log(`⏱️ [Me API] Profile fetch in ${profileDuration}ms`);
      console.log(`📊 [Me API] Profile response status: ${profileResponse.status}`);
      
      if (!profileResponse.ok) {
        console.error('❌ [Me API] Profile fetch failed');
        return res.status(500).json({ 
          error: 'Kan gebruikersprofiel niet ophalen', 
          code: 'PROFILE_ERROR'
        });
      }
      
      const profiles = await profileResponse.json();
      
      if (!profiles || profiles.length === 0) {
        console.error('❌ [Me API] No profile found for user:', user.id);
        return res.status(500).json({ 
          error: 'Kan gebruikersprofiel niet vinden', 
          code: 'PROFILE_NOT_FOUND'
        });
      }
      
      const profile = profiles[0];
      
      console.log('✅ [Me API] Profile fetched successfully');
      console.log(`👤 [Me API] User role: ${profile.rol}`);
      
      const totalDuration = Date.now() - requestStartTime;
      console.log(`⏱️ [Me API] Total request duration: ${totalDuration}ms`);
      console.log('✅ [Me API] ========== ME REQUEST SUCCESS ==========');
      
      // Return minimale gebruiker data (alleen auth verificatie)
      // Voor profiel data: gebruik /dashboard/klant/profile
      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          role: profile.rol
        }
      });
  } catch (error) {
    const totalDuration = Date.now() - requestStartTime;
    
    console.error('❌ [Me API] ========== UNEXPECTED ERROR ==========');
    console.error('❌ [Me API] Error message:', error.message);
    console.error('❌ [Me API] Error stack:', error.stack);
    console.error(`⏱️ [Me API] Failed after ${totalDuration}ms`);
    console.error('❌ [Me API] ========================================');
    
    return res.status(500).json({ 
      error: 'Er is een onverwachte fout opgetreden',
      code: 'SERVER_ERROR'
    });
  }
}
