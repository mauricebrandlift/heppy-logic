// api/routes/berichten/verstuur.js
// Verstuur een nieuw bericht

import { withAuth } from '../../utils/authMiddleware.js';
import { verstuurBericht, markeerBerichtenAlsGelezen } from '../../services/berichtenService.js';
import { notificeerNieuwBericht } from '../../services/notificatieService.js';

export default withAuth(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const correlationId = req.headers['x-correlation-id'] || `chat-send-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    const userId = req.user.id;
    const { ontvanger_id, inhoud, match_id, opdracht_id } = req.body;

    // Validatie
    if (!ontvanger_id || !inhoud) {
      return res.status(400).json({ error: 'ontvanger_id en inhoud zijn verplicht' });
    }

    if (inhoud.trim().length === 0) {
      return res.status(400).json({ error: 'Bericht mag niet leeg zijn' });
    }

    if (inhoud.length > 5000) {
      return res.status(400).json({ error: 'Bericht mag max 5000 tekens zijn' });
    }

    // Verstuur bericht
    const bericht = await verstuurBericht({
      verzenderId: userId,
      ontvangerId: ontvanger_id,
      inhoud,
      matchId: match_id,
      opdrachtId: opdracht_id
    }, correlationId);

    // Markeer eventuele berichten van ontvanger als gelezen (je hebt de chat open)
    try {
      await markeerBerichtenAlsGelezen(userId, ontvanger_id, correlationId);
    } catch (markeerError) {
      console.error('⚠️ Markeren als gelezen mislukt (niet-blokkerende fout):', markeerError.message);
    }

    // 🔔 NOTIFICATIE: Nieuw bericht
    try {
      // Gebruik de verzender naam uit het auth user profiel
      const profile = req.user.profile || {};
      const verzenderNaam = [profile.voornaam, profile.achternaam].filter(Boolean).join(' ') || 'Iemand';
      await notificeerNieuwBericht({
        ontvangerId: ontvanger_id,
        verzenderNaam,
        berichtPreview: inhoud.substring(0, 50)
      });
    } catch (notifError) {
      console.error('⚠️ Notificatie failed (niet-blokkerende fout):', notifError.message);
    }

    console.log(`✅ [ChatSend] Bericht verstuurd: ${bericht.id}`);

    return res.status(201).json({
      bericht
    });

  } catch (error) {
    console.error(`❌ [ChatSend] Error [${correlationId}]:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});
