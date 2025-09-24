// api/intents/stripePaymentIntent.js
// Encapsuleert het aanmaken van een Stripe PaymentIntent

/**
 * Maakt een PaymentIntent via Stripe API.
 *
 * @param {object} options
 * @param {string} options.secretKey - Stripe Secret Key
 * @param {string} [options.defaultCurrency='eur'] - Fallback valuta
 * @param {object} options.payload - Invoer uit client/route
 * @param {number|string} options.payload.amount - Bedrag in centen
 * @param {string} [options.payload.currency] - Valuta (bv. 'eur')
 * @param {string} [options.payload.description]
 * @param {string} [options.payload.customerEmail]
 * @param {object} [options.payload.metadata]
 * @param {string} [options.payload.idempotencyKey]
 * @param {string} [options.correlationId]
 * @returns {Promise<object>} - Resultaat met id, clientSecret, amount, currency, status, livemode
 */
export async function createPaymentIntent({ secretKey, defaultCurrency = 'eur', payload = {}, correlationId }) {
  if (!secretKey) {
    const err = new Error('Stripe secret key not configured');
    err.code = 500;
    throw err;
  }

  const {
    amount,
    currency,
    description,
    customerEmail,
    metadata,
    idempotencyKey,
  } = payload;

  const amt = Number.parseInt(amount, 10);
  if (!Number.isInteger(amt) || amt <= 0) {
    const err = new Error('Invalid or missing amount (in cents)');
    err.code = 400;
    throw err;
  }

  const chosenCurrency = (currency || defaultCurrency || 'eur').toLowerCase();

  const params = new URLSearchParams();
  params.set('amount', String(amt));
  params.set('currency', chosenCurrency);
  params.set('automatic_payment_methods[enabled]', 'true');

  if (description) params.set('description', String(description));
  if (customerEmail) params.set('receipt_email', String(customerEmail));

  if (metadata && typeof metadata === 'object') {
    for (const [key, value] of Object.entries(metadata)) {
      params.set(`metadata[${key}]`, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }

  const headers = {
    'Authorization': `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey) {
    headers['Idempotency-Key'] = String(idempotencyKey);
  }

  const response = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers,
    body: params.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    const status = response.status || 500;
    const err = new Error(data?.error?.message || 'Stripe error creating PaymentIntent');
    err.code = status;
    throw err;
  }

  return {
    id: data.id,
    clientSecret: data.client_secret,
    amount: data.amount,
    currency: data.currency,
    status: data.status,
    livemode: data.livemode,
  };
}

/**
 * Haalt een PaymentIntent op via Stripe API (voor status/debugging).
 * @param {object} options
 * @param {string} options.secretKey - Stripe Secret Key
 * @param {string} options.id - PaymentIntent ID (bijv. 'pi_...')
 * @param {string} [options.correlationId]
 */
export async function retrievePaymentIntent({ secretKey, id, correlationId }) {
  if (!secretKey) {
    const err = new Error('Stripe secret key not configured');
    err.code = 500;
    throw err;
  }
  if (!id || typeof id !== 'string') {
    const err = new Error('Missing or invalid PaymentIntent id');
    err.code = 400;
    throw err;
  }

  const headers = {
    'Authorization': `Bearer ${secretKey}`,
  };

  const response = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    const status = response.status || 500;
    const err = new Error(data?.error?.message || 'Stripe error retrieving PaymentIntent');
    err.code = status;
    throw err;
  }

  return {
    id: data.id,
    amount: data.amount,
    currency: data.currency,
    status: data.status,
    livemode: data.livemode,
    capture_method: data.capture_method,
    payment_method_types: data.payment_method_types,
    customer: data.customer,
    last_payment_error: data.last_payment_error || null,
    created: data.created,
  };
}
