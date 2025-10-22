// api/auth/logout.js
/**
 * Logout endpoint voor het uitloggen van gebruikers.
 * Beëindigt de sessie in Supabase door een directe API call.
 */
import { httpClient } from '../utils/apiClient.js';
import { supabaseConfig } from '../config/index.js';

export default async function handler(req, res) {
  const requestStartTime = Date.now();
  const requestId = `logout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log('🚪 [Logout API] ========== START LOGOUT REQUEST ==========');
  console.log(`📋 [Logout API] Request ID: ${requestId}`);
  console.log(`⏰ [Logout API] Timestamp: ${new Date().toISOString()}`);
  console.log(`🌐 [Logout API] Method: ${req.method}`);
  
  // CORS headers toevoegen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // OPTIONS requests afhandelen voor CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ [Logout API] OPTIONS preflight handled');
    return res.status(204).end();
  }
  
  // Alleen POST requests accepteren
  if (req.method !== 'POST') {
    console.warn(`⚠️ [Logout API] Invalid method: ${req.method}`);
    return res.status(405).json({ error: 'Method niet toegestaan' });
  }

  try {
    // Haal token uit Authorization header
    const authHeader = req.headers.authorization;
    
    console.log(`🔑 [Logout API] Authorization header: ${authHeader ? 'Present' : 'Missing'}`);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('⚠️ [Logout API] Missing or invalid Authorization header');
      return res.status(401).json({ error: 'Authenticatie vereist' });
    }

    const token = authHeader.split(' ')[1];
    console.log(`🔑 [Logout API] Token extracted: ${token.substring(0, 10)}...`);
    
    // Log gebruiker uit door directe API call naar Supabase Auth API
    console.log('🔄 [Logout API] Calling Supabase logout endpoint...');
    const supabaseStartTime = Date.now();
    
    const response = await httpClient(`${supabaseConfig.url}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${token}`
      }
    });
    
    const supabaseDuration = Date.now() - supabaseStartTime;
    console.log(`⏱️ [Logout API] Supabase response in ${supabaseDuration}ms`);
    console.log(`📊 [Logout API] Response status: ${response.status}`);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ [Logout API] Supabase logout failed:', error);
      return res.status(500).json({ error: 'Probleem bij uitloggen', code: 'LOGOUT_ERROR' });
    }
    
    const totalDuration = Date.now() - requestStartTime;
    console.log(`⏱️ [Logout API] Total request duration: ${totalDuration}ms`);
    console.log('✅ [Logout API] ========== LOGOUT SUCCESS ==========');
    
    return res.status(200).json({ message: 'Succesvol uitgelogd' });
  } catch (error) {
    const totalDuration = Date.now() - requestStartTime;
    
    console.error('❌ [Logout API] ========== UNEXPECTED ERROR ==========');
    console.error('❌ [Logout API] Error message:', error.message);
    console.error('❌ [Logout API] Error stack:', error.stack);
    console.error(`⏱️ [Logout API] Failed after ${totalDuration}ms`);
    console.error('❌ [Logout API] ========================================');
    
    return res.status(500).json({ 
      error: 'Er is een onverwachte fout opgetreden', 
      code: 'SERVER_ERROR'
    });
  }
}
