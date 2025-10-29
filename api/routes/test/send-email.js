/**
 * API Route: Test Email Verzenden
 * 
 * POST /api/routes/test/send-email
 * 
 * Test endpoint voor Resend API email verzending.
 * Alleen voor development/testing via Postman.
 * 
 * Request Body (optioneel):
 * {
 *   "to": "test@example.com",      // Default: MAIL_ADMIN
 *   "subject": "Custom Subject"     // Default: "Test Email - Heppy"
 * }
 * 
 * Response Success (200):
 * {
 *   "success": true,
 *   "message": "Test email succesvol verzonden! 📧",
 *   "data": {
 *     "emailId": "resend-email-id",
 *     "to": "recipient@example.com",
 *     "from": "no-reply@heppy-schoonmaak.nl",
 *     "subject": "Test Email - Heppy",
 *     "timestamp": "2025-10-28T..."
 *   },
 *   "instructions": {
 *     "inbox": "Check je inbox: recipient@example.com",
 *     "dashboard": "https://resend.com/emails"
 *   }
 * }
 * 
 * Response Error (500):
 * {
 *   "error": "Error message",
 *   "details": { ... }
 * }
 */

import { emailConfig } from '../../config/index.js';
import { handleErrorResponse } from '../../utils/errorHandler.js';
import { sendEmail } from '../../services/emailService.js';

export default async function handler(req, res) {
  // CORS headers voor alle responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, Authorization');

  // Correlation ID voor tracing
  const correlationId = req.headers['x-correlation-id'] || `test-email-${Date.now()}`;
  if (correlationId) {
    res.setHeader('X-Correlation-ID', correlationId);
  }

  // Handle OPTIONS (preflight) request
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
    message: 'Test email request ontvangen.' 
  }));

  // Validate method
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    const msg = 'Method Not Allowed. Only POST requests are accepted.';
    console.warn(JSON.stringify({ 
      ...logMeta, 
      level: 'WARN', 
      message: msg 
    }));
    return res.status(405).json({ 
      correlationId, 
      error: msg 
    });
  }

  // Check configuration
  if (!emailConfig.resendApiKey) {
    const msg = 'RESEND_API_KEY niet geconfigureerd in environment variables';
    console.error(JSON.stringify({ 
      ...logMeta, 
      level: 'ERROR', 
      message: msg 
    }));
    return res.status(500).json({ 
      correlationId,
      error: msg 
    });
  }

  if (!emailConfig.fromEmail) {
    const msg = 'MAIL_FROM niet geconfigureerd in environment variables';
    console.error(JSON.stringify({ 
      ...logMeta, 
      level: 'ERROR', 
      message: msg 
    }));
    return res.status(500).json({ 
      correlationId,
      error: msg 
    });
  }

  // Get parameters from body (optional)
  const { to, subject } = req.body || {};
  
  const recipient = to || emailConfig.adminEmail;
  const emailSubject = subject || 'Test Email - Heppy Schoonmaak';

  console.log(JSON.stringify({ 
    ...logMeta, 
    level: 'INFO', 
    message: 'Email voorbereiden voor verzending',
    to: recipient,
    subject: emailSubject
  }));

  // Build test email HTML
  const htmlContent = `
    <html>
      <head>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6; 
            color: #333; 
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container { 
            max-width: 600px; 
            margin: 40px auto; 
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            padding: 40px 20px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content { 
            padding: 40px 30px;
          }
          .content h2 {
            color: #667eea;
            margin-top: 0;
          }
          .info-box {
            background: #f9fafb;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 20px 0;
          }
          .info-box strong {
            color: #667eea;
          }
          .success-badge {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            margin: 20px 0;
          }
          .footer { 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #e5e7eb; 
            font-size: 12px; 
            color: #6b7280;
            text-align: center;
          }
          ul {
            list-style: none;
            padding: 0;
          }
          li {
            padding: 8px 0;
            border-bottom: 1px solid #f3f4f6;
          }
          li:last-child {
            border-bottom: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🧹 Heppy Schoonmaak</h1>
          </div>
          <div class="content">
            <div class="success-badge">✓ Email System Operationeel</div>
            
            <h2>Test Email Succesvol Verzonden!</h2>
            <p>Als je deze email ontvangt, werkt de Resend API integratie perfect.</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0;">📋 Configuratie Details</h3>
              <ul>
                <li><strong>Van:</strong> ${emailConfig.fromEmail}</li>
                <li><strong>Naar:</strong> ${recipient}</li>
                <li><strong>Reply-To:</strong> ${emailConfig.replyToEmail}</li>
                <li><strong>Admin Email:</strong> ${emailConfig.adminEmail}</li>
                <li><strong>Correlation ID:</strong> ${correlationId}</li>
                <li><strong>Timestamp:</strong> ${new Date().toLocaleString('nl-NL', { 
                  timeZone: 'Europe/Amsterdam',
                  dateStyle: 'full',
                  timeStyle: 'long'
                })}</li>
              </ul>
            </div>
            
            <h3>✅ Wat werkt nu:</h3>
            <ul>
              <li>✓ Resend API key configuratie</li>
              <li>✓ Email verzending via emailService</li>
              <li>✓ From/Reply-To headers</li>
              <li>✓ HTML email rendering</li>
              <li>✓ Correlation ID tracing</li>
              <li>✓ Error handling & retry logica</li>
              <li>✓ Audit logging</li>
            </ul>
            
            <h3>🚀 Volgende stappen:</h3>
            <ul>
              <li>→ Email templates bouwen</li>
              <li>→ Integreren in aanvraag flows</li>
              <li>→ Approve/reject notificaties</li>
              <li>→ Admin alerts</li>
            </ul>
            
            <div class="footer">
              <p>Dit is een test email verzonden via <strong>emailService.sendEmail()</strong></p>
              <p>Heppy Logic Backend • ${new Date().getFullYear()}</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    // Send email via emailService
    const result = await sendEmail(
      {
        to: recipient,
        subject: emailSubject,
        html: htmlContent,
      },
      correlationId
    );

    console.log(JSON.stringify({
      ...logMeta,
      level: 'INFO',
      message: 'Test email succesvol verzonden via emailService',
      emailId: result.emailId,
    }));

    return res.status(200).json({
      success: true,
      message: 'Test email succesvol verzonden! 📧',
      data: {
        emailId: result.emailId,
        to: recipient,
        from: emailConfig.fromEmail,
        subject: emailSubject,
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
      message: 'Email verzending gefaald',
      error: error.message,
      stack: error.stack,
    }));
    
    return handleErrorResponse(res, error, correlationId);
  }
}
