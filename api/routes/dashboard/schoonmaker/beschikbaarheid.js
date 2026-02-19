// api/routes/dashboard/schoonmaker/beschikbaarheid.js
/**
 * Beschikbaarheid endpoint voor schoonmakers
 * Retourneert alle beschikbaarheid uren per dag voor de schoonmaker
 */
import { withAuth } from '../../../utils/authMiddleware.js';
import { httpClient } from '../../../utils/apiClient.js';
import { supabaseConfig } from '../../../config/index.js';

async function beschikbaarheidHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `schoonmaker-beschikbaarheid-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    console.log(`📅 [Schoonmaker Beschikbaarheid] ========== START ========== [${correlationId}]`);
    console.log(`👤 [Schoonmaker Beschikbaarheid] User ID: ${req.user.id}`);

    const schoonmakerId = req.user.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!authToken) {
      return res.status(401).json({ error: 'Authenticatie vereist' });
    }

    // === HAAL BESCHIKBAARHEID OP ===
    console.log(`🔄 [Schoonmaker Beschikbaarheid] Fetching beschikbaarheid for schoonmaker ${schoonmakerId}...`);
    
    // Haal alle beschikbaarheid uren op, gesorteerd op dag en uur
    const beschikbaarheidUrl = `${supabaseConfig.url}/rest/v1/schoonmaker_beschikbaarheid?schoonmaker_id=eq.${schoonmakerId}&select=dag,uur,status&order=dag.asc,uur.asc`;
    
    const beschikbaarheidResponse = await httpClient(beschikbaarheidUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    }, correlationId);

    if (!beschikbaarheidResponse.ok) {
      const errorText = await beschikbaarheidResponse.text();
      console.error(`❌ [Schoonmaker Beschikbaarheid] Failed to fetch [${correlationId}]`, errorText);
      throw new Error('Kan beschikbaarheid niet ophalen');
    }

    const beschikbaarheidRows = await beschikbaarheidResponse.json();
    console.log(`✅ [Schoonmaker Beschikbaarheid] Found ${beschikbaarheidRows.length} beschikbaarheid rows [${correlationId}]`);

    // === GROEPEER PER DAG ===
    const dagen = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
    const beschikbaarheidPerDag = {};

    dagen.forEach(dag => {
      beschikbaarheidPerDag[dag] = [];
    });

    // Vul beschikbaarheid in
    beschikbaarheidRows.forEach(row => {
      if (beschikbaarheidPerDag[row.dag]) {
        beschikbaarheidPerDag[row.dag].push({
          uur: row.uur,
          status: row.status
        });
      }
    });

    console.log(`✅ [Schoonmaker Beschikbaarheid] Processed beschikbaarheid for ${Object.keys(beschikbaarheidPerDag).length} dagen [${correlationId}]`);

    return res.status(200).json({
      success: true,
      data: beschikbaarheidPerDag
    });

  } catch (error) {
    console.error(`❌ [Schoonmaker Beschikbaarheid] Error [${correlationId}]`, {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van beschikbaarheid'
    });
  }
}

// Exporteer met authenticatie
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Correlation-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Wrap met authenticatie
  return withAuth(beschikbaarheidHandler)(req, res);
}
