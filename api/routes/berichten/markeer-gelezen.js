// api/routes/berichten/markeer-gelezen.js
// Markeer berichten als gelezen

import { authMiddleware } from '../../utils/authMiddleware.js';
import { markeerBerichtenAlsGelezen } from '../../services/berichtenService.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Correlation-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const correlationId = req.headers['x-correlation-id'] || `chat-read-${Date.now()}`;
  
  // Echo correlation ID
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    // Auth check
    const authResult = await authMiddleware(req);
    if (!authResult.authenticated) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = authResult.user.id;
    const { andere_persoon_id } = req.body;

    if (!andere_persoon_id) {
      return res.status(400).json({ error: 'andere_persoon_id is verplicht' });
    }

    // Markeer berichten als gelezen
    await markeerBerichtenAlsGelezen(userId, andere_persoon_id, correlationId);

    console.log(`✅ [ChatMarkRead] Berichten gemarkeerd als gelezen`);

    return res.status(200).json({
      success: true
    });

  } catch (error) {
    console.error(`❌ [ChatMarkRead] Error [${correlationId}]:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
