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
            background: #c9e9b1;
            color: #013d29; 
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
 * Bereken ISO weeknummer van een datum
 */
function getISOWeek(date) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Donderdag in huidige week bepaalt weeknummer
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

/**
 * Haal start datum van een ISO week
 */
function getStartDateOfISOWeek(week, year) {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dayOfWeek = simple.getUTCDay() || 7;
  if (dayOfWeek > 4) {
    simple.setUTCDate(simple.getUTCDate() + 8 - dayOfWeek);
  } else {
    simple.setUTCDate(simple.getUTCDate() - (dayOfWeek - 1));
  }
  return simple;
}

/**
 * Format startdatum naar week weergave
 * Bijvoorbeeld: "Week 46 (11 november – 17 november 2025)"
 */
export function formatStartWeek(dateString) {
  const date = new Date(dateString);
  const weekNr = getISOWeek(date);
  const year = date.getFullYear();
  const startDate = getStartDateOfISOWeek(weekNr, year);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  
  const formatShortDate = (d) => {
    return `${d.getDate()} ${d.toLocaleString('nl-NL', { month: 'long' })}`;
  };
  
  return `Week ${weekNr} (${formatShortDate(startDate)} – ${formatShortDate(endDate)} ${year})`;
}

/**
 * Format dagdelen array of object naar leesbare string
 * Ondersteunt beide formaten:
 * - Array: ['ochtend', 'middag']
 * - Object: {maandag: ['ochtend'], dinsdag: ['middag']}
 */
export function formatDagdelen(dagdelen) {
  // Check voor null, undefined, of leeg
  if (!dagdelen) return 'Geen specifieke voorkeur doorgegeven';
  
  // Als het een object is (formaat: {dag: [dagdelen]})
  if (typeof dagdelen === 'object' && !Array.isArray(dagdelen)) {
    // Check of object leeg is
    if (Object.keys(dagdelen).length === 0) return 'Geen specifieke voorkeur doorgegeven';
    const dagNamen = {
      'maandag': 'Ma',
      'dinsdag': 'Di',
      'woensdag': 'Wo',
      'donderdag': 'Do',
      'vrijdag': 'Vr',
      'zaterdag': 'Za',
      'zondag': 'Zo'
    };
    
    const dagdelenNamen = {
      'ochtend': 'ochtend',
      'middag': 'middag',
      'avond': 'avond'
    };
    
    const formatted = Object.entries(dagdelen)
      .map(([dag, delen]) => {
        const dagNaam = dagNamen[dag.toLowerCase()] || dag;
        const delenStr = Array.isArray(delen) 
          ? delen.map(d => dagdelenNamen[d.toLowerCase()] || d).join('+')
          : delen;
        return `${dagNaam} ${delenStr}`;
      })
      .join(', ');
    
    return formatted || 'Niet opgegeven';
  }
  
  // Als het een array is (legacy formaat)
  if (Array.isArray(dagdelen)) {
    const dagdelenNamen = {
      'ochtend': 'Ochtend (08:00-12:00)',
      'middag': 'Middag (12:00-17:00)',
      'avond': 'Avond (17:00-20:00)'
    };
    
    return dagdelen.map(d => dagdelenNamen[d] || d).join(', ');
  }
  
  // Fallback voor andere types
  return String(dagdelen);
}
