// api/routes/notificaties/dismiss.js
/**
 * Verwijder (soft delete) notificatie
 * Body: { notificatie_id: uuid }
 */
import { withAuth } from '../../utils/authMiddleware.js';
import { verwijderNotificatie } from '../../services/notificatieService.js';

async function dismissNotificatieHandler(req, res) {
  const startTime = Date.now();
  const userId = req.user.id;

  try {
    console.log('🗑️ [Notificaties Dismiss] Start', { userId });

    // Valideer body
    const { notificatie_id } = req.body;

    if (!notificatie_id) {
      return res.status(400).json({
        error: 'notificatie_id is verplicht',
        code: 'MISSING_NOTIFICATIE_ID'
      });
    }

    // Verwijder notificatie (soft delete + ownership check)
    await verwijderNotificatie(notificatie_id, userId);

    console.log(`✅ [Notificaties Dismiss] Succesvol - ${notificatie_id}`);
    console.log(`⏱️ [Notificaties Dismiss] Duration: ${Date.now() - startTime}ms`);

    return res.status(200).json({
      success: true
    });

  } catch (error) {
    console.error('❌ [Notificaties Dismiss] Error:', error);
    console.log(`⏱️ [Notificaties Dismiss] Failed after: ${Date.now() - startTime}ms`);
    
    return res.status(500).json({
      error: 'Er is een probleem opgetreden bij het verwijderen van de notificatie',
      code: 'NOTIFICATIES_DISMISS_ERROR'
    });
  }
}

// Export met auth middleware - alle rollen toegestaan
export default withAuth(dismissNotificatieHandler, { roles: ['klant', 'schoonmaker', 'admin'] });
