// public/config/apiConfig.js
/**
 * Configuration for the frontend API client.
 */
export const API_CONFIG = {
  // Gebruik de daadwerkelijke URL van je Vercel backend deployment
  BASE_URL: 'https://heppy-frontend-code.vercel.app/api',
  // API endpoints
  ENDPOINTS: {
    ADDRESS: '/routes/address',
    COVERAGE: '/routes/coverage',
    PRICING: '/routes/pricing',
    CLEANERS: '/routes/cleaners',
    PROFILE: '/routes/profile',
    CONFIG: {
      PUBLIC: '/routes/config/public',
    },
    STRIPE: {
      PUBLIC_CONFIG: '/routes/stripe/public-config',
      CREATE_PAYMENT_INTENT: '/routes/stripe/create-payment-intent',
      RETRIEVE_PAYMENT_INTENT: '/routes/stripe/retrieve-payment-intent',
    },
    AUTH: {
      LOGIN: '/auth/login',
      LOGOUT: '/auth/logout',
      ME: '/auth/me',
      CHECK_EMAIL: '/routes/auth/check-email',
    },
  },
  // Je kunt hier later andere API-gerelateerde configuraties toevoegen,
  // zoals timeouts, retry-instellingen, etc.
};
