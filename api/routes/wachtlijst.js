// api/routes/wachtlijst.js
// Endpoint: POST /api/routes/wachtlijst
// Slaat een wachtlijst-aanvraag op in de Supabase tabel 'wachtlijst_aanvragen'.

import { httpClient } from '../utils/apiClient.js';
import { supabaseConfig } from '../config/index.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const correlationId = req.headers['x-correlation-id'];
  if (correlationId) {
    res.setHeader('X-Correlation-ID', correlationId);
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    const message = 'Method Not Allowed. Only POST requests are accepted for this endpoint.';
    console.warn(JSON.stringify({
      correlationId: correlationId || 'not-provided',
      level: 'WARN',
      message,
      method: req.method,
      url: req.url,
    }));
    return res.status(405).json({
      correlationId: correlationId || 'not-provided',
      message,
    });
  }

  const { naam, email, emailadres, plaats, straat } = req.body || {};
  const transformed = {
    naam: typeof naam === 'string' ? naam.trim() : '',
    email: typeof email === 'string' ? email.trim() : (typeof emailadres === 'string' ? emailadres.trim() : ''),
    plaats: typeof plaats === 'string' ? plaats.trim() : '',
    straat: typeof straat === 'string' ? straat.trim() : '',
  };

  const requiredMissing = Object.entries(transformed)
    .filter(([key, value]) => key !== 'straat' ? !value : !value)
    .map(([key]) => key);

  const logMeta = {
    correlationId: correlationId || 'not-provided',
    endpoint: '/api/routes/wachtlijst',
    method: 'POST',
    payloadPreview: {
      naam: transformed.naam,
      email: transformed.email,
      plaats: transformed.plaats,
      straat: transformed.straat ? '[provided]' : '',
    },
  };

  if (requiredMissing.length > 0) {
    console.warn(JSON.stringify({
      ...logMeta,
      level: 'WARN',
      message: 'Ontbrekende verplichte velden voor wachtlijst-aanvraag',
      missingFields: requiredMissing,
    }));
    return res.status(400).json({
      correlationId: logMeta.correlationId,
      message: 'Niet alle verplichte velden zijn ingevuld.',
      code: 'MISSING_FIELDS',
      fields: requiredMissing,
    });
  }

  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    console.error(JSON.stringify({
      ...logMeta,
      level: 'ERROR',
      message: 'Supabase configuratie ontbreekt. Kan wachtlijst niet opslaan.',
    }));
    return res.status(500).json({
      correlationId: logMeta.correlationId,
      message: 'Configuratiefout: opslagservice niet geconfigureerd.',
      code: 'CONFIG_ERROR',
    });
  }

  try {
    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Wachtlijst-aanvraag opslaan gestart.',
    }));

    const response = await httpClient(`${supabaseConfig.url}/rest/v1/wachtlijst_aanvragen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${supabaseConfig.anonKey}`,
        Prefer: 'return=representation',
        'X-Client-Info': 'heppy-wachtlijst-api',
      },
      body: JSON.stringify(transformed),
    }, logMeta.correlationId);

    const responseText = await response.text();
    let responseData = null;
    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch (parseError) {
      responseData = null;
    }

    if (!response.ok) {
      console.error(JSON.stringify({
        ...logMeta,
        level: 'ERROR',
        message: 'Supabase response niet OK voor wachtlijst opslag',
        status: response.status,
        statusText: response.statusText,
        responseText,
      }));

      if (response.status === 409) {
        return res.status(409).json({
          correlationId: logMeta.correlationId,
          message: 'Je staat al op onze wachtlijst.',
          code: 'DUPLICATE_ENTRY',
        });
      }

      return res.status(500).json({
        correlationId: logMeta.correlationId,
        message: 'Er ging iets mis bij het opslaan van je gegevens. Probeer het later opnieuw.',
        code: 'DATABASE_ERROR',
      });
    }

    const storedRecord = Array.isArray(responseData) ? responseData[0] : responseData;

    console.info(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Wachtlijst-aanvraag succesvol opgeslagen.',
      storedId: storedRecord?.id,
    }));

    return res.status(201).json({
      correlationId: logMeta.correlationId,
      message: 'Bedankt! We laten het je weten zodra we in jouw regio actief zijn.',
      code: 'WAITLIST_SUCCESS',
      data: storedRecord,
    });
  } catch (error) {
    console.error(JSON.stringify({
      ...logMeta,
      level: 'ERROR',
      message: 'Onverwachte fout tijdens wachtlijst verwerking',
      error: error.message,
      stack: error.stack,
    }));

    return res.status(500).json({
      correlationId: logMeta.correlationId,
      message: 'Er is een onverwachte fout opgetreden. Probeer het later opnieuw.',
      code: 'INTERNAL_ERROR',
    });
  }
}
