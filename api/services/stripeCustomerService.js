/**
 * Stripe Customer Service
 * 
 * Beheert Stripe Customers voor recurring payments en facturen.
 * Een Stripe Customer linkt een Heppy user aan Stripe's betalingssysteem.
 * 
 * Functies:
 * - createOrGetCustomer() - Maak nieuwe customer of haal bestaande op
 * - getCustomerById() - Haal customer op uit Stripe
 * - updateCustomer() - Update customer gegevens
 * - attachPaymentMethod() - Koppel payment method aan customer
 */

import { stripeConfig, supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

/**
 * Maak een nieuwe Stripe Customer aan of haal bestaande op
 * 
 * @param {Object} params
 * @param {string} params.userId - Heppy user_profiles.id (UUID)
 * @param {string} params.email - Email adres
 * @param {string} params.name - Volledige naam (voornaam + achternaam)
 * @param {string} [params.phone] - Telefoonnummer (optioneel)
 * @param {Object} [params.address] - Adres object (optioneel)
 * @param {string} correlationId - Correlation ID voor logging
 * @returns {Promise<{id: string, created: boolean}>} Stripe Customer ID + of deze nieuw is
 */
export async function createOrGetCustomer({ userId, email, name, phone, address }, correlationId) {
  console.log(`👤 [StripeCustomerService] createOrGetCustomer voor user ${userId} [${correlationId}]`);
  
  if (!userId || !email || !name) {
    throw new Error('userId, email en name zijn verplicht voor Stripe Customer');
  }

  // 1. Check of deze user al een stripe_customer_id heeft
  const existingCustomerId = await getStripeCustomerIdFromDatabase(userId, correlationId);
  
  if (existingCustomerId) {
    console.log(`✅ [StripeCustomerService] Bestaande customer gevonden: ${existingCustomerId} [${correlationId}]`);
    
    // Verifieer dat customer nog bestaat in Stripe
    try {
      await getCustomerById(existingCustomerId, correlationId);
      return { id: existingCustomerId, created: false };
    } catch (error) {
      // Customer bestaat niet meer in Stripe - maak nieuwe aan
      console.warn(`⚠️ [StripeCustomerService] Customer ${existingCustomerId} bestaat niet meer in Stripe, maak nieuwe aan [${correlationId}]`);
    }
  }

  // 2. Maak nieuwe Stripe Customer aan
  console.log(`🆕 [StripeCustomerService] Nieuwe customer aanmaken voor ${email} [${correlationId}]`);
  
  const params = new URLSearchParams();
  params.set('email', email);
  params.set('name', name);
  
  if (phone) {
    params.set('phone', phone);
  }
  
  // Metadata: link terug naar Heppy user
  params.set('metadata[heppy_user_id]', userId);
  params.set('metadata[source]', 'heppy_platform');
  
  // Adres (optioneel - voor facturen)
  if (address) {
    if (address.straat) params.set('address[line1]', address.straat);
    if (address.huisnummer) {
      const line2 = address.toevoeging 
        ? `${address.huisnummer} ${address.toevoeging}` 
        : address.huisnummer;
      params.set('address[line2]', line2);
    }
    if (address.postcode) params.set('address[postal_code]', address.postcode);
    if (address.plaats) params.set('address[city]', address.plaats);
    params.set('address[country]', 'NL'); // Nederland
  }

  const response = await fetch('https://api.stripe.com/v1/customers', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeConfig.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data?.error?.message || 'Stripe Customer aanmaken mislukt');
    err.code = response.status || 500;
    console.error(`❌ [StripeCustomerService] Fout bij aanmaken customer [${correlationId}]:`, err.message);
    throw err;
  }

  const customerId = data.id;
  console.log(`✅ [StripeCustomerService] Customer aangemaakt: ${customerId} [${correlationId}]`);

  // 3. Sla customer_id op in database
  await saveStripeCustomerIdToDatabase(userId, customerId, correlationId);

  return { id: customerId, created: true };
}

