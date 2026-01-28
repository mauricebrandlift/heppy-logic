// api/routes/berichten/stats.js
// Haal chat statistieken op voor dashboard overview

import { authMiddleware } from '../../utils/authMiddleware.js';
import { getGekoppeldeGebruikers, telOngelezenBerichten } from '../../services/berichtenService.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Correlation-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const correlationId = req.headers['x-correlation-id'] || `chat-stats-${Date.now()}`;
  
  // Echo correlation ID
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    // Auth check
    const authResult = await authMiddleware(req);
    if (!authResult.authenticated) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = authResult.user.id;

    // Haal statistieken op
    const [gekoppeldeGebruikers, ongelezenCount] = await Promise.all([
      getGekoppeldeGebruikers(userId, correlationId),
      telOngelezenBerichten(userId, correlationId)
    ]);

    const aantalGekoppeld = gekoppeldeGebruikers.length;

    console.log(`✅ [ChatStats] Stats opgehaald: ${aantalGekoppeld} gekoppeld, ${ongelezenCount} ongelezen`);

    return res.status(200).json({
      aantalGekoppeld,
      ongelezenCount
    });

  } catch (error) {
    console.error(`❌ [ChatStats] Error [${correlationId}]:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
