// api/routes/dashboard/klant/overview.js
/**
 * Dashboard overview endpoint voor klanten
 * Retourneert alle relevante data voor de overview pagina:
 * - User info (naam)
 * - Abonnementen (alle statussen)
 * - Eenmalige opdrachten (dieptereiniging, etc.)
 * - Bestellingen (webshop)
 */
import { withAuth } from '../../../utils/authMiddleware.js';
import { httpClient } from '../../../utils/apiClient.js';
import { supabaseConfig } from '../../../config/index.js';

async function overviewHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `overview-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  const requestId = `overview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    console.log('📊 [Dashboard Overview] ========== START ==========');
    console.log(`📋 [Dashboard Overview] Request ID: ${requestId}`);
    console.log(`👤 [Dashboard Overview] User ID: ${req.user.id}`);

    const userId = req.user.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!authToken) {
      return res.status(401).json({ error: 'Authenticatie vereist' });
    }

    // === USER INFO ===
    console.log('🔄 [Dashboard Overview] Fetching user profile...');
    const userUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${userId}&select=voornaam,achternaam,email`;
    const userResponse = await httpClient(userUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    });

    if (!userResponse.ok) {
      throw new Error('Kan gebruikersprofiel niet ophalen');
    }

    const users = await userResponse.json();
    const user = users[0] || {};

    // === ABONNEMENTEN ===
    console.log('🔄 [Dashboard Overview] Fetching abonnementen...');
    const abonnementenUrl = `${supabaseConfig.url}/rest/v1/abonnementen?gebruiker_id=eq.${userId}&select=id,uren,status,frequentie,startdatum,schoonmaker:schoonmakers(id)&order=aangemaakt_op.desc`;
    const abonnementenResponse = await httpClient(abonnementenUrl, {
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${authToken}`,
      }
    });

    if (!abonnementenResponse.ok) {
      throw new Error('Kan abonnementen niet ophalen');
    }

    const abonnementen = await abonnementenResponse.json();

    // === EENMALIGE OPDRACHTEN === (COMMENTED OUT - TESTEN LATER)
    // console.log('🔄 [Dashboard Overview] Fetching eenmalige opdrachten...');
    // const eenmaligeTypes = ['dieptereiniging', 'verhuis', 'tapijt', 'bankreiniging', 'vloer'];
    // const opdrachtUrl = `${supabaseConfig.url}/rest/v1/opdrachten?gebruiker_id=eq.${userId}&type=in.(${eenmaligeTypes.join(',')})&select=id,type,status,gewenste_datum,totaalbedrag,gegevens&order=aangemaakt_op.desc&limit=10`;
    // const opdrachtResponse = await httpClient(opdrachtUrl, {
    //   headers: {
    //     'apikey': supabaseConfig.anonKey,
    //     'Authorization': `Bearer ${authToken}`,
    //   }
    // });
    // if (!opdrachtResponse.ok) {
    //   throw new Error('Kan opdrachten niet ophalen');
    // }
    // const opdrachten = await opdrachtResponse.json();

    // === BESTELLINGEN === (COMMENTED OUT - TESTEN LATER)
    // console.log('🔄 [Dashboard Overview] Fetching bestellingen...');
    // const bestellingenUrl = `${supabaseConfig.url}/rest/v1/bestellingen?klant_id=eq.${userId}&select=id,bestel_nummer,totaal_cents,status,aangemaakt_op&order=aangemaakt_op.desc&limit=10`;
    // const bestellingenResponse = await httpClient(bestellingenUrl, {
    //   headers: {
    //     'apikey': supabaseConfig.anonKey,
    //     'Authorization': `Bearer ${authToken}`,
    //   }
    // });
    // if (!bestellingenResponse.ok) {
    //   throw new Error('Kan bestellingen niet ophalen');
    // }
    // const bestellingen = await bestellingenResponse.json();

    // === RESPONSE SAMENSTELLEN ===
    const responseData = {
      user: {
        voornaam: user.voornaam || '',
        achternaam: user.achternaam || '',
        email: user.email || '',
      },
      abonnementen: abonnementen.map(abo => ({
        id: abo.id,
        uren: abo.uren,
        frequentie: abo.frequentie,
        status: abo.status,
        startdatum: abo.startdatum,
        heeft_schoonmaker: !!abo.schoonmaker?.id
      })),
      // COMMENTED OUT - TESTEN LATER
      // eenmalige_opdrachten: opdrachten.map(opr => ({
      //   id: opr.id,
      //   type: opr.type,
      //   status: opr.status,
      //   gewenste_datum: opr.gewenste_datum,
      //   totaalbedrag: opr.totaalbedrag,
      //   gegevens: opr.gegevens
      // })),
      // bestellingen: bestellingen.map(best => ({
      //   id: best.id,
      //   bestel_nummer: best.bestel_nummer,
      //   totaal_cents: best.totaal_cents,
      //   status: best.status,
      //   aangemaakt_op: best.aangemaakt_op
      // }))
    };

    console.log(`✅ [Dashboard Overview] Succesvol - ${abonnementen.length} abonnementen`);
    console.log(`⏱️ [Dashboard Overview] Duration: ${Date.now() - startTime}ms`);

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ [Dashboard Overview] Error:', error);
    console.log(`⏱️ [Dashboard Overview] Failed after: ${Date.now() - startTime}ms`);
    return res.status(500).json({
      error: 'Er is een probleem opgetreden bij het ophalen van je dashboard gegevens',
      code: 'OVERVIEW_ERROR'
    });
  }
}

// Export met auth middleware
export default withAuth(overviewHandler, { roles: ['klant'] });
