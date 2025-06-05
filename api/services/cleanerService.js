// api/services/cleanerService.js
/**
 * Service voor het ophalen van beschikbare schoonmakers via Supabase
 */
import { supabaseConfig } from '../config/index.js';

/**
 * Haalt beschikbare schoonmakers op via de Supabase stored procedure
 * 
 * @param {string} plaats - De plaats waar de schoonmaak moet plaatsvinden
 * @param {number} uren - Aantal gewenste schoonmaakuren
 * @param {Object|null} dagdelen - Optionele dagdeel voorkeuren
 * @param {string} [correlationId] - Optionele correlatie ID voor logging
 * @returns {Promise<Array>} - Een array met beschikbare schoonmakers
 * @throws {Error} - Bij fouten in de Supabase aanroep
 */
export async function getBeschikbareSchoonmakers(plaats, uren, dagdelen = null, correlationId = 'not-provided') {
  const logPrefix = `[cleanerService] [${correlationId}]`;
  
  console.log(`${logPrefix} Zoeken naar schoonmakers:`, {
    plaats,
    uren: Number(uren),
    dagdelen: dagdelen || 'geen voorkeur'
  });

  // Bereid de aanroep voor naar de Supabase stored procedure
  const payload = {
    plaats_input: plaats,
    gewenste_uren: Number(uren),
    dagdelen_input: dagdelen
  };

  // Supabase RPC aanroep via fetch
  const rpcUrl = `${supabaseConfig.url}/rest/v1/rpc/get_beschikbare_schoonmakers_base`;
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'apikey': supabaseConfig.anonKey,
      'Authorization': `Bearer ${supabaseConfig.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  // Controleer voor HTTP fouten
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${logPrefix} Supabase API error:`, errorText);
    
    // Maak error object met extra metadata
    const error = new Error('Fout bij ophalen schoonmakers');
    error.status = response.status;
    error.details = errorText;
    throw error;
  }

  // Verwerk het resultaat
  const schoonmakers = await response.json();
  console.log(`${logPrefix} ${schoonmakers.length} schoonmakers gevonden`);
  
  return schoonmakers;
}
