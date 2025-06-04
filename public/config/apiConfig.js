// public/config/apiConfig.js
/**
 * Configuration for the frontend API client.
 */
export const API_CONFIG = {
  // Gebruik de daadwerkelijke URL van je Vercel backend deployment
  BASE_URL: 'https://heppy-frontend-code.vercel.app/api',
  // API endpoints
  ENDPOINTS: {
    ADDRESS: '/address',
    COVERAGE: '/coverage',
    PRICING: '/pricing',
  },
  // Je kunt hier later andere API-gerelateerde configuraties toevoegen,
  // zoals timeouts, retry-instellingen, etc.
};
