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

    // Check ownership: haal abonnement op
    const abonnementResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${abonnement_id}&select=klant_id`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.key,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!abonnementResponse || abonnementResponse.length === 0) {
      return res.status(404).json({
        correlationId,
        error: 'Abonnement niet gevonden'
      });
    }

    const abonnement = abonnementResponse[0];

    // Check ownership
    if (abonnement.klant_id !== userId) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/pauze-geschiedenis',
        action: 'unauthorized_access',
        abonnementId: abonnement_id,
        userId,
        klantId: abonnement.klant_id
      }));
      return res.status(403).json({
        correlationId,
        error: 'Je mag alleen je eigen abonnementen bekijken'
      });
    }

    // Haal pauze geschiedenis op (alle pauzes, ook afgelopen)
    const pauzesResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/abonnement_pauzes?abonnement_id=eq.${abonnement_id}&select=*&order=startdatum.desc`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.key,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'dashboard/klant/pauze-geschiedenis',
      action: 'pauze_geschiedenis_opgehaald',
      abonnementId: abonnement_id,
      userId,
      aantalPauzes: pauzesResponse?.length || 0
    }));

    return res.status(200).json(pauzesResponse || []);

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
