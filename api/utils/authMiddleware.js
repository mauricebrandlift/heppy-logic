// api/utils/authMiddleware.js
/**
 * Middleware voor het beschermen van API routes met authenticatie
 */
import { verifyAuth, checkRole } from '../checks/authCheck.js';

/**
 * Wrapper voor het toevoegen van auth checks aan handlers
 * @param {Function} handler - De route handler functie
 * @param {Object} options - Configuratie opties
 * @returns {Function} Middleware-wrapped handler
 */
export function withAuth(handler, options = {}) {
  return async (req, res) => {
    // CORS headers toevoegen
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // OPTIONS requests afhandelen
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    try {
      // Token uit header halen
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authenticatie vereist', code: 'AUTH_REQUIRED' });
      }

      const token = authHeader.split(' ')[1];
      const user = await verifyAuth(token);
      
      // Rolcontrole indien gespecificeerd
      if (options.roles) {
        const heeftToegang = await checkRole(options.roles)(req, res, user);
        if (!heeftToegang) {
          return res.status(403).json({ error: 'Geen toegang tot deze functie', code: 'ACCESS_DENIED' });
        }
      }
      
      // User toevoegen aan request object
      req.user = user;
      
      // Originele handler aanroepen
      return handler(req, res);
    } catch (error) {
      console.error('❌ [Auth Middleware] Fout:', error);
      return res.status(401).json({ error: error.message || 'Authenticatie mislukt', code: 'AUTH_FAILED' });
    }
  };
}
