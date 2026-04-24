// api/routes/dashboard/admin/klanten.js
/**
 * Admin dashboard - klanten overview endpoint
 *
 * Haalt alle klanten (user_profiles met rol='klant') op inclusief:
 *  - adres (straat, huisnummer, toevoeging, postcode, plaats)
 *  - abonnementen (id, status, frequentie, uren)
 *  - opdrachten / eenmalige schoonmaakopdrachten (id, status, type, totaalbedrag, gewenste_datum)
 *
 * Filter, sort en pagination gebeurt in de frontend in-memory.
 * We gebruiken de service role key omdat admin al geverifieerd is door withAuth.
 */
import { withAuth } from '../../../utils/authMiddleware.js';
import { httpClient } from '../../../utils/apiClient.js';
import { supabaseConfig } from '../../../config/index.js';

const LOG_PREFIX = '[Admin Klanten Overview]';

async function adminKlantenHandler(req, res) {
  const correlationId = req.headers['x-correlation-id'] || `admin-klanten-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  const startTime = Date.now();
  const adminId = req.user?.id;

  console.log(`${LOG_PREFIX} ========== START ==========`);
  console.log(`${LOG_PREFIX} correlationId=${correlationId} adminId=${adminId}`);

  if (!supabaseConfig.serviceRoleKey) {
    console.error(`${LOG_PREFIX} ❌ SUPABASE_SERVICE_ROLE_KEY ontbreekt`);
    return res.status(500).json({
      error: 'Server configuratie fout',
      code: 'CONFIG_MISSING_SERVICE_KEY',
    });
  }

  try {
    // ------------------------------------------------------------
    // 1. Klanten ophalen (user_profiles met rol='klant')
    //    Met embedded adres via foreign key user_profiles_adres_id_fkey
    // ------------------------------------------------------------
    const selectKlanten = [
      'id',
      'voornaam',
      'achternaam',
      'email',
      'telefoon',
      'aangemaakt_op',
      // Embedded adres
      'adres:adressen!user_profiles_adres_id_fkey(id,straat,huisnummer,toevoeging,postcode,plaats)',
    ].join(',');

    const klantenUrl =
      `${supabaseConfig.url}/rest/v1/user_profiles` +
      `?rol=eq.klant` +
      `&select=${encodeURIComponent(selectKlanten)}` +
      `&order=aangemaakt_op.desc`;

    console.log(`${LOG_PREFIX} 🔄 Fetching klanten…`);
    const klantenResp = await httpClient(
      klantenUrl,
      {
        headers: {
          apikey: supabaseConfig.serviceRoleKey,
          Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
          Accept: 'application/json',
        },
      },
      correlationId
    );

    if (!klantenResp.ok) {
      const txt = await klantenResp.text();
      console.error(`${LOG_PREFIX} ❌ Klanten fetch failed ${klantenResp.status}: ${txt}`);
      throw new Error(`Supabase klanten query faalde: ${klantenResp.status}`);
    }

    const klanten = await klantenResp.json();
    console.log(`${LOG_PREFIX} ✅ ${klanten.length} klanten geladen`);

    if (klanten.length === 0) {
      console.log(`${LOG_PREFIX} ⏱️ duration=${Date.now() - startTime}ms`);
      return res.status(200).json({ success: true, data: [] });
    }

    const klantIds = klanten.map((k) => k.id);

    // ------------------------------------------------------------
    // 2. Abonnementen ophalen per klant (batch via in.(...))
    // ------------------------------------------------------------
    const abonnementenUrl =
      `${supabaseConfig.url}/rest/v1/abonnementen` +
      `?gebruiker_id=in.(${klantIds.join(',')})` +
      `&select=id,gebruiker_id,status,frequentie,uren,startdatum,aangemaakt_op` +
      `&order=aangemaakt_op.desc`;

    console.log(`${LOG_PREFIX} 🔄 Fetching abonnementen…`);
    const abosResp = await httpClient(
      abonnementenUrl,
      {
        headers: {
          apikey: supabaseConfig.serviceRoleKey,
          Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
          Accept: 'application/json',
        },
      },
      correlationId
    );

    if (!abosResp.ok) {
      const txt = await abosResp.text();
      console.error(`${LOG_PREFIX} ❌ Abonnementen fetch failed ${abosResp.status}: ${txt}`);
      throw new Error(`Supabase abonnementen query faalde: ${abosResp.status}`);
    }

    const abonnementen = await abosResp.json();
    console.log(`${LOG_PREFIX} ✅ ${abonnementen.length} abonnementen geladen`);

    // ------------------------------------------------------------
    // 3. Eenmalige opdrachten ophalen per klant
    // ------------------------------------------------------------
    const opdrachtenUrl =
      `${supabaseConfig.url}/rest/v1/opdrachten` +
      `?gebruiker_id=in.(${klantIds.join(',')})` +
      `&select=id,gebruiker_id,status,type,gegevens,totaalbedrag,gewenste_datum,aangemaakt_op` +
      `&order=aangemaakt_op.desc`;

    console.log(`${LOG_PREFIX} 🔄 Fetching opdrachten…`);
    const opdrResp = await httpClient(
      opdrachtenUrl,
      {
        headers: {
          apikey: supabaseConfig.serviceRoleKey,
          Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
          Accept: 'application/json',
        },
      },
      correlationId
    );

    if (!opdrResp.ok) {
      const txt = await opdrResp.text();
      console.error(`${LOG_PREFIX} ❌ Opdrachten fetch failed ${opdrResp.status}: ${txt}`);
      throw new Error(`Supabase opdrachten query faalde: ${opdrResp.status}`);
    }

    const opdrachten = await opdrResp.json();
    console.log(`${LOG_PREFIX} ✅ ${opdrachten.length} opdrachten geladen`);

    // ------------------------------------------------------------
    // 4. Groeperen per klant
    // ------------------------------------------------------------
    const abosByKlant = new Map();
    for (const a of abonnementen) {
      const list = abosByKlant.get(a.gebruiker_id) || [];
      list.push({
        id: a.id,
        status: a.status,
        frequentie: a.frequentie,
        uren: a.uren,
        startdatum: a.startdatum,
        aangemaakt_op: a.aangemaakt_op,
      });
      abosByKlant.set(a.gebruiker_id, list);
    }

    const opdrByKlant = new Map();
    for (const o of opdrachten) {
      const list = opdrByKlant.get(o.gebruiker_id) || [];
      // `uren` kan in `gegevens` jsonb staan; veilig uitpakken
      let uren = null;
      if (o.gegevens && typeof o.gegevens === 'object' && 'uren' in o.gegevens) {
        uren = o.gegevens.uren;
      }
      list.push({
        id: o.id,
        status: o.status,
        type: o.type,
        uren,
        totaalbedrag: o.totaalbedrag,
        gewenste_datum: o.gewenste_datum,
        aangemaakt_op: o.aangemaakt_op,
      });
      opdrByKlant.set(o.gebruiker_id, list);
    }

    // ------------------------------------------------------------
    // 5. Response samenstellen
    // ------------------------------------------------------------
    const data = klanten.map((k) => ({
      id: k.id,
      voornaam: k.voornaam || '',
      achternaam: k.achternaam || '',
      email: k.email || '',
      telefoon: k.telefoon || '',
      aangemaakt_op: k.aangemaakt_op,
      adres: k.adres
        ? {
            straat: k.adres.straat || '',
            huisnummer: k.adres.huisnummer || '',
            toevoeging: k.adres.toevoeging || '',
            postcode: k.adres.postcode || '',
            plaats: k.adres.plaats || '',
          }
        : null,
      abonnementen: abosByKlant.get(k.id) || [],
      opdrachten: opdrByKlant.get(k.id) || [],
    }));

    console.log(
      `${LOG_PREFIX} ✅ Response samengesteld klanten=${data.length} duration=${Date.now() - startTime}ms`
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Error:`, error);
    console.log(`${LOG_PREFIX} ⏱️ failed after ${Date.now() - startTime}ms`);
    return res.status(500).json({
      error: 'Kon klanten niet ophalen',
      code: 'ADMIN_KLANTEN_FETCH_FAILED',
      message: error.message,
    });
  }
}

export default withAuth(adminKlantenHandler, { roles: ['admin'] });
