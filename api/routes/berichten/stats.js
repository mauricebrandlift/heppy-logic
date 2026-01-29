// api/routes/berichten/stats.js
// Haal chat statistieken op voor dashboard overview

import { withAuth } from '../../utils/authMiddleware.js';
import { getGekoppeldeGebruikers, telOngelezenBerichten } from '../../services/berichtenService.js';

export default withAuth(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const correlationId = req.headers['x-correlation-id'] || `chat-stats-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    const userId = req.user.id;

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
});
