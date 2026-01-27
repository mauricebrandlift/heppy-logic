/**
 * Email Service
 * 
 * Herbruikbare service voor het verzenden van emails via Resend API.
 * Gebruikt native fetch() API zonder externe dependencies.
 * 
 * Functies:
 * - sendEmail(): Verzend enkele email
 * - sendBulkEmail(): Verzend naar meerdere ontvangers
 * 
 * Features:
 * - Error handling & retry logica
 * - Audit logging
 * - Rate limiting
 * - Correlation ID tracing
 */

import { emailConfig } from '../config/index.js';
import { auditService } from './auditService.js';
import { renderTemplate } from '../templates/emails/index.js';

const RESEND_API_URL = 'https://api.resend.com/emails';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Verzend een enkele email via Resend API
 * 
 * @param {Object} emailData - Email gegevens
 * @param {string} emailData.to - Ontvanger email adres
 * @param {string} emailData.subject - Email onderwerp
 * @param {string} emailData.html - HTML inhoud
 * @param {string} [emailData.text] - Plain text alternatief (optioneel)
 * @param {string} [emailData.from] - Afzender (default: MAIL_FROM)
 * @param {string} [emailData.replyTo] - Reply-to adres (default: MAIL_REPLY_TO)
 * @param {string} correlationId - Correlation ID voor tracing
 * @returns {Promise<Object>} - Resend API response met email ID
 * @throws {Error} - Als verzending mislukt na retries
 * 
 * @example
 * const result = await sendEmail({
 *   to: 'klant@example.com',
 *   subject: 'Welkom bij Heppy',
 *   html: '<h1>Welkom!</h1>',
 * }, 'correlation-123');
 */
export async function sendEmail(emailData, correlationId) {
  const {
    to,
    subject,
    html,
    text,
    template,
    data,
    from = emailConfig.fromEmail,
    replyTo = emailConfig.replyToEmail,
  } = emailData;

  // Render template indien aanwezig
  let emailHtml = html;
  if (template && data) {
    try {
      emailHtml = renderTemplate(template, data);
    } catch (error) {
      throw new Error(`Template rendering failed: ${error.message}`);
    }
  }

  // Validatie
  if (!to || !subject || !emailHtml) {
    throw new Error('Email requires: to, subject, and (html OR template+data)');
  }

  if (!emailConfig.resendApiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }

  if (!from) {
    throw new Error('MAIL_FROM not configured');
  }

  const logMeta = {
    correlationId: correlationId || `email-${Date.now()}`,
    to,
    subject,
  };

  console.log(JSON.stringify({
    ...logMeta,
    level: 'INFO',
    message: 'Email verzenden gestart',
    from,
  }));

  // Bouw email payload
  const payload = {
    from,
    to,
    subject,
    html: emailHtml,
    ...(text && { text }),
    ...(replyTo && { reply_to: replyTo }),
  };

  let lastError;
  
  // Retry loop
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${emailConfig.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.text();

      if (!response.ok) {
        const errorData = responseData ? JSON.parse(responseData) : {};
        
        console.error(JSON.stringify({
          ...logMeta,
          level: 'ERROR',
          message: `Resend API error (attempt ${attempt}/${MAX_RETRIES})`,
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        }));

        lastError = new Error(`Resend API error: ${errorData.message || response.statusText}`);
        lastError.statusCode = response.status;
        lastError.details = errorData;

        // Retry alleen bij 5xx errors (server-side issues)
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          console.log(JSON.stringify({
            ...logMeta,
            level: 'WARN',
            message: `Retrying email send (${attempt}/${MAX_RETRIES})...`,
            delay: RETRY_DELAY_MS,
          }));
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
          continue;
        }

        throw lastError;
      }

      // Success
      const result = JSON.parse(responseData);

      console.log(JSON.stringify({
        ...logMeta,
        level: 'INFO',
        message: 'Email succesvol verzonden',
        emailId: result.id,
        attempt,
      }));

      // Audit log
      await auditService.log(
        'email',
        null, // entityId = null voor standalone emails (to is geen UUID)
        'sent',
        null,
        {
          email_id: result.id,
          to, // Email adres in metadata ipv entityId
          subject,
          from,
          attempt,
        },
        logMeta.correlationId
      );

      return {
        success: true,
        emailId: result.id,
        to,
        subject,
      };

    } catch (error) {
      lastError = error;
      
      // Network errors - retry
      if (attempt < MAX_RETRIES && !error.statusCode) {
        console.log(JSON.stringify({
          ...logMeta,
          level: 'WARN',
          message: `Network error, retrying (${attempt}/${MAX_RETRIES})...`,
          error: error.message,
          delay: RETRY_DELAY_MS,
        }));
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        continue;
      }

      throw error;
    }
  }

  // Als we hier komen, zijn alle retries mislukt
  console.error(JSON.stringify({
    ...logMeta,
    level: 'ERROR',
    message: 'Email verzenden mislukt na alle retries',
    error: lastError.message,
  }));

  throw lastError;
}

