import { supabaseConfig } from '../config/index.js';
// import fetch from 'node-fetch'; // Alleen nodig voor Node < 18, Vercel gebruikt doorgaans nieuwere Node.

/**
 * Controleert de dekking voor een gegeven plaats via de Supabase API.
 *
 * @param {string} plaats De naam van de plaats.
 * @param {string} correlationId De correlation ID voor logging en tracing.
 * @returns {Promise<{gedekt: boolean}>} Een object dat aangeeft of de plaats gedekt is.
 * @throws {Error} Gooit een error als de API call faalt, configuratie mist, of plaats leeg is.
 */
export async function getCoverageStatus(plaats, correlationId) {
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = supabaseConfig;
  const logMeta = {
    correlationId,
    service: 'coverageLookupService.getCoverageStatus',
    plaats,
  };

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(JSON.stringify({
      ...logMeta,
      level: 'ERROR',
      message: 'Supabase URL of Anon Key ontbreekt in de configuratie.',
    }));
    const err = new Error('Server configuratiefout: Supabase details missen.');
    err.code = 500; // Internal Server Error
    throw err;
  }

  if (!plaats || typeof plaats !== 'string' || plaats.trim() === '') {
    console.warn(JSON.stringify({ ...logMeta, level: 'WARN', message: 'Plaats is verplicht en moet een non-lege string zijn.' }));
    const err = new Error('Plaats is verplicht.');
    err.code = 400; // Bad Request
    throw err;
  }

  // Pas tabelnaam 'plaatsen_dekking' en kolomnaam 'plaats' aan indien nodig.
  const params = new URLSearchParams({ plaats: `eq.${plaats.trim()}`, select: 'plaats' }); // Selecteer alleen een veld om data te minimaliseren
  const apiUrl = `${supabaseUrl}/rest/v1/plaatsen_dekking?${params.toString()}`;

  console.log(JSON.stringify({ ...logMeta, level: 'INFO', message: `Supabase API call naar: ${apiUrl}` }));

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: `Supabase API fout: ${response.status} ${response.statusText}`,
        apiResponse: errorText,
      }));
      const err = new Error(`Fout bij Supabase API: ${response.statusText}`);
      err.code = response.status;
      err.externalResponse = errorText;
      throw err;
    }

    const data = await response.json();

    // Als data een array is en tenminste één item bevat, is de plaats gedekt.
    const isGedekt = Array.isArray(data) && data.length > 0;

    console.log(JSON.stringify({ ...logMeta, level: 'INFO', message: `Dekking voor '${plaats}' gecontroleerd. Gedekt: ${isGedekt}.`/*, apiResponse: data*/ })); // PII niet standaard loggen
    return { gedekt: isGedekt };

  } catch (error) {
    if (!error.code) { // Vang generieke fetch errors (netwerk etc.)
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Onverwachte fout tijdens ophalen dekkingsstatus.',
        error: error.message,
        stack: error.stack, // Overweeg stack alleen in dev
      }));
      error.code = 500;
      error.message = error.message || 'Interne serverfout bij ophalen dekkingsstatus.';
    }
    throw error;
  }
}
