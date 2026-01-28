// api/routes/berichten/chat.js
// Haal berichten op tussen twee gebruikers

import { authMiddleware } from '../../utils/authMiddleware.js';
import { getChatBerichten } from '../../services/berichtenService.js';

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

  const correlationId = req.headers['x-correlation-id'] || `chat-get-${Date.now()}`;
  
  // Echo correlation ID
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    // Auth check
    const authResult = await authMiddleware(req);
    if (!authResult.authenticated) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = authResult.user.id;
    const { andere_persoon_id } = req.query;

    if (!andere_persoon_id) {
      return res.status(400).json({ error: 'andere_persoon_id is verplicht' });
    }

    // Haal berichten op
    const berichten = await getChatBerichten(userId, andere_persoon_id, correlationId);

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
}