/**
 * Haal Stripe Customer op via ID
 * 
 * @param {string} customerId - Stripe Customer ID (cus_...)
 * @param {string} correlationId
 * @returns {Promise<Object>} Stripe Customer object
 */
export async function getCustomerById(customerId, correlationId) {
  console.log(`🔍 [StripeCustomerService] Ophalen customer ${customerId} [${correlationId}]`);

  const response = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${stripeConfig.secretKey}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data?.error?.message || 'Stripe Customer ophalen mislukt');
    err.code = response.status || 500;
    throw err;
  }

  return data;
}

/**
 * Update Stripe Customer gegevens
 * 
 * @param {string} customerId - Stripe Customer ID
 * @param {Object} updates - Velden om te updaten (email, name, phone, address, etc)
 * @param {string} correlationId
 * @returns {Promise<Object>} Ge-update customer object
 */
export async function updateCustomer(customerId, updates, correlationId) {
  console.log(`✏️ [StripeCustomerService] Update customer ${customerId} [${correlationId}]`);

  const params = new URLSearchParams();
  
  if (updates.email) params.set('email', updates.email);
  if (updates.name) params.set('name', updates.name);
  if (updates.phone) params.set('phone', updates.phone);

  const response = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeConfig.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data?.error?.message || 'Stripe Customer update mislukt');
    err.code = response.status || 500;
    throw err;
  }

  return data;
}

/**
 * Koppel een Payment Method aan een Customer (en stel in als default)
 * 
 * @param {string} customerId - Stripe Customer ID
 * @param {string} paymentMethodId - Stripe Payment Method ID (pm_...)
 * @param {string} correlationId
 * @returns {Promise<Object>} Payment Method object
 */
export async function attachPaymentMethod(customerId, paymentMethodId, correlationId) {
  console.log(`🔗 [StripeCustomerService] Koppel payment method ${paymentMethodId} aan customer ${customerId} [${correlationId}]`);

  // 1. Attach payment method aan customer
  const attachParams = new URLSearchParams();
  attachParams.set('customer', customerId);

  const attachResponse = await fetch(`https://api.stripe.com/v1/payment_methods/${encodeURIComponent(paymentMethodId)}/attach`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeConfig.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: attachParams.toString(),
  });

  const attachData = await attachResponse.json();

  if (!attachResponse.ok) {
    const err = new Error(attachData?.error?.message || 'Payment Method attach mislukt');
    err.code = attachResponse.status || 500;
    throw err;
  }

  // 2. Stel in als default payment method voor customer
  const updateParams = new URLSearchParams();
  updateParams.set('invoice_settings[default_payment_method]', paymentMethodId);

  const updateResponse = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeConfig.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: updateParams.toString(),
  });

  const updateData = await updateResponse.json();

  if (!updateResponse.ok) {
    console.warn(`⚠️ [StripeCustomerService] Default payment method instellen mislukt (niet kritiek) [${correlationId}]`);
  } else {
    console.log(`✅ [StripeCustomerService] Payment method ingesteld als default [${correlationId}]`);
  }

  return attachData;
}

// ============================================
// Database Helper Functions
// ============================================

/**
 * Haal stripe_customer_id op uit database
 * @private
 */
async function getStripeCustomerIdFromDatabase(userId, correlationId) {
  const url = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${userId}&select=stripe_customer_id`;
  
  const response = await httpClient(url, {
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
    },
  }, correlationId);

  if (!response.ok) {
    throw new Error(`Database query mislukt: ${await response.text()}`);
  }

  const data = await response.json();
  return data[0]?.stripe_customer_id || null;
}

/**
 * Sla stripe_customer_id op in database
 * @private
 */
async function saveStripeCustomerIdToDatabase(userId, customerId, correlationId) {
  const url = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${userId}`;
  
  const response = await httpClient(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ stripe_customer_id: customerId }),
  }, correlationId);

  if (!response.ok) {
    throw new Error(`Database update mislukt: ${await response.text()}`);
  }

  console.log(`✅ [StripeCustomerService] stripe_customer_id opgeslagen in database [${correlationId}]`);
}
