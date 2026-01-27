// api/routes/dashboard/klant/pauze-geschiedenis.js
/**
 * Ophalen van pauze geschiedenis voor een abonnement
 * Alleen eigen abonnementen toegestaan
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { withAuth } from '../../../utils/authMiddleware.js';

async function pauzeGeschiedenisHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `pauze-geschiedenis-${Date.now()}`;
  const userId = req.user.id;
  const authToken = req.headers.authorization?.split(' ')[1];

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://heppy-schoonmaak.webflow.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { abonnement_id } = req.query;

    if (!abonnement_id) {
      return res.status(400).json({
        correlationId,
        error: 'Abonnement ID is verplicht'
      });
    }

    // Check ownership: haal abonnement op (gebruik gebruiker_id zoals opzeg-abonnement)
    let abonnementResponse;
    try {
      abonnementResponse = await httpClient(
        `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${abonnement_id}&gebruiker_id=eq.${userId}&select=id,gebruiker_id`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
    } catch (error) {
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        route: 'dashboard/klant/pauze-geschiedenis',
        action: 'fetch_abonnement_error',
        error: error.message
      }));
      return res.status(500).json({
        correlationId,
        error: 'Fout bij ophalen abonnement'
      });
    }

    if (!abonnementResponse.ok) {
      return res.status(404).json({
        correlationId,
        error: 'Abonnement niet gevonden'
      });
    }

    const abonnementen = await abonnementResponse.json();

    if (!abonnementen || abonnementen.length === 0) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/pauze-geschiedenis',
        action: 'abonnement_not_found',
        abonnementId: abonnement_id,
        userId
      }));
      return res.status(404).json({
        correlationId,
        error: 'Abonnement niet gevonden'
      });
    }

    const abonnement = abonnementen[0];

    // Ownership is al gevalideerd door gebruiker_id in query


    // Haal pauze geschiedenis op (alle pauzes, ook afgelopen)
    // Sorteer op pauze_start_jaar DESC, pauze_start_weeknr DESC
    const pauzesUrl = `${supabaseConfig.url}/rest/v1/abonnement_pauzes?abonnement_id=eq.${abonnement_id}&select=*&order=pauze_start_jaar.desc,pauze_start_weeknr.desc`;
    const pauzesResponse = await httpClient(pauzesUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!pauzesResponse.ok) {
      throw new Error('Fout bij ophalen pauze geschiedenis');
    }

    const pauzes = await pauzesResponse.json();

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/pauze-geschiedenis',
      action: 'pauze_geschiedenis_opgehaald',
      abonnementId: abonnement_id,
      userId,
      aantalPauzes: pauzes?.length || 0
    }));

    return res.status(200).json(pauzes || []);

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'dashboard/klant/pauze-geschiedenis',
      action: 'error',
      error: error.message,
      stack: error.stack
    }));

    return res.status(500).json({
      correlationId,
      error: 'Er is een fout opgetreden bij het ophalen van de pauze geschiedenis'
    });
  }
}

export default withAuth(pauzeGeschiedenisHandler);
