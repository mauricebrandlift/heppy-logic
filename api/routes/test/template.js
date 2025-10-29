/**
 * API Route: Test Email Template
 * 
 * POST /api/routes/test/template
 * 
 * Test endpoint voor email templates via Postman.
 * Render een template met dummy data en verstuur als email.
 * 
 * Request Body:
 * {
 *   "template": "nieuweAanvraagAdmin" | "betalingBevestigingKlant" | "matchToegewezenSchoonmaker",
 *   "to": "test@example.com"  // Optioneel, default: MAIL_ADMIN
 * }
 * 
 * Response Success (200):
 * {
 *   "success": true,
 *   "message": "Template email verzonden!",
 *   "data": {
 *     "template": "nieuweAanvraagAdmin",
 *     "emailId": "...",
 *     "to": "..."
 *   }
 * }
 */

import { emailConfig } from '../../config/index.js';
import { handleErrorResponse } from '../../utils/errorHandler.js';
import { sendEmail } from '../../services/emailService.js';
import { renderTemplate } from '../../templates/emails/index.js';

// Dummy data voor elke template
const dummyData = {
  nieuweAanvraagAdmin: {
    klantNaam: 'Jan Jansen',
    klantEmail: 'jan.jansen@example.com',
    plaats: 'Amsterdam',
    uren: 4,
    dagdelen: ['ochtend', 'middag'],
    startdatum: '2025-11-15',
    schoonmakerNaam: 'Maria Smit',
    autoAssigned: true,
    aanvraagId: '12345678-1234-1234-1234-123456789abc',
    bedrag: 89.50
  },
  betalingBevestigingKlant: {
    klantNaam: 'Jan Jansen',
    plaats: 'Amsterdam',
    uren: 4,
    dagdelen: ['ochtend', 'middag'],
    startdatum: '2025-11-15',
    schoonmakerNaam: 'Maria Smit',
    autoAssigned: false,
    bedrag: 89.50,
    betalingId: 'pi_3AbCdEfGhIjKlMnO'
  },
  matchToegewezenSchoonmaker: {
    schoonmakerNaam: 'Maria Smit',
    klantNaam: 'Jan Jansen',
    adres: 'Keizersgracht 123',
    plaats: 'Amsterdam',
    postcode: '1015 CJ',
    uren: 4,
    dagdelen: ['ochtend', 'middag'],
    startdatum: '2025-11-15',
    autoAssigned: true,
    aanvraagId: '12345678-1234-1234-1234-123456789abc',
    matchId: '87654321-4321-4321-4321-cba987654321'
  }
};

const templateSubjects = {
  nieuweAanvraagAdmin: '🆕 Nieuwe Aanvraag - Jan Jansen (Amsterdam)',
  betalingBevestigingKlant: '✅ Betaling Bevestiging - Heppy Schoonmaak',
  matchToegewezenSchoonmaker: '🎉 Nieuwe Aanvraag Voor U - Jan Jansen'
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, Authorization');

  // Correlation ID
  const correlationId = req.headers['x-correlation-id'] || `test-template-${Date.now()}`;
  if (correlationId) {
    res.setHeader('X-Correlation-ID', correlationId);
  }

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const logMeta = {
    correlationId,
    route: req.url,
    method: req.method,
  };

  console.log(JSON.stringify({ 
    ...logMeta, 
    level: 'INFO', 
    message: 'Template test request ontvangen' 
  }));

  // Validate method
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    const msg = 'Method Not Allowed. Only POST requests are accepted.';
    console.warn(JSON.stringify({ ...logMeta, level: 'WARN', message: msg }));
    return res.status(405).json({ correlationId, error: msg });
  }

  // Get parameters
  const { template, to } = req.body || {};
  
  if (!template) {
    return res.status(400).json({
      correlationId,
      error: 'Template parameter is verplicht',
      availableTemplates: Object.keys(dummyData)
    });
  }

  if (!dummyData[template]) {
    return res.status(400).json({
      correlationId,
      error: `Template "${template}" bestaat niet`,
      availableTemplates: Object.keys(dummyData)
    });
  }

  const recipient = to || emailConfig.adminEmail;
  const subject = templateSubjects[template];

  console.log(JSON.stringify({ 
    ...logMeta, 
    level: 'INFO', 
    message: 'Template renderen',
    template,
    to: recipient
  }));

  try {
    // Render template
    const html = renderTemplate(template, dummyData[template]);

    console.log(JSON.stringify({ 
      ...logMeta, 
      level: 'INFO', 
      message: 'Template gerenderd, email verzenden...',
      htmlLength: html.length
    }));

    // Send email
    const result = await sendEmail(
      {
        to: recipient,
        subject: subject,
        html: html,
      },
      correlationId
    );

    console.log(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Template email succesvol verzonden',
      template,
      emailId: result.emailId,
    }));

    return res.status(200).json({
      success: true,
      message: `Template email verzonden! 📧`,
      data: {
        template,
        emailId: result.emailId,
        to: recipient,
        subject,
        dummyData: dummyData[template],
        timestamp: new Date().toISOString(),
      },
      instructions: {
        inbox: `Check je inbox: ${recipient}`,
        dashboard: 'https://resend.com/emails',
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      ...logMeta,
      level: 'ERROR',
      message: 'Template test gefaald',
      template,
      error: error.message,
      stack: error.stack,
    }));
    
    return handleErrorResponse(res, error, correlationId);
  }
}
