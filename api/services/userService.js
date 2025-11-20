// userService: find/create users + user_profiles (idempotent by email)
import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';
import { createAuthUser, findAuthUserByEmail } from './authService.js';

async function selectUserByEmail(email, correlationId){
  const url = `${supabaseConfig.url}/rest/v1/user_profiles?email=eq.${encodeURIComponent(email)}&select=id`;
  const resp = await httpClient(url, { headers:{ 'apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}` } }, correlationId);
  if(!resp.ok) throw new Error(`user_profiles select failed: ${await resp.text()}`);
  return resp.json();
}

async function insertUserProfile({ id, email, voornaam, achternaam, telefoon, rol }, correlationId){
  const url = `${supabaseConfig.url}/rest/v1/user_profiles`;
  const body = { 
    id, // Gebruik auth user ID!
    email: email||null, 
    voornaam: voornaam||null, 
    achternaam: achternaam||null, 
    telefoon: telefoon||null, 
    rol: rol||'klant' 
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

async function patchUserProfile(userId, updates, correlationId){
  const url = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${userId}`;
  const resp = await httpClient(url, { 
    method:'PATCH', 
    headers:{ 
      'Content-Type':'application/json',
      'apikey':supabaseConfig.anonKey,
      'Authorization':`Bearer ${supabaseConfig.anonKey}`,
      'Prefer':'return=minimal' 
    }, 
    body: JSON.stringify(updates) 
  }, correlationId);
  if(!resp.ok) throw new Error(`user_profiles patch failed: ${await resp.text()}`);
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
  },

  async updateAdresId(userId, adresId, correlationId){
    console.log(`📍 [UserService] Updating adres_id for user ${userId}: ${adresId} [${correlationId}]`);
    await patchUserProfile(userId, { adres_id: adresId }, correlationId);
    console.log(`✅ [UserService] adres_id updated [${correlationId}]`);
  },

  async updateStripeCustomerId(userId, stripeCustomerId, correlationId){
    console.log(`💳 [UserService] Updating stripe_customer_id for user ${userId}: ${stripeCustomerId} [${correlationId}]`);
    await patchUserProfile(userId, { stripe_customer_id: stripeCustomerId }, correlationId);
    console.log(`✅ [UserService] stripe_customer_id updated [${correlationId}]`);
  },

  async getStripeCustomerId(userId, correlationId){
    const url = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${userId}&select=stripe_customer_id`;
    const resp = await httpClient(url, { headers:{ 'apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}` } }, correlationId);
    if(!resp.ok) throw new Error(`user_profiles select failed: ${await resp.text()}`);
    const data = await resp.json();
    return data[0]?.stripe_customer_id || null;
  }
};
