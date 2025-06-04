// api/services/configService.js
/**
 * Service voor het ophalen en manipuleren van systeemconfiguratie uit de database.
 * Biedt functies voor het ophalen van prijsconfiguratiegegevens en andere systeeminstellingen.
 */
import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

/**
 * Haalt de prijsconfiguratie op uit de Supabase database.
 * 
 * @param {string} [correlationId] - De correlatie ID voor logging en tracing
 * @returns {Promise<Array>} - Array met prijsconfiguratie items
 * @throws {Error} - Bij problemen met de database connectie of query
 */
export async function fetchPricingConfiguration(correlationId = 'not-provided') {
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = supabaseConfig;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuratie ontbreekt.');
  }
  
  const logMeta = {
    correlationId,
    service: 'configService',
    method: 'fetchPricingConfiguration'
  };
  
  console.log(JSON.stringify({
    ...logMeta,
    level: 'INFO',
    message: 'Ophalen prijsconfiguratie gestart'
  }));
  
  try {
    // Gebruik de httpClient utility voor consistente foutafhandeling
    const response = await httpClient(
      `${supabaseUrl}/rest/v1/prijs_configuratie`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        }
      },
      correlationId
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Fout bij ophalen prijsconfiguratie uit database',
        status: response.status,
        error: errorText,
      }));
      throw new Error(`Database error: ${response.status} ${response.statusText}`);
    }
    
    const pricingData = await response.json();
    console.log(JSON.stringify({
      ...logMeta, 
      level: 'INFO',
      message: 'Prijsconfiguratie succesvol opgehaald',
      itemCount: Array.isArray(pricingData) ? pricingData.length : 0
    }));
    
    return pricingData;
  } catch (error) {
    console.error(JSON.stringify({
      ...logMeta,
      level: 'ERROR',
      message: 'Fout bij ophalen prijsconfiguratie',
      error: error.message,
      stack: error.stack
    }));
    throw error;
  }
}

/**
 * Formatteert de ruwe configuratiedata naar een gestructureerd formaat.
 * 
 * @param {Array} configItems - Array met configuratie items uit de database
 * @returns {Object} - Gestructureerd configobject met key/value paren
 */
export function formatPricingConfiguration(configItems) {
  if (!Array.isArray(configItems)) {
    return {};
  }
  
  return configItems.reduce((acc, item) => {
    if (item.config_key && item.config_value !== undefined) {
      // Voor numerieke waarden, converteer naar float
      const isNumeric = !isNaN(parseFloat(item.config_value));
      acc[item.config_key] = isNumeric ? parseFloat(item.config_value) : item.config_value;
    }
    return acc;
  }, {});
}
