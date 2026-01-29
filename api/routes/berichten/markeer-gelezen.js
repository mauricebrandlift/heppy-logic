// api/routes/berichten/markeer-gelezen.js
// Markeer berichten als gelezen

import { withAuth } from '../../utils/authMiddleware.js';
import { markeerBerichtenAlsGelezen } from '../../services/berichtenService.js';

export default withAuth(async (req, res, user) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const correlationId = req.headers['x-correlation-id'] || `chat-read-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    const userId = user.id;
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
});
