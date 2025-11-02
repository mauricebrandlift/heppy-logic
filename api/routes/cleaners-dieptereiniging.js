// api/routes/cleaners-dieptereiniging.js
// Haalt beschikbare schoonmakers op voor dieptereiniging op een specifieke datum

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Bepaal de weekdag naam uit een ISO datum string (2025-11-11)
 */
function getWeekdayName(dateString) {
  const date = new Date(dateString);
  const days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  return days[date.getDay()];
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Echo correlation ID
  const correlationId = req.headers['x-correlation-id'] || `server-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      correlationId 
    });
  }

  try {
    const { plaats, datum, minUren } = req.query;

    console.log(`[cleaners-dieptereiniging] Request:`, { plaats, datum, minUren, correlationId });

    // Validatie
    if (!plaats) {
      return res.status(400).json({ 
        error: 'Missing required parameter: plaats',
        correlationId 
      });
    }

    if (!datum) {
      return res.status(400).json({ 
        error: 'Missing required parameter: datum',
        correlationId 
      });
    }

    if (!minUren) {
      return res.status(400).json({ 
        error: 'Missing required parameter: minUren',
        correlationId 
      });
    }

    // Parse en valideer datum
    const datumDate = new Date(datum);
    if (isNaN(datumDate.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid datum format. Use ISO format: YYYY-MM-DD',
        correlationId 
      });
    }

    // Bepaal weekdag
    const weekdag = getWeekdayName(datum);
    console.log(`[cleaners-dieptereiniging] Weekdag voor ${datum}: ${weekdag}`);

    // Parse uren (moet integer zijn)
    const urenRequired = Math.max(Math.ceil(parseFloat(minUren)), 1);

    console.log(`[cleaners-dieptereiniging] Zoeken naar schoonmakers:`, {
      plaats: plaats.toLowerCase(),
      weekdag,
      minUren: urenRequired,
      startTijd: '08:00-10:00'
    });

    // RPC call naar database functie
    const { data, error } = await supabase.rpc('get_beschikbare_schoonmakers_dieptereiniging', {
      plaats_input: plaats.toLowerCase(),
      weekdag_input: weekdag,
      gewenste_uren: urenRequired
    });

    if (error) {
      console.error('[cleaners-dieptereiniging] Database error:', error);
      return res.status(500).json({ 
        error: 'Database query failed',
        details: error.message,
        correlationId 
      });
    }

    console.log(`[cleaners-dieptereiniging] Gevonden: ${data?.length || 0} schoonmakers`);

    return res.status(200).json({
      correlationId,
      plaats,
      datum,
      weekdag,
      minUren: urenRequired,
      cleaners: data || []
    });

  } catch (err) {
    console.error('[cleaners-dieptereiniging] Unexpected error:', err);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: err.message,
      correlationId 
    });
  }
}
