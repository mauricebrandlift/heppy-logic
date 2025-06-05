// api/routes/cleaners.js
/**
 * API endpoint voor het ophalen van beschikbare schoonmakers
 * 
 * Deze route communiceert met de cleanerService om schoonmakers
 * op te halen die beschikbaar zijn op basis van:
 * - plaats (locatie)
 * - uren (minimaal aantal benodigde werkuren)
 * - dagdelen (optioneel, specifieke dagdelen voorkeuren)
 */

import { handleApiError } from '../utils/errorHandler.js';
import { getBeschikbareSchoonmakers } from '../services/cleanerService.js';

/**
 * Handler voor POST /api/routes/cleaners
 * Haalt beschikbare schoonmakers op via de cleanerService
 */
export default async function handler(req, res) {
  // CORS headers voor veiligheid
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Afhandeling van OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Alleen POST toegestaan
  if (req.method !== 'POST') {
    console.warn('⚠️ [cleaners] Onjuiste HTTP methode:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plaats, uren, dagdelen } = req.body;

    // Valideer verplichte parameters
    if (!plaats || uren === undefined || uren === null) {
      return res.status(400).json({ 
        error: 'Ongeldige parameters', 
        details: 'Plaats en uren zijn verplicht' 
      });
    }

    // Zorg voor veilige fallback voor dagdelen
    const veiligeDagdelen = dagdelen && typeof dagdelen === 'object' ? dagdelen : null;

    // Haal correlationId op als de client deze meestuurt (later te implementeren)
    const correlationId = req.headers['x-correlation-id'] || 'not-provided';

    // Roep de cleanerService aan om schoonmakers op te halen
    const schoonmakers = await getBeschikbareSchoonmakers(
      plaats, 
      Number(uren), 
      veiligeDagdelen,
      correlationId
    );

    // Stuur het resultaat terug
    return res.status(200).json(schoonmakers);
  } catch (error) {
    // Gebruik de centrale errorHandler voor consistente error verwerking
    return handleApiError(res, error, 'schoonmakers_fetch_error');
  }
}
