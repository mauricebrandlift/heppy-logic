// api/config/index.js
/**
 * Laadt en valideert omgevingsvariabelen.
 * Stelt configuratie beschikbaar voor de backend.
 */

// Haal environment variabelen op
const {
  POSTCODE_API_URL,
  POSTCODE_API_KEY,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  STRIPE_PUBLIC_KEY,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  CURRENCY = 'EUR',
  COUNTRY = 'NL',
} = process.env;

// Valideer of de environment variabelen aanwezig zijn (optioneel, maar aanbevolen)
if (!POSTCODE_API_URL) {
  console.warn('⚠️ [API Config] POSTCODE_API_URL is niet ingesteld in environment variabelen.');
}

if (!POSTCODE_API_KEY) {
  console.warn('⚠️ [API Config] POSTCODE_API_KEY is niet ingesteld in environment variabelen.');
}

if (!SUPABASE_URL) {
  console.warn('⚠️ [API Config] SUPABASE_URL is niet ingesteld in environment variabelen.');
}

if (!SUPABASE_ANON_KEY) {
  console.warn('⚠️ [API Config] SUPABASE_ANON_KEY is niet ingesteld in environment variabelen.');
}

// Stripe vars (waarschuwingen, geen hard fail)
if (!STRIPE_PUBLIC_KEY) {
  console.warn('⚠️ [API Config] STRIPE_PUBLIC_KEY (publishable) ontbreekt. Frontend kan Stripe niet initialiseren.');
}
if (!STRIPE_SECRET_KEY) {
  console.warn('⚠️ [API Config] STRIPE_SECRET_KEY ontbreekt. Server kan geen PaymentIntents maken.');
}
if (!STRIPE_WEBHOOK_SECRET) {
  console.warn('⚠️ [API Config] STRIPE_WEBHOOK_SECRET ontbreekt. Webhook verificatie uitgeschakeld.');
}

// Exporteer de configuratie objecten
export const postcodeApiConfig = {
  baseUrl: POSTCODE_API_URL,
  apiKey: POSTCODE_API_KEY,
};

export const supabaseConfig = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
};

// Voeg hier andere configuraties toe indien nodig
// bijv. export const mailgunConfig = { apiKey: process.env.MAILGUN_API_KEY, domain: process.env.MAILGUN_DOMAIN };

export const stripeConfig = {
  publicKey: STRIPE_PUBLIC_KEY,
  secretKey: STRIPE_SECRET_KEY,
  webhookSecret: STRIPE_WEBHOOK_SECRET,
  currency: CURRENCY,
  country: COUNTRY,
};
