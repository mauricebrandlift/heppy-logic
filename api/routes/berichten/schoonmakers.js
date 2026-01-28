// api/routes/berichten/schoonmakers.js
// Haal lijst van gekoppelde schoonmakers/klanten op voor chat overzicht

import { authMiddleware } from '../../utils/authMiddleware.js';
import { getGekoppeldeGebruikers } from '../../services/berichtenService.js';

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

  const correlationId = req.headers['x-correlation-id'] || `chat-schoonmakers-${Date.now()}`;
  
  // Echo correlation ID
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    // Auth check
    const authResult = await authMiddleware(req);
    if (!authResult.authenticated) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = authResult.user.id;

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
}
