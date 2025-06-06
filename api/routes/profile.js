// api/routes/profile.js
/**
 * Protected profile API route
 * Gives access to user profile data
 */
import { withAuth } from '../utils/authMiddleware.js';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '../config/index.js';

/**
 * Handler voor het ophalen van gebruikersprofiel
 * Vereist authenticatie
 */
async function profileHandler(req, res) {
  try {
    // User is beschikbaar in req.user (ingesteld door authMiddleware)
    const { id: userId, role } = req.user;
    
    // Initialiseer Supabase client
    const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
    
    // Haal uitgebreide profieldata op uit juiste tabel op basis van rol
    let profileData = null;
    
    switch (role) {
      case 'klant':
        const { data: klantData, error: klantError } = await supabase
          .from('klanten')
          .select('*')
          .eq('user_id', userId)
          .single();
          
        if (klantError) throw klantError;
        profileData = klantData;
        break;
        
      case 'schoonmaker':
        const { data: schoonmakerData, error: schoonmakerError } = await supabase
          .from('schoonmakers')
          .select('*')
          .eq('user_id', userId)
          .single();
          
        if (schoonmakerError) throw schoonmakerError;
        profileData = schoonmakerData;
        break;
        
      case 'admin':
        const { data: adminData, error: adminError } = await supabase
          .from('admins')
          .select('*')
          .eq('user_id', userId)
          .single();
          
        if (adminError) throw adminError;
        profileData = adminData;
        break;
        
      default:
        throw new Error(`Onbekende rol: ${role}`);
    }
    
    // Voeg basis gebruikersinformatie toe
    const { data: baseProfile, error: baseProfileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
      
    if (baseProfileError) throw baseProfileError;
    
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
