// api/routes/cleaners-dieptereiniging.js
// Haalt beschikbare schoonmakers op voor dieptereiniging op een specifieke datum

import { handleErrorResponse } from '../utils/errorHandler.js';
import { supabaseConfig } from '../config/index.js';

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
    console.log(`[cleaners-dieptereiniging] 📅 Datum parsing: ${datum} → ${datumDate.toISOString()}`);
    
    if (isNaN(datumDate.getTime())) {
      console.error(`[cleaners-dieptereiniging] ❌ Invalid datum: ${datum}`);
      return res.status(400).json({ 
        error: 'Invalid datum format. Use ISO format: YYYY-MM-DD',
        correlationId 
      });
    }

    // Bepaal weekdag
    const weekdag = getWeekdayName(datum);
    console.log(`[cleaners-dieptereiniging] 📆 Weekdag voor ${datum}: ${weekdag}`);

    // Parse uren (moet integer zijn)
    const urenRequired = Math.max(Math.ceil(parseFloat(minUren)), 1);
    console.log(`[cleaners-dieptereiniging] ⏱️ Uren: ${minUren} → ${urenRequired}`);

    console.log(`[cleaners-dieptereiniging] 🔍 Zoeken naar schoonmakers met parameters:`, {
      plaats_input: plaats.toLowerCase(),
      weekdag_input: weekdag,
      gewenste_uren: urenRequired,
      startTijdFilter: '08:00-10:00'
    });

    // Bereid de aanroep voor naar de Supabase stored procedure
    const payload = {
      plaats_input: plaats.toLowerCase(),
      weekdag_input: weekdag,
      gewenste_uren: urenRequired
    };

    console.log(`[cleaners-dieptereiniging] 🌐 Calling Supabase RPC: get_beschikbare_schoonmakers_dieptereiniging`);

    // Supabase RPC aanroep via fetch (GEEN @supabase/supabase-js package!)
    const rpcUrl = `${supabaseConfig.url}/rest/v1/rpc/get_beschikbare_schoonmakers_dieptereiniging`;
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    // Controleer voor HTTP fouten
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[cleaners-dieptereiniging] ❌ Supabase API error:`, errorText);
      
      const error = new Error('Fout bij ophalen schoonmakers');
      error.status = response.status;
      error.details = errorText;
      throw error;
    }

    // Verwerk het resultaat
    const data = await response.json();
    console.log(`[cleaners-dieptereiniging] ✅ Query succesvol. Gevonden: ${data?.length || 0} schoonmakers`);
    
    if (data && data.length > 0) {
      console.log(`[cleaners-dieptereiniging] 👥 Eerste schoonmaker:`, {
        id: data[0].id,
        naam: `${data[0].voornaam} ${data[0].achternaam}`,
        plaats: data[0].plaats,
        rating: data[0].rating
      });
    } else {
      console.warn(`[cleaners-dieptereiniging] ⚠️ Geen schoonmakers gevonden voor ${plaats} op ${weekdag} (${urenRequired} uur)`);
    }

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
    return handleErrorResponse(res, err, 500, correlationId);
  }
}
