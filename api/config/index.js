// api/config/index.js
/**
 * Laadt en valideert omgevingsvariabelen.
 * Stelt configuratie beschikbaar voor de backend.
 */

const { POSTCODE_API_URL, POSTCODE_API_KEY } = process.env;

if (!POSTCODE_API_URL) {
  console.warn('⚠️ [API Config] POSTCODE_API_URL is niet ingesteld in environment variabelen.');
}

if (!POSTCODE_API_KEY) {
  console.warn('⚠️ [API Config] POSTCODE_API_KEY is niet ingesteld in environment variabelen.');
}

export const postcodeApiConfig = {
  baseUrl: POSTCODE_API_URL,
  apiKey: POSTCODE_API_KEY,
};

// Voeg hier andere configuraties toe indien nodig
// export const anotherConfig = { ... };

// Log dat de configuratie geladen is (optioneel, kan veel output geven)
// console.log('✅ [API Config] Configuratie geladen.');
