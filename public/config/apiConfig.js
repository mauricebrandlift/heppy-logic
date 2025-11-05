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
