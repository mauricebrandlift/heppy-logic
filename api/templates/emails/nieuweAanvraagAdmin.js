/**
 * Email Template: Nieuwe Aanvraag voor Admin
 * 
 * Wordt verzonden naar admin wanneer een nieuwe schoonmaak aanvraag binnenkomt.
 * Gebruikt na succesvolle betaling in de payment flow.
 */

import { baseLayout, formatDatum, formatBedrag, formatDagdelen } from './baseLayout.js';

/**
 * Genereer HTML voor nieuwe aanvraag notificatie (Admin)
 * 
 * @param {Object} data - Template data
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.klantEmail - Email van de klant
 * @param {string} data.plaats - Plaats waar schoonmaak gewenst is
 * @param {number} data.uren - Aantal gewenste uren per week
 * @param {Array<string>} data.dagdelen - Gewenste dagdelen
 * @param {string} data.startdatum - Gewenste startdatum
 * @param {string} [data.schoonmakerNaam] - Naam van gekozen schoonmaker (optioneel)
 * @param {boolean} [data.autoAssigned] - Of schoonmaker auto-assigned is
 * @param {string} data.aanvraagId - UUID van de aanvraag
 * @param {number} data.bedrag - Betaalde bedrag
 * @returns {string} HTML string
 */
export function nieuweAanvraagAdmin(data) {
  const {
    klantNaam,
    klantEmail,
    plaats,
    uren,
    dagdelen,
    startdatum,
    schoonmakerNaam,
    autoAssigned,
    aanvraagId,
    bedrag
  } = data;

  const schoonmakerInfo = schoonmakerNaam 
    ? (autoAssigned 
        ? `<div class="warning-badge">⚡ Auto-toegewezen: ${schoonmakerNaam}</div>`
        : `<div class="success-badge">✓ Klant koos: ${schoonmakerNaam}</div>`)
    : '<div class="info-badge">📋 Schoonmaker wacht op goedkeuring</div>';

  const content = `
    <h2>🆕 Nieuwe Schoonmaak Aanvraag Ontvangen</h2>
    
    <p>Er is een nieuwe aanvraag binnengekomen. De betaling is succesvol verwerkt en de aanvraag is klaar voor verwerking.</p>
    
    ${schoonmakerInfo}
    
    <div class="info-box">
      <h3 style="margin-top: 0;">👤 Klant Gegevens</h3>
      <p><strong>Naam:</strong> ${klantNaam}</p>
      <p><strong>Email:</strong> ${klantEmail}</p>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📋 Aanvraag Details</h3>
      <table>
        <tr>
          <th>Detail</th>
          <th>Waarde</th>
        </tr>
        <tr>
          <td><strong>Plaats</strong></td>
          <td>${plaats}</td>
        </tr>
        <tr>
          <td><strong>Uren per week</strong></td>
          <td>${uren} uur</td>
        </tr>
        <tr>
          <td><strong>Dagdelen</strong></td>
          <td>${formatDagdelen(dagdelen)}</td>
        </tr>
        <tr>
          <td><strong>Startdatum</strong></td>
          <td>${formatDatum(startdatum)}</td>
        </tr>
        <tr>
          <td><strong>Betaald bedrag</strong></td>
          <td>${formatBedrag(bedrag)}</td>
        </tr>
      </table>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">🔧 Technische Details</h3>
      <p><strong>Aanvraag ID:</strong> <code>${aanvraagId}</code></p>
      <p><strong>Ontvangen op:</strong> ${formatDatum(new Date().toISOString())}</p>
    </div>
    
    <h3>📌 Volgende Stappen</h3>
    <ul>
      <li>${schoonmakerNaam ? '✅ Schoonmaker wacht op aanvraag goedkeuring' : '⚠️ Handmatig een schoonmaker toewijzen via dashboard'}</li>
      <li>📧 Email notificatie verzonden naar schoonmaker (indien toegewezen)</li>
      <li>📊 Aanvraag staat klaar in het admin dashboard</li>
    </ul>
    
    <p style="margin-top: 30px;">
      <a href="#" class="button">Bekijk in Dashboard</a>
    </p>
  `;

  return baseLayout(content, 'Nieuwe Aanvraag - Heppy Schoonmaak');
}