/**
 * Verzend email naar meerdere ontvangers (bulk)
 * 
 * @param {Object} emailData - Email gegevens (zonder 'to')
 * @param {Array<string>} recipients - Array van email adressen
 * @param {string} correlationId - Correlation ID voor tracing
 * @returns {Promise<Object>} - Results object met success/failed arrays
 * 
 * @example
 * const result = await sendBulkEmail(
 *   { subject: 'Alert', html: '<h1>Alert!</h1>' },
 *   ['admin1@example.com', 'admin2@example.com'],
 *   'correlation-123'
 * );
 * // Returns: { sent: [...], failed: [...] }
 */
export async function sendBulkEmail(emailData, recipients, correlationId) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error('Recipients must be a non-empty array');
  }

  const logMeta = {
    correlationId: correlationId || `bulk-email-${Date.now()}`,
    recipientCount: recipients.length,
    subject: emailData.subject,
  };

  console.log(JSON.stringify({
    ...logMeta,
    level: 'INFO',
    message: 'Bulk email verzenden gestart',
  }));

  const results = {
    sent: [],
    failed: [],
  };

  // Verzend parallel (max 5 tegelijk om rate limits te respecteren)
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (recipient) => {
      try {
        const result = await sendEmail(
          { ...emailData, to: recipient },
          `${correlationId}-${i}`
        );
        results.sent.push({ email: recipient, emailId: result.emailId });
      } catch (error) {
        console.error(JSON.stringify({
          ...logMeta,
          level: 'ERROR',
          message: 'Bulk email verzending gefaald voor ontvanger',
          recipient,
          error: error.message,
        }));
        results.failed.push({ email: recipient, error: error.message });
      }
    });

    await Promise.all(batchPromises);

    // Kleine delay tussen batches om rate limits te respecteren
    if (i + BATCH_SIZE < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(JSON.stringify({
    ...logMeta,
    level: 'INFO',
    message: 'Bulk email verzenden voltooid',
    sent: results.sent.length,
    failed: results.failed.length,
  }));

  return results;
}

/**
 * Valideer email adres formaat
 * 
 * @param {string} email - Email adres om te valideren
 * @returns {boolean} - True als geldig email formaat
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get rate limit info (voor monitoring)
 * Let op: Resend API headers bevatten rate limit info
 * Deze functie is een placeholder voor toekomstige monitoring
 * 
 * @returns {Object} - Rate limit status
 */
export function getRateLimitInfo() {
  // TODO: Implement rate limit tracking via response headers
  // Resend stuurt: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  return {
    implemented: false,
    message: 'Rate limit tracking nog te implementeren',
  };
}

/**
 * Verzend email voor eerste mislukte betaling (retry 1)
 */
