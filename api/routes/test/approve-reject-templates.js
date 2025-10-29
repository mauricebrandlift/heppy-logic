/**
 * API Route: Test Approve/Reject Email Templates
 * 
 * POST /api/routes/test/approve-reject-templates
 * 
 * Test endpoint voor de nieuwe approve/reject email templates.
 * Render en verstuur templates met dummy data via Postman.
 * 
 * Request Body:
 * {
 *   "template": "matchGoedgekeurdKlant" | "matchAfgewezenAdmin" | "geenSchoonmakerBeschikbaarKlant",
 *   "to": "test@example.com"  // Optioneel, default: MAIL_ADMIN
 * }
 */

import { emailConfig } from '../../config/index.js';
import { handleErrorResponse } from '../../utils/errorHandler.js';
import { sendEmail } from '../../services/emailService.js';
import { 
  matchGoedgekeurdKlant,
  matchAfgewezenAdmin,
  geenSchoonmakerBeschikbaarKlant
} from '../../templates/emails/index.js';

// Dummy data voor elke template
const dummyData = {
  matchGoedgekeurdKlant: {
    klantNaam: 'Jan Jansen',
    schoonmakerNaam: 'Maria Smit',
    schoonmakerFoto: 'https://i.pravatar.cc/300?img=5', // Placeholder foto
    schoonmakerBio: 'Ervaren schoonmaker met 8 jaar ervaring. Ik werk nauwkeurig en met oog voor detail. Specialisatie in dieptereiniging.',
    startdatum: '2025-11-15',
    uren: 4,
    dagdelen: { dinsdag: ['middag'], donderdag: ['ochtend'] },
    plaats: 'Amsterdam',
    aanvraagId: '12345678-1234-1234-1234-123456789abc',
    matchId: '87654321-4321-4321-4321-cba987654321'
  },
  
  matchAfgewezenAdmin: {
    klantNaam: 'Jan Jansen',
    klantEmail: 'jan.jansen@example.com',
    plaats: 'Amsterdam',
    uren: 4,
    dagdelen: { maandag: ['ochtend'], woensdag: ['middag'] },
    startdatum: '2025-11-15',
    aantalPogingen: 3,
    bedrag: 89.50,
    aanvraagId: '12345678-1234-1234-1234-123456789abc'
  },
  
  geenSchoonmakerBeschikbaarKlant: {
    klantNaam: 'Jan Jansen',
    plaats: 'Amsterdam',
    startdatum: '2025-11-15',
    uren: 4,
    dagdelen: { maandag: ['ochtend', 'middag'], vrijdag: ['avond'] },
    aanvraagId: '12345678-1234-1234-1234-123456789abc'
  }
};

const templateSubjects = {
  matchGoedgekeurdKlant: '🎉 Je Schoonmaker Heeft Geaccepteerd! - Heppy',
  matchAfgewezenAdmin: '⚠️ Geen Match Gevonden - Actie Vereist',
  geenSchoonmakerBeschikbaarKlant: 'We Zoeken Een Geschikte Schoonmaker - Heppy'
};

const templateFunctions = {
  matchGoedgekeurdKlant,
  matchAfgewezenAdmin,
  geenSchoonmakerBeschikbaarKlant
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, Authorization');

  // Correlation ID
  const correlationId = req.headers['x-correlation-id'] || `test-approve-reject-${Date.now()}`;
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
    message: 'Approve/Reject template test request ontvangen' 
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
      availableTemplates: Object.keys(dummyData),
      example: {
        template: 'matchGoedgekeurdKlant',
        to: 'test@example.com'
      }
    });
  }

  if (!dummyData[template]) {
    return res.status(400).json({
      correlationId,
      error: `Template "${template}" bestaat niet`,
      availableTemplates: Object.keys(dummyData)
    });
  }

  const recipient = to || emailConfig.notificationsEmail || emailConfig.adminEmail;
  const subject = templateSubjects[template];
  const templateFunction = templateFunctions[template];

  console.log(JSON.stringify({ 
    ...logMeta, 
    level: 'INFO', 
    message: 'Template renderen',
    template,
    to: recipient
  }));

  try {
    // Render template
    const html = templateFunction(dummyData[template]);

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
      message: 'Approve/Reject template email succesvol verzonden',
      template,
      emailId: result.emailId,
    }));

    return res.status(200).json({
      success: true,
      message: `✅ ${template} template email verzonden!`,
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
      },
      availableTemplates: Object.keys(dummyData)
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
