// api/routes/berichten/chat.js
// Haal berichten op tussen twee gebruikers

import { withAuth } from '../../utils/authMiddleware.js';
import { getChatBerichten } from '../../services/berichtenService.js';

export default withAuth(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const correlationId = req.headers['x-correlation-id'] || `chat-get-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    const userId = req.user.id;
    const { andere_persoon_id, na_bericht_id } = req.query;

    if (!andere_persoon_id) {
      return res.status(400).json({ error: 'andere_persoon_id is verplicht' });
    }

    // Haal berichten op (optioneel alleen nieuwe na bepaald bericht ID)
    const berichten = await getChatBerichten(userId, andere_persoon_id, na_bericht_id, correlationId);

    console.log(`✅ [ChatGet] ${berichten.length} berichten opgehaald`);

    return res.status(200).json({
      berichten
    });

  } catch (error) {
    console.error(`❌ [ChatGet] Error [${correlationId}]:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});
