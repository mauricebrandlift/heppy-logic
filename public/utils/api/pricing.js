// public/utils/api/pricing.js
/**
 * Client-side API functies voor het ophalen van prijsconfiguratie.
 */
import { apiClient } from './client.js';
import { API_CONFIG } from '../../config/apiConfig.js';

/**
 * Haalt de prijsconfiguratie op van de backend API.
 * Deze functie wordt gebruikt voor het berekenen van schoonmaakkosten en prijzen.
 * 
 * @returns {Promise<Object>} Een object met de prijsconfiguratie items
 * @throws {ApiError} Als er een fout optreedt bij het ophalen van de data
 */
export async function fetchPricingConfiguration() {
  const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PRICING}`;
  
  try {
    console.log('[api/pricing] Ophalen prijsconfiguratie...');
    const response = await apiClient.get(url);
    
    if (response && response.pricing) {
      console.log('[api/pricing] Prijsconfiguratie succesvol opgehaald:', response);
      return response;
    } else {
      console.error('[api/pricing] Prijsconfiguratie response ongeldig:', response);
      throw new Error('Prijsconfiguratie response heeft een onverwacht formaat');
    }
  } catch (error) {
    console.error('[api/pricing] Fout bij ophalen prijsconfiguratie:', error);
    throw error;
  }
}