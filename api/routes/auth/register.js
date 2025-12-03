// api/routes/auth/register.js
/**
 * API Route voor klant registratie
 * Endpoint: POST /api/routes/auth/register
 * 
 * Functionaliteit:
 * 1. Gebruiker account aanmaken in Supabase Auth
 * 2. Adres opslaan in adressen tabel
 * 3. User profile aanmaken met rol 'klant'
 */
import { httpClient } from '../../utils/apiClient.js';
import { supabaseConfig } from '../../config/index.js';

export default async function handler(req, res) {
  // CORS headers instellen voor ALLE responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, Authorization');

  // OPTIONS (preflight) request afhandelen
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Correlation ID ophalen voor logging
  const correlationId = req.headers['x-correlation-id'];
  if (correlationId) {
    res.setHeader('X-Correlation-ID', correlationId);
  }

  // Alleen POST requests accepteren
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    const msg = 'Method Not Allowed. Only POST requests are accepted for this endpoint.';
    console.warn(JSON.stringify({ 
      correlationId: correlationId || 'not-provided', 
      level: 'WARN', 
      message: msg, 
      method: req.method, 
      url: req.url 
    }));
    return res.status(405).json({ 
      correlationId: correlationId || 'not-provided', 
      message: msg 
    });
  }

  const logMeta = {
    correlationId: correlationId || 'not-provided',
    endpoint: '/api/routes/auth/register',
    method: 'POST'
  };

  try {
    // Valideer request body
    const {
      voornaam,
      achternaam,
      email,
      password,
      telefoon,
      adres
    } = req.body;

    // Server-side validatie
    const requiredFields = {
      voornaam,
      achternaam,
      email,
      password
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      console.warn(JSON.stringify({
        ...logMeta,
        level: 'WARN',
        message: 'Ontbrekende verplichte velden',
        missingFields
      }));
      return res.status(400).json({
        correlationId: logMeta.correlationId,
        error: 'Ontbrekende verplichte velden',
        code: 'MISSING_FIELDS',
        fields: missingFields
      });
    }

    // Valideer adres velden indien adres is meegegeven
    if (adres) {
      const adresFields = ['postcode', 'huisnummer', 'straatnaam', 'plaats'];
      const missingAdresFields = adresFields.filter(field => !adres[field]);
      
      if (missingAdresFields.length > 0) {
        console.warn(JSON.stringify({
          ...logMeta,
          level: 'WARN',
          message: 'Ontbrekende adres velden',
          missingAdresFields
        }));
        return res.status(400).json({
          correlationId: logMeta.correlationId,
          error: 'Ontbrekende adres velden',
          code: 'MISSING_ADDRESS_FIELDS',
          fields: missingAdresFields
        });
      }
    }

    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Klant registratie gestart',
      email
    }));

    // Stap 1: Gebruiker account aanmaken in Supabase Auth
    const authResponse = await httpClient(`${supabaseConfig.url}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'X-Client-Info': 'heppy-register-api'
      },
      body: JSON.stringify({
        email: email,
        password: password,
        data: {
          voornaam,
          achternaam,
          telefoon: telefoon || null
        }
      })
    });

    const authData = await authResponse.json();

    if (!authResponse.ok) {
      // Check voor specifieke Supabase auth errors
      if (authData.error_description?.includes('already registered') || 
          authData.message?.includes('already exists') ||
          authData.code === '23505') {
        console.warn(JSON.stringify({
          ...logMeta,
          level: 'WARN',
          message: 'Email adres al geregistreerd',
          email
        }));
        return res.status(409).json({
          correlationId: logMeta.correlationId,
          error: 'Er bestaat al een account met dit e-mailadres',
          code: 'EMAIL_EXISTS'
        });
      }

      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Supabase auth error',
        error: authData.error || authData.error_description || 'Unknown auth error',
        statusCode: authResponse.status
      }));
      return res.status(500).json({
        correlationId: logMeta.correlationId,
        error: 'Er is een probleem opgetreden bij het aanmaken van je account',
        code: 'AUTH_ERROR'
      });
    }

    const userId = authData.user?.id;
    if (!userId) {
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Geen user ID ontvangen van Supabase'
      }));
      return res.status(500).json({
        correlationId: logMeta.correlationId,
        error: 'Account aangemaakt, maar er is een probleem opgetreden',
        code: 'USER_ID_MISSING'
      });
    }

    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Account succesvol aangemaakt',
      userId
    }));

    let adresId = null;

    // Stap 2: Adres opslaan indien meegegeven
    if (adres) {
      console.info(JSON.stringify({
        ...logMeta,
        level: 'INFO',
        message: 'Adres opslaan gestart'
      }));

      const adresResponse = await httpClient(`${supabaseConfig.url}/rest/v1/adressen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          postcode: adres.postcode,
          huisnummer: adres.huisnummer,
          toevoeging: adres.toevoeging || null,
          straat: adres.straatnaam,
          plaats: adres.plaats
        })
      });

      if (!adresResponse.ok) {
        const errorData = await adresResponse.json();
        console.error(JSON.stringify({
          ...logMeta,
          level: 'ERROR',
          message: 'Fout bij opslaan adres',
          error: errorData
        }));
        // Continue zonder adres - niet blokkend
      } else {
        const adresData = await adresResponse.json();
        adresId = adresData[0]?.id;
        console.info(JSON.stringify({
          ...logMeta,
          level: 'INFO',
          message: 'Adres succesvol opgeslagen',
          adresId
        }));
      }
    }

    // Stap 3: User profile aanmaken
    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'User profile aanmaken gestart'
    }));

    const profileResponse = await httpClient(`${supabaseConfig.url}/rest/v1/user_profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id: userId,
        voornaam,
        achternaam,
        email,
        telefoon: telefoon || null,
        rol: 'klant',
        adres_id: adresId
      })
    });

    if (!profileResponse.ok) {
      const errorData = await profileResponse.json();
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Fout bij aanmaken user profile',
        error: errorData
      }));
      return res.status(500).json({
        correlationId: logMeta.correlationId,
        error: 'Account aangemaakt, maar profiel kon niet worden opgeslagen',
        code: 'PROFILE_ERROR'
      });
    }

    const profileData = await profileResponse.json();

    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Registratie succesvol afgerond',
      userId,
      adresId
    }));

    return res.status(201).json({
      correlationId: logMeta.correlationId,
      success: true,
      message: 'Account succesvol aangemaakt',
      user: {
        id: userId,
        email,
        voornaam,
        achternaam
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      ...logMeta,
      level: 'ERROR',
      message: 'Onverwachte fout bij registratie',
      error: error.message,
      stack: error.stack
    }));

    return res.status(500).json({
      correlationId: logMeta.correlationId,
      error: 'Er is een onverwachte fout opgetreden',
      code: 'INTERNAL_ERROR'
    });
  }
}
