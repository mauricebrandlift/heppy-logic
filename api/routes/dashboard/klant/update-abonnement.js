// api/routes/dashboard/klant/update-abonnement.js
/**
 * Update abonnement frequentie en uren
 * Alleen eigen abonnementen toegestaan
 * Valideert minimum uren
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { withAuth } from '../../../utils/authMiddleware.js';

async function updateAbonnementHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `update-abonnement-${Date.now()}`;
  const userId = req.user.id;
  const authToken = req.headers.authorization?.split(' ')[1];

  try {
    const { id, frequentie, uren } = req.body;

    // Validatie: verplichte velden
    if (!id) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/update-abonnement',
        action: 'missing_id',
        userId
      }));
      return res.status(400).json({
        correlationId,
        error: 'Abonnement ID is verplicht'
      });
    }

    if (!frequentie) {
      return res.status(400).json({
        correlationId,
        error: 'Frequentie is verplicht'
      });
    }

    if (!uren) {
      return res.status(400).json({
        correlationId,
        error: 'Aantal uren is verplicht'
      });
    }

    // Parse en valideer uren
    const parsedUren = parseFloat(uren);
    if (isNaN(parsedUren) || parsedUren <= 0) {
      return res.status(400).json({
        correlationId,
        error: 'Ongeldig aantal uren'
      });
    }

    // Valideer dat uren in halve uren stappen zijn (0.5)
    if ((parsedUren * 2) % 1 !== 0) {
      return res.status(400).json({
        correlationId,
        error: 'Uren moeten in halve uren stappen zijn (bijv. 3, 3.5, 4)'
      });
    }

    console.log('🔄 [Update Abonnement] Fetching abonnement...', { id, userId });

    // === HAAL ABONNEMENT OP MET OWNERSHIP CHECK ===
    const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${id}&gebruiker_id=eq.${userId}&select=id,minimum_uren,frequentie,uren`;
    
    const abonnementResponse = await httpClient(abonnementUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    });

    if (!abonnementResponse.ok) {
      throw new Error('Kan abonnement niet ophalen');
    }

    const abonnementen = await abonnementResponse.json();

    if (!abonnementen || abonnementen.length === 0) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/update-abonnement',
        action: 'abonnement_not_found',
        id,
        userId
      }));
      return res.status(404).json({
        correlationId,
        error: 'Abonnement niet gevonden'
      });
    }

    const abonnement = abonnementen[0];

    // === VALIDEER MINIMUM UREN ===
    if (abonnement.minimum_uren && parsedUren < abonnement.minimum_uren) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'dashboard/klant/update-abonnement',
        action: 'below_minimum',
        requestedUren: parsedUren,
        minimumUren: abonnement.minimum_uren,
        userId
      }));
      return res.status(400).json({
        correlationId,
        error: 'BELOW_MINIMUM',
        details: `Het aantal uren mag niet lager zijn dan ${abonnement.minimum_uren} uur`
      });
    }

    // === CHECK OF ER DAADWERKELIJK WIJZIGINGEN ZIJN ===
    const hasChanges = 
      abonnement.frequentie !== frequentie || 
      parseFloat(abonnement.uren) !== parsedUren;

    if (!hasChanges) {
      console.log('ℹ️ [Update Abonnement] Geen wijzigingen gedetecteerd');
      return res.status(200).json({
        correlationId,
        message: 'Geen wijzigingen'
      });
    }

    console.log('🔄 [Update Abonnement] Updating...', {
      id,
      frequentie,
      uren: parsedUren,
      previousFrequentie: abonnement.frequentie,
      previousUren: abonnement.uren
    });

    // === UPDATE ABONNEMENT ===
    const updateUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${id}`;
    
    const updateResponse = await httpClient(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        frequentie,
        uren: parsedUren
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Update failed: ${errorText}`);
    }

    console.log('✅ [Update Abonnement] Succesvol bijgewerkt');

    return res.status(200).json({
      correlationId,
      message: 'Abonnement succesvol bijgewerkt',
      data: {
        id,
        frequentie,
        uren: parsedUren
      }
    });

  } catch (error) {
    console.error('❌ [Update Abonnement] Error:', error);
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'dashboard/klant/update-abonnement',
      action: 'error',
      error: error.message,
      userId
    }));

    return res.status(500).json({
      correlationId,
      error: 'Er is een probleem opgetreden bij het bijwerken van het abonnement'
    });
  }
}

// Export met auth middleware - alleen klanten toegestaan
export default withAuth(updateAbonnementHandler, { roles: ['klant'] });
