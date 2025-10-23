// userService: find/create users + user_profiles (idempotent by email)
import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';
import { createAuthUser, findAuthUserByEmail } from './authService.js';

async function selectUserByEmail(email, correlationId){
  const url = `${supabaseConfig.url}/rest/v1/user_profiles?emailadres=eq.${encodeURIComponent(email)}&select=id`;
  const resp = await httpClient(url, { headers:{ 'apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}` } }, correlationId);
  if(!resp.ok) throw new Error(`user_profiles select failed: ${await resp.text()}`);
  return resp.json();
}

async function insertUserProfile({ id, email, voornaam, achternaam, telefoon, rol }, correlationId){
  const url = `${supabaseConfig.url}/rest/v1/user_profiles`;
  const body = { 
    id, // Gebruik auth user ID!
    emailadres: email||null, 
    voornaam: voornaam||null, 
    achternaam: achternaam||null, 
    telefoonnummer: telefoon||null, 
    role: rol||'klant' 
  };
  const resp = await httpClient(url, { 
    method:'POST', 
    headers:{ 
      'Content-Type':'application/json',
      'apikey':supabaseConfig.anonKey,
      'Authorization':`Bearer ${supabaseConfig.anonKey}`,
      'Prefer':'return=minimal' 
    }, 
    body: JSON.stringify(body) 
  }, correlationId);
  if(!resp.ok) throw new Error(`user_profiles insert failed: ${await resp.text()}`);
  return { id };
}

export const userService = {
  async findOrCreateByEmail(meta, correlationId){
    console.log(`👤 [UserService] findOrCreateByEmail: ${meta.email} [${correlationId}]`);
    
    if(!meta.email) throw new Error('email required for user creation');
    
    // Stap 1: Check of user_profile al bestaat
    const existing = await selectUserByEmail(meta.email, correlationId);
    if(existing.length){
      console.log(`✅ [UserService] Existing user_profile found: ${existing[0].id} [${correlationId}]`);
      return { id: existing[0].id, created:false };
    }
    
    // Stap 2: Voor nieuwe user, check eerst of auth user bestaat
    console.log(`🔍 [UserService] No user_profile, checking auth user... [${correlationId}]`);
    let authUser = await findAuthUserByEmail(meta.email, correlationId);
    
    // Stap 3: Maak auth user aan als die niet bestaat (alleen voor guest users met wachtwoord)
    if (!authUser && meta.wachtwoord) {
      console.log(`🔐 [UserService] Creating new auth user... [${correlationId}]`);
      authUser = await createAuthUser({
        email: meta.email,
        password: meta.wachtwoord,
        user_metadata: {
          voornaam: meta.voornaam,
          achternaam: meta.achternaam,
          telefoon: meta.telefoon
        }
      }, correlationId);
    }
    
    if (!authUser) {
      throw new Error('Could not create or find auth user (geen wachtwoord aanwezig in metadata)');
    }
    
    // Stap 4: Maak user_profile met dezelfde ID als auth user
    console.log(`📝 [UserService] Creating user_profile with auth user ID: ${authUser.id} [${correlationId}]`);
    await insertUserProfile({ 
      id: authUser.id, // BELANGRIJK: gebruik auth user ID!
      email: meta.email, 
      voornaam: meta.voornaam, 
      achternaam: meta.achternaam, 
      telefoon: meta.telefoon, 
      rol:'klant' 
    }, correlationId);
    
    console.log(`✅ [UserService] User created: ${authUser.id} [${correlationId}]`);
    return { id: authUser.id, created:true };
  }
};
