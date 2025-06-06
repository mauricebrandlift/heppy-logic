// api/routes/profile.js
/**
 * Protected profile API route
 * Gives access to user profile data
 */
import { withAuth } from '../utils/authMiddleware.js';
import { httpClient } from '../utils/apiClient.js';
import { supabaseConfig } from '../config/index.js';

/**
 * Handler voor het ophalen van gebruikersprofiel
 * Vereist authenticatie
 */
async function profileHandler(req, res) {
  try {
    // User is beschikbaar in req.user (ingesteld door authMiddleware)
    const { id: userId, role } = req.user;
    const authToken = req.headers.authorization?.split(' ')[1];
    
    if (!authToken) {
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
        return res.status(400).json({ error: 'Ongeldige gebruikersrol' });
    }
    
    // Directe API call naar Supabase REST API voor het ophalen van profieldata
    const profileResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/${tableName}?uuid=eq.${userId}&select=*`, 
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!profileResponse.ok) {
      throw new Error(`Kan ${role} profiel niet ophalen`);
    }
    
    const profiles = await profileResponse.json();
    
    if (!profiles || profiles.length === 0) {
      throw new Error(`Geen ${role} profiel gevonden`);
    }
    
    profileData = profiles[0];
    
    // Haal basis gebruikersinformatie op
    const baseProfileResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/user_profiles?uuid=eq.${userId}&select=*`, 
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!baseProfileResponse.ok) {
      throw new Error('Kan basis profiel niet ophalen');
    }
    
    const baseProfiles = await baseProfileResponse.json();
    
    if (!baseProfiles || baseProfiles.length === 0) {
      throw new Error('Geen basis profiel gevonden');
    }
    
    const baseProfile = baseProfiles[0];
    
    // Combineer profielen
    const combinedProfile = {
      ...baseProfile,
      ...profileData,
      role // Zorg dat de rol altijd beschikbaar is
    };
    
    // Retourneer profiel
    return res.status(200).json({ 
      success: true,
      profile: combinedProfile
    });
    
  } catch (error) {
    console.error('❌ [Profile API] Fout bij ophalen profiel:', error);
    return res.status(500).json({
      error: 'Er is een probleem opgetreden bij het ophalen van je profiel',
      code: 'PROFILE_ERROR'
    });
  }
}

// Export de handler met auth middleware
export default withAuth(profileHandler);
