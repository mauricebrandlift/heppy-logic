/**
 * POST /api/test/send-email
 * 
 * Test endpoint voor email verzending via Resend.
 * Alleen voor development/testing - NIET in production gebruiken!
 * 
 * Body (optioneel):
 * {
 *   "to": "test@example.com",  // Default: MAIL_ADMIN
 *   "subject": "Custom Subject" // Default: "Test Email - Heppy"
 * }
 */

import { emailConfig } from '../../config/index.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check configuration
  if (!emailConfig.resendApiKey) {
    return res.status(500).json({ 
      success: false,
      error: 'RESEND_API_KEY niet geconfigureerd in environment variables' 
    });
  }

  if (!emailConfig.fromEmail) {
    return res.status(500).json({ 
      success: false,
      error: 'MAIL_FROM niet geconfigureerd in environment variables' 
    });
  }

  // Get parameters from body (optional)
  const { to, subject } = req.body || {};
  
  const recipient = to || emailConfig.adminEmail;
  const emailSubject = subject || 'Test Email - Heppy Schoonmaak';

  // Build test email
  const testEmail = {
    from: emailConfig.fromEmail,
    to: recipient,
    subject: emailSubject,
    html: `
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
                <li>✓ Email verzending via fetch() API</li>
                <li>✓ From/Reply-To headers</li>
                <li>✓ HTML email rendering</li>
              </ul>
              
              <h3>🚀 Volgende stappen:</h3>
              <ul>
                <li>→ Email templates bouwen</li>
                <li>→ Integreren in aanvraag flows</li>
                <li>→ Approve/reject notificaties</li>
                <li>→ Admin alerts</li>
              </ul>
              
              <div class="footer">
                <p>Dit is een test email verzonden via <strong>POST /api/test/send-email</strong></p>
                <p>Heppy Logic Backend • ${new Date().getFullYear()}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
    reply_to: emailConfig.replyToEmail,
  };

  try {
    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${emailConfig.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testEmail),
    });

    const responseData = await response.text();
    
    if (!response.ok) {
      console.error('[Test Email] Resend API error:', {
        status: response.status,
        statusText: response.statusText,
        response: responseData,
      });

      return res.status(response.status).json({
        success: false,
        error: 'Email verzenden mislukt',
        details: responseData,
        resendStatus: response.status,
      });
    }

    const result = JSON.parse(responseData);
    
    console.log('[Test Email] Email verzonden:', {
      id: result.id,
      to: recipient,
      subject: emailSubject,
    });

    return res.status(200).json({
      success: true,
      message: 'Test email succesvol verzonden! 📧',
      data: {
        emailId: result.id,
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
    console.error('[Test Email] Error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Email verzenden mislukt',
      message: error.message,
    });
  }
}
