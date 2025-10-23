/**
 * AuthService
 * Beheert Supabase Auth users via Admin API
 * Gebruikt Service Role Key voor admin rechten
 */

import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

/**
 * Maakt een nieuwe Supabase Auth user aan via Admin API
 * 
 * @param {Object} params
 * @param {string} params.email - Email adres van de user
 * @param {string} params.password - Wachtwoord (plaintext - wordt gehashed door Supabase)
 * @param {Object} [params.user_metadata] - Extra metadata (voornaam, achternaam, etc.)
 * @param {string} [correlationId] - Voor logging/tracing
 * @returns {Promise<Object>} De aangemaakte auth user met ID
 */
export async function createAuthUser({ email, password, user_metadata = {} }, correlationId = '') {
  console.log(`🔐 [AuthService] Creating auth user [${correlationId}]`, {
    email,
    hasPassword: !!password,
    metadata: user_metadata
  });

  // Validatie
  if (!email) {
    throw new Error('Email is verplicht voor auth user');
  }
  
  if (!password) {
    throw new Error('Password is verplicht voor auth user');
  }

  // Service Role Key uit env
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error(`❌ [AuthService] SUPABASE_SERVICE_ROLE_KEY niet gevonden in environment [${correlationId}]`);
    throw new Error('Service Role Key niet geconfigureerd');
  }

  const url = `${supabaseConfig.url}/auth/v1/admin/users`;
  
  const body = {
    email: email.toLowerCase().trim(),
    password,
    email_confirm: true, // Auto-confirm email (geen verificatie email)
    user_metadata: {
      ...user_metadata,
      created_via: 'webhook_payment',
      created_at: new Date().toISOString()
    }
  };

  console.log(`📤 [AuthService] POST ${url} [${correlationId}]`);
  
  const resp = await httpClient(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`
    },
    body: JSON.stringify(body)
  }, correlationId);

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`❌ [AuthService] Create failed [${correlationId}]`, {
      status: resp.status,
      error: errorText,
      email
    });
    
    // Check for duplicate email error
    if (errorText.includes('already registered') || errorText.includes('duplicate')) {
      throw new Error(`Email ${email} is already registered`);
    }
    
    throw new Error(`Auth user creation failed: ${errorText}`);
  }

  const authUser = await resp.json();
  console.log(`✅ [AuthService] Auth user created: ${authUser.id} [${correlationId}]`);
  
  return {
    id: authUser.id,
    email: authUser.email,
    created_at: authUser.created_at
  };
}

/**
 * Checkt of een auth user bestaat op basis van email
 * 
 * @param {string} email - Email adres om te checken
 * @param {string} [correlationId] - Voor logging/tracing
 * @returns {Promise<Object|null>} Auth user object of null
 */
export async function findAuthUserByEmail(email, correlationId = '') {
  console.log(`🔍 [AuthService] Finding auth user by email: ${email} [${correlationId}]`);

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Service Role Key niet geconfigureerd');
  }

  // Admin API om users op te halen
  // Note: dit is niet ideaal maar nodig voor email lookup
  const url = `${supabaseConfig.url}/auth/v1/admin/users`;
  
  const resp = await httpClient(url, {
    method: 'GET',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`
    }
  }, correlationId);

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`❌ [AuthService] List users failed [${correlationId}]`, errorText);
    throw new Error(`Failed to list auth users: ${errorText}`);
  }

  const data = await resp.json();
  const users = data.users || [];
  
  const normalizedEmail = email.toLowerCase().trim();
  const user = users.find(u => u.email?.toLowerCase() === normalizedEmail);
  
  if (user) {
    console.log(`✅ [AuthService] Auth user found: ${user.id} [${correlationId}]`);
    return {
      id: user.id,
      email: user.email,
      created_at: user.created_at
    };
  }
  
  console.log(`ℹ️ [AuthService] No auth user found for email: ${email} [${correlationId}]`);
  return null;
}
