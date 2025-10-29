/**
 * Email Template System
 * 
 * Herbruikbare email templates met dynamische content.
 * Gebruikt template literals voor eenvoudige templating zonder dependencies.
 * 
 * Template types:
 * - Aanvraag flow: nieuwe aanvraag, betaling bevestiging
 * - Matching flow: match toegewezen, goedgekeurd, afgewezen
 * - Admin alerts: geen schoonmaker beschikbaar
 */

import { emailConfig } from '../../config/index.js';

/**
 * Basis email layout met Heppy branding
 * Alle templates wrappen hun content in deze layout
 */
export function baseLayout(content, title = 'Heppy Schoonmaak') {
  return `
    <!DOCTYPE html>
    <html lang="nl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6; 
            color: #333; 
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .email-wrapper {
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
            font-size: 24px;
          }
          .content h3 {
            color: #333;
            font-size: 18px;
            margin-top: 24px;
            margin-bottom: 12px;
          }
          .info-box {
            background: #f9fafb;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .info-box strong {
            color: #667eea;
          }
          .info-box p {
            margin: 8px 0;
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
          .warning-badge {
            display: inline-block;
            background: #f59e0b;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            background: #667eea;
            color: white !important;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
          }
          .button:hover {
            background: #5568d3;
          }
          .footer { 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #e5e7eb; 
            font-size: 13px; 
            color: #6b7280;
            text-align: center;
          }
          .footer p {
            margin: 8px 0;
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
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          table th {
            text-align: left;
            padding: 12px;
            background: #f9fafb;
            font-weight: 600;
            color: #667eea;
            border-bottom: 2px solid #667eea;
          }
          table td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h1>🧹 Heppy Schoonmaak</h1>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>Dit is een automatisch gegenereerde email van Heppy Schoonmaak.</p>
            <p>Voor vragen kunt u antwoorden op deze email of contact opnemen via ${emailConfig.replyToEmail}</p>
            <p>&copy; ${new Date().getFullYear()} Heppy Schoonmaak. Alle rechten voorbehouden.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Format datum naar Nederlandse weergave
 */
export function formatDatum(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format bedrag naar Euro weergave
 */
export function formatBedrag(amount) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

/**
 * Format dagdelen array naar leesbare string
 */
export function formatDagdelen(dagdelen) {
  if (!Array.isArray(dagdelen)) return dagdelen;
  
  const dagdelenNamen = {
    'ochtend': 'Ochtend (08:00-12:00)',
    'middag': 'Middag (12:00-17:00)',
    'avond': 'Avond (17:00-20:00)'
  };
  
  return dagdelen.map(d => dagdelenNamen[d] || d).join(', ');
}
