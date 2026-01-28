// api/routes/notificaties/list.js
/**
 * Haal notificaties op voor ingelogde gebruiker
 * Query params:
 * - limit: max aantal (default 20)
 * - alleen_actie: boolean (alleen voor admin, default false)
 */
import { withAuth } from '../../utils/authMiddleware.js';
import { getNotificaties } from '../../services/notificatieService.js';

async function listNotificatiesHandler(req, res) {
  const startTime = Date.now();
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    console.log('🔔 [Notificaties List] Start', { userId, userRole });

    // Parse query params
    const limit = parseInt(req.query.limit) || 20;
    const alleenActieVereist = req.query.alleen_actie === 'true' && userRole === 'admin';

    // Haal notificaties op
    const notificaties = await getNotificaties(userId, {
      alleenActieVereist,
      limit
    });

    console.log(`✅ [Notificaties List] Succesvol - ${notificaties.length} notificaties`);
    console.log(`⏱️ [Notificaties List] Duration: ${Date.now() - startTime}ms`);

    return res.status(200).json({
      notificaties
    });

  } catch (error) {
    console.error('❌ [Notificaties List] Error:', error);
    console.log(`⏱️ [Notificaties List] Failed after: ${Date.now() - startTime}ms`);
    
    return res.status(500).json({
      error: 'Er is een probleem opgetreden bij het ophalen van notificaties',
      code: 'NOTIFICATIES_LIST_ERROR'
    });
  }
}

// Export met auth middleware - alle rollen toegestaan
export default withAuth(listNotificatiesHandler, { roles: ['klant', 'schoonmaker', 'admin'] });
