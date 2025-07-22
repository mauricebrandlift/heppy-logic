// api/routes/sollicitatie.js
/**
 * API Route voor het afhandelen van sollicitaties.
 * Endpoint: POST /api/routes/sollicitatie
 * 
 * Functionaliteit:
 * 1. Gebruiker account aanmaken in Supabase Auth
 * 2. Sollicitatie opslaan in sollicitaties tabel
 * 3. User profile aanmaken met rol 'sollicitant'
 */
import { httpClient } from '../utils/apiClient.js';
import { supabaseConfig } from '../config/index.js';
import { handleErrorResponse } from '../utils/errorHandler.js';

export default async function handler(req, res) {
  // CORS headers instellen voor ALLE responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, Authorization');

  // OPTIONS (preflight) request afhandelen
  if (req.method === 'OPTIONS') {
    res.status(204).end();
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
    endpoint: '/api/routes/sollicitatie',
    method: 'POST'
  };

  try {
    // Valideer request body
    const {
      geslacht,
      geboortedatum,
      voornaam,
      achternaam,
      woonplaats,
      telefoon,
      ervaringmotivatie,
      emailadres,
      wachtwoord,
      akkoordVoorwaarden
    } = req.body;

    // Server-side validatie
    const requiredFields = {
      geslacht,
      geboortedatum,
      voornaam,
      achternaam,
      woonplaats,
      telefoon,
      ervaringmotivatie,
      emailadres,
      wachtwoord,
      akkoordVoorwaarden
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

    // Controleer akkoord met voorwaarden
    if (!akkoordVoorwaarden) {
      console.warn(JSON.stringify({
        ...logMeta,
        level: 'WARN',
        message: 'Voorwaarden niet geaccepteerd'
      }));
      return res.status(400).json({
        correlationId: logMeta.correlationId,
        error: 'Je moet akkoord gaan met de voorwaarden',
        code: 'TERMS_NOT_ACCEPTED'
      });
    }

    // Valideer leeftijd (minimaal 18 jaar)
    const birthDate = new Date(geboortedatum);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      console.warn(JSON.stringify({
        ...logMeta,
        level: 'WARN',
        message: 'Sollicitant te jong',
        age
      }));
      return res.status(400).json({
        correlationId: logMeta.correlationId,
        error: 'Je moet minimaal 18 jaar oud zijn om te solliciteren',
        code: 'INVALID_AGE'
      });
    }

    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Sollicitatie verwerking gestart',
      email: emailadres
    }));

    // Stap 1: Gebruiker account aanmaken in Supabase Auth
    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Account aanmaken gestart',
      supabaseUrl: supabaseConfig.url ? 'SET' : 'NOT_SET',
      supabaseAnonKey: supabaseConfig.anonKey ? 'SET' : 'NOT_SET'
    }));

    const authResponse = await httpClient(`${supabaseConfig.url}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'X-Client-Info': 'heppy-sollicitatie-api'
      },
      body: JSON.stringify({
        email: emailadres,
        password: wachtwoord,
        data: {
          voornaam,
          achternaam,
          geslacht,
          woonplaats,
          telefoon
        }
      })
    });

    const authData = await authResponse.json();

    if (!authResponse.ok) {
      // Check voor specifieke Supabase auth errors
      if (authData.error_description?.includes('already registered')) {
        console.warn(JSON.stringify({
          ...logMeta,
          level: 'WARN',
          message: 'Email adres al geregistreerd',
          email: emailadres
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
        authData: authData,
        statusCode: authResponse.status,
        statusText: authResponse.statusText
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

    // Stap 2: Sollicitatie opslaan in database
    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Sollicitatie opslaan gestart'
    }));

    const sollicitatieData = {
      gebruiker_id: userId,
      geslacht,
      geboortedatum,
      voornaam,
      achternaam,
      woonplaats,
      telefoon,
      ervaringmotivatie: ervaringmotivatie,
      emailadres,
      status: 'nieuw',
      akkoord_voorwaarden: akkoordVoorwaarden
    };

    const sollicitatieResponse = await httpClient(`${supabaseConfig.url}/rest/v1/sollicitaties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(sollicitatieData)
    });

    if (!sollicitatieResponse.ok) {
      const errorText = await sollicitatieResponse.text();
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Database error bij opslaan sollicitatie',
        error: errorText,
        userId
      }));

      // Check voor duplicate sollicitatie
      if (errorText.includes('duplicate') || sollicitatieResponse.status === 409) {
        return res.status(409).json({
          correlationId: logMeta.correlationId,
          error: 'Je hebt al eerder gesolliciteerd',
          code: 'DUPLICATE_APPLICATION'
        });
      }

      return res.status(500).json({
        correlationId: logMeta.correlationId,
        error: 'Er is een probleem opgetreden bij het opslaan van je sollicitatie',
        code: 'DATABASE_ERROR'
      });
    }

    const sollicitatieResult = await sollicitatieResponse.json();

    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Sollicitatie succesvol opgeslagen',
      sollicitatieId: sollicitatieResult[0]?.id,
      userId
    }));

    // Stap 3: User profile aanmaken
    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'User profile aanmaken gestart'
    }));

    const profileData = {
      id: userId,
      email: emailadres,
      voornaam,
      achternaam,
      rol: 'sollicitant',
      geslacht,
      woonplaats,
      telefoon
    };

    const profileResponse = await httpClient(`${supabaseConfig.url}/rest/v1/user_profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(profileData)
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Database error bij aanmaken user profile',
        error: errorText,
        userId
      }));
      // Profile fout is niet kritiek - sollicitatie is al opgeslagen
    } else {
      console.info(JSON.stringify({
        ...logMeta,
        level: 'INFO',
        message: 'User profile succesvol aangemaakt',
        userId
      }));
    }

    // Succes response
    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Sollicitatie volledig verwerkt',
      userId,
      sollicitatieId: sollicitatieResult[0]?.id
    }));

    return res.status(201).json({
      correlationId: logMeta.correlationId,
      message: 'Je sollicitatie is succesvol verstuurd! We nemen zo snel mogelijk contact met je op.',
      code: 'SOLLICITATIE_SUCCESS',
      data: {
        sollicitatieId: sollicitatieResult[0]?.id,
        status: 'nieuw'
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      ...logMeta,
      level: 'ERROR',
      message: 'Onverwachte fout tijdens sollicitatie verwerking',
      error: error.message,
      stack: error.stack
    }));

    return res.status(500).json({
      correlationId: logMeta.correlationId,
      error: 'Er is een onverwachte fout opgetreden. Probeer het later opnieuw.',
      code: 'INTERNAL_ERROR'
    });
  }
}