export async function sendPaymentFailedRetry1(to, data, correlationId) {
  return sendEmail({
    to,
    subject: '⚠️ Betaling mislukt - Heppy Schoonmaak',
    html: `
      <h2>Beste ${data.voornaam},</h2>
      <p>Helaas is de automatische incasso voor je schoonmaak abonnement mislukt.</p>
      <p><strong>Wat nu?</strong></p>
      <ul>
        <li>Controleer of er voldoende saldo op je rekening staat</li>
        <li>We proberen het opnieuw op <strong>${data.nextRetryDate}</strong></li>
      </ul>
      <p>Heb je vragen? Neem gerust contact met ons op.</p>
      <p>Met vriendelijke groet,<br>Team Heppy</p>
    `,
  }, correlationId);
}

/**
 * Verzend email voor tweede mislukte betaling (retry 2)
 */
export async function sendPaymentFailedRetry2(to, data, correlationId) {
  return sendEmail({
    to,
    subject: '⚠️ Nogmaals: Betaling mislukt - Heppy Schoonmaak',
    html: `
      <h2>Beste ${data.voornaam},</h2>
      <p>We hebben opnieuw geprobeerd het abonnementsbedrag af te schrijven, maar dit is helaas weer mislukt.</p>
      <p><strong>Actie vereist:</strong></p>
      <ul>
        <li>Controleer of je IBAN nog klopt</li>
        <li>Zorg voor voldoende saldo op je rekening</li>
        <li>We proberen het nog één keer op <strong>${data.nextRetryDate}</strong></li>
      </ul>
      <p><strong>Let op:</strong> Als de volgende poging ook mislukt, wordt je abonnement tijdelijk gepauzeerd.</p>
      <p>Log in op je account om je rekeningnummer te wijzigen indien nodig.</p>
      <p>Met vriendelijke groet,<br>Team Heppy</p>
    `,
  }, correlationId);
}

/**
 * Verzend email wanneer abonnement gepauzeerd is na 3 failures
 */
export async function sendAbonnementPaused(to, data, correlationId) {
  return sendEmail({
    to,
    subject: '🛑 Abonnement gepauzeerd - Heppy Schoonmaak',
    html: `
      <h2>Beste ${data.voornaam},</h2>
      <p>Helaas is de betaling voor je schoonmaak abonnement na 3 pogingen niet gelukt.</p>
      <p><strong>Je abonnement is tijdelijk gepauzeerd.</strong></p>
      <p>Om je abonnement te hervatten:</p>
      <ol>
        <li>Log in op je account</li>
        <li>Controleer of wijzig je rekeningnummer</li>
        <li>Neem contact met ons op om je abonnement te hervatten</li>
      </ol>
      <p>We begrijpen dat dit vervelend is. Neem zo spoedig mogelijk contact met ons op via:</p>
      <ul>
        <li>Email: info@heppy-schoonmaak.nl</li>
        <li>Telefoon: [telefoonnummer]</li>
      </ul>
      <p>Met vriendelijke groet,<br>Team Heppy</p>
    `,
  }, correlationId);
}

/**
 * Verzend admin notification voor failed payment
 */
export async function sendPaymentFailedAdmin(data, correlationId) {
  return sendEmail({
    to: 'notifications@heppy-schoonmaak.nl',
    subject: `⚠️ Payment Failure (Retry ${data.retryCount}/3) - ${data.abonnementId}`,
    html: `
      <h2>Payment Failure Notification</h2>
      <p><strong>Abonnement ID:</strong> ${data.abonnementId}</p>
      <p><strong>Gebruiker ID:</strong> ${data.gebruikerId}</p>
      <p><strong>Retry Count:</strong> ${data.retryCount}/3</p>
      <p><strong>Next Retry Date:</strong> ${data.nextRetryDate || 'N/A (max retries reached)'}</p>
      <p><strong>Failure Reason:</strong> ${data.failureReason}</p>
      ${data.retryCount >= 3 ? '<p><strong style="color: red;">⚠️ ABONNEMENT GEPAUZEERD</strong></p>' : ''}
      <p>Check Supabase dashboard voor meer details.</p>
    `,
  }, correlationId);
}

export const emailService = {
  sendPaymentFailedRetry1,
  sendPaymentFailedRetry2,
  sendAbonnementPaused,
  sendPaymentFailedAdmin,
};
