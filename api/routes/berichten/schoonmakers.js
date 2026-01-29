// api/routes/berichten/schoonmakers.js
// Haal lijst van gekoppelde schoonmakers/klanten op voor chat overzicht

import { withAuth } from '../../utils/authMiddleware.js';
import { getGekoppeldeGebruikers } from '../../services/berichtenService.js';

export default withAuth(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const correlationId = req.headers['x-correlation-id'] || `chat-schoonmakers-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    const userId = req.user.id;

    // Haal gekoppelde gebruikers op
    const gekoppeldeGebruikers = await getGekoppeldeGebruikers(userId, correlationId);

    console.log(`✅ [ChatSchoonmakers] ${gekoppeldeGebruikers.length} gebruikers opgehaald`);

    return res.status(200).json({
      gebruikers: gekoppeldeGebruikers
    });

  } catch (error) {
    console.error(`❌ [ChatSchoonmakers] Error [${correlationId}]:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});
