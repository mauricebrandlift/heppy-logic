// api/routes/dashboard/schoonmaker/beschikbaarheid-update.js
/**
 * Beschikbaarheid update endpoint voor schoonmakers
 * 
 * PUT: Ontvangt een array van { dag, uur, status } en vervangt alle
 * beschikbaarheid records voor de ingelogde schoonmaker.
 * 
 * Strategie: delete all + insert all (upsert via Supabase REST)
 * Dit is veilig omdat het altijd het complete grid betreft (7 dagen × 12 uren).
 */
import { withAuth } from '../../../utils/authMiddleware.js';
import { httpClient } from '../../../utils/apiClient.js';
import { supabaseConfig } from '../../../config/index.js';

// Toegestane statussen (moet overeenkomen met CHECK constraint in schema.sql)
const VALID_STATUSES = ['beschikbaar', 'bezet', 'niet_beschikbaar'];
const VALID_DAGEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];

/**
 * Valideer de beschikbaarheid data
 */
function validateBeschikbaarheid(data) {
  if (!Array.isArray(data)) {
    return 'beschikbaarheid moet een array zijn';
  }

  if (data.length === 0) {
    return 'beschikbaarheid array mag niet leeg zijn';
  }

  for (const item of data) {
    if (!item.dag || !VALID_DAGEN.includes(item.dag)) {
      return `Ongeldige dag: ${item.dag}`;
    }
    if (!item.uur) {
      return 'Uur is verplicht';
    }
    if (!item.status || !VALID_STATUSES.includes(item.status)) {
      return `Ongeldige status: ${item.status}. Toegestaan: ${VALID_STATUSES.join(', ')}`;
    }
  }

  return null; // Geen error
}

async function beschikbaarheidUpdateHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `schoonmaker-beschikbaarheid-update-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  try {
    console.log(`📅 [Beschikbaarheid Update] ========== START ========== [${correlationId}]`);
    console.log(`👤 [Beschikbaarheid Update] User ID: ${req.user.id}`);

    const schoonmakerId = req.user.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!authToken) {
      return res.status(401).json({ success: false, error: 'Authenticatie vereist' });
    }

    // === PARSE & VALIDATE BODY ===
    const { beschikbaarheid } = req.body || {};
    
    const validationError = validateBeschikbaarheid(beschikbaarheid);
    if (validationError) {
      console.warn(`⚠️ [Beschikbaarheid Update] Validatie fout [${correlationId}]: ${validationError}`);
      return res.status(400).json({ success: false, error: validationError });
    }

    console.log(`📊 [Beschikbaarheid Update] ${beschikbaarheid.length} items te verwerken [${correlationId}]`);

    // === STAP 1: DELETE alle bestaande records voor deze schoonmaker ===
    console.log(`🗑️ [Beschikbaarheid Update] Deleting existing records for ${schoonmakerId} [${correlationId}]`);

    const deleteUrl = `${supabaseConfig.url}/rest/v1/schoonmaker_beschikbaarheid?schoonmaker_id=eq.${schoonmakerId}`;
    
    const deleteResponse = await httpClient(deleteUrl, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, correlationId);

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error(`❌ [Beschikbaarheid Update] Delete failed [${correlationId}]:`, errorText);
      throw new Error('Kon oude beschikbaarheid niet verwijderen');
    }

    console.log(`✅ [Beschikbaarheid Update] Old records deleted [${correlationId}]`);

    // === STAP 2: INSERT alle nieuwe records ===
    const insertRows = beschikbaarheid.map(item => ({
      schoonmaker_id: schoonmakerId,
      dag: item.dag,
      uur: item.uur,
      status: item.status
    }));

    console.log(`📥 [Beschikbaarheid Update] Inserting ${insertRows.length} rows [${correlationId}]`);

    const insertUrl = `${supabaseConfig.url}/rest/v1/schoonmaker_beschikbaarheid`;
    
    const insertResponse = await httpClient(insertUrl, {
      method: 'POST',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(insertRows)
    }, correlationId);

    if (!insertResponse.ok) {
      const errorText = await insertResponse.text();
      console.error(`❌ [Beschikbaarheid Update] Insert failed [${correlationId}]:`, errorText);
      throw new Error('Kon beschikbaarheid niet opslaan');
    }

    console.log(`✅ [Beschikbaarheid Update] ${insertRows.length} rows inserted [${correlationId}]`);

    return res.status(200).json({
      success: true,
      message: `Beschikbaarheid bijgewerkt (${insertRows.length} uur blokjes)`
    });

  } catch (error) {
    console.error(`❌ [Beschikbaarheid Update] Error [${correlationId}]`, {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het opslaan van beschikbaarheid'
    });
  }
}

// Exporteer met authenticatie
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Correlation-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Wrap met authenticatie
  return withAuth(beschikbaarheidUpdateHandler)(req, res);
}
