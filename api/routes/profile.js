// api/routes/profile.js
/**
 * Protected profile API route
 * Returns user profile data based on their role
 */
import { withAuth } from '../utils/authMiddleware.js';
import { httpClient } from '../utils/apiClient.js';
import { supabaseConfig } from '../config/index.js';

/**
 * Handler voor het ophalen van gebruikersprofiel
 * Vereist authenticatie
 */
async function profileHandler(req, res) {
  // Set CORS headers for ALL responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, Authorization');

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Echo correlationId if provided
  const correlationId = req.headers['x-correlation-id'];
  if (correlationId) {
    res.setHeader('X-Correlation-ID', correlationId);
  }

  const requestId = `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  try {
    console.log('🔐 [Profile API] ========== START PROFILE REQUEST ==========');
    console.log(`📋 [Profile API] Request ID: ${requestId}`);
    console.log(`⏰ [Profile API] Timestamp: ${new Date().toISOString()}`);
    
    // User is beschikbaar in req.user (ingesteld door authMiddleware)
    const { id: userId, role } = req.user;
    const authToken = req.headers.authorization?.split(' ')[1];
    
    console.log(`👤 [Profile API] User ID: ${userId}`);
    console.log(`🎭 [Profile API] Role: ${role}`);
    console.log(`🔑 [Profile API] Has token: ${!!authToken}`);
    
    if (!authToken) {
      console.log('❌ [Profile API] Geen auth token gevonden');
      return res.status(401).json({ error: 'Authenticatie vereist' });
    }
    
    // Haal uitgebreide profieldata op uit juiste tabel op basis van rol
    let profileData = null;
    let tableName;
    
    switch (role) {
      case 'klant':
        tableName = 'klanten';
        break;
        
      case 'schoonmaker':
        tableName = 'schoonmakers';
        break;
        
      case 'admin':
        tableName = 'admins';
        break;
        
      default:
        console.log(`❌ [Profile API] Ongeldige rol: ${role}`);
        return res.status(400).json({ error: 'Ongeldige gebruikersrol' });
    }
    
    console.log(`📊 [Profile API] Querying table: ${tableName}`);
    const profileUrl = `${supabaseConfig.url}/rest/v1/${tableName}?id=eq.${userId}&select=*`;
    console.log(`🔗 [Profile API] Profile URL: ${profileUrl}`);
    
    // Directe API call naar Supabase REST API voor het ophalen van profieldata
    const profileResponse = await httpClient(
      profileUrl, 
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`📊 [Profile API] Profile response status: ${profileResponse.status}`);
    
    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.log(`❌ [Profile API] Profile response NOT OK: ${errorText}`);
      throw new Error(`Kan ${role} profiel niet ophalen`);
    }
    
    const profiles = await profileResponse.json();
    console.log(`📋 [Profile API] Profiles array length: ${profiles?.length || 0}`);
    
    if (!profiles || profiles.length === 0) {
      throw new Error(`Geen ${role} profiel gevonden`);
    }
    
    profileData = profiles[0];
    
    // Haal basis gebruikersinformatie op
    const baseProfileResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${userId}&select=*`, 
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`📊 [Profile API] Base profile response status: ${baseProfileResponse.status}`);
    
    if (!baseProfileResponse.ok) {
      const errorText = await baseProfileResponse.text();
      console.log(`❌ [Profile API] Base profile response NOT OK: ${errorText}`);
      throw new Error('Kan basis profiel niet ophalen');
    }
    
    const baseProfiles = await baseProfileResponse.json();
    console.log(`📋 [Profile API] Base profiles array length: ${baseProfiles?.length || 0}`);
    
    if (!baseProfiles || baseProfiles.length === 0) {
      console.log(`❌ [Profile API] Geen basis profiel gevonden voor user ${userId}`);
      throw new Error('Geen basis profiel gevonden');
    }
    
    const baseProfile = baseProfiles[0];
    console.log(`✅ [Profile API] Base profile data keys: ${Object.keys(baseProfile).join(', ')}`);
    
    // Combineer profielen - return zoals frontend verwacht
    const combinedProfile = {
      ...baseProfile,
      ...profileData,
      role // Zorg dat de rol altijd beschikbaar is
    };
    
    console.log(`✅ [Profile API] Combined profile keys: ${Object.keys(combinedProfile).join(', ')}`);
    console.log(`⏱️ [Profile API] Total request duration: ${Date.now() - startTime}ms`);
    console.log('🎉 [Profile API] ========== PROFILE SUCCESS ==========');
    
    // Retourneer profiel DIRECT (niet genest in {success, profile})
    // Zodat frontend direct response.adres kan gebruiken
    return res.status(200).json(combinedProfile);
    
  } catch (error) {
    console.error('❌ [Profile API] Fout bij ophalen profiel:', error);
    console.log(`⏱️ [Profile API] Failed after: ${Date.now() - startTime}ms`);
    return res.status(500).json({
      error: 'Er is een probleem opgetreden bij het ophalen van je profiel',
      code: 'PROFILE_ERROR'
    });
  }
}

// Export de handler met auth middleware
export default withAuth(profileHandler);
