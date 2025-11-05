/**
 * Email Template: Nieuwe Verhuis-/Opleverschoonmaak voor Admin
 * 
 * Wordt verzonden naar admin wanneer een nieuwe verhuis/opleverschoonmaak opdracht binnenkomt.
 * Gebruikt na succesvolle betaling in de payment flow.
 */

import { baseLayout, formatDatum, formatBedrag } from './baseLayout.js';

/**
 * Genereer HTML voor nieuwe verhuis/opleverschoonmaak notificatie (Admin)
 * 
 * @param {Object} data - Template data
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.klantEmail - Email van de klant
 * @param {string} data.plaats - Plaats waar schoonmaak gewenst is
 * @param {number} data.uren - Aantal uren voor verhuis/opleverschoonmaak
 * @param {number} [data.m2] - Aantal vierkante meters
 * @param {number} [data.toiletten] - Aantal toiletten
 * @param {number} [data.badkamers] - Aantal badkamers
 * @param {string} data.gewensteDatum - Gewenste datum voor uitvoering
 * @param {string} [data.schoonmakerNaam] - Naam van gekozen schoonmaker (optioneel)
 * @param {boolean} [data.autoAssigned] - Of schoonmaker auto-assigned is
 * @param {string} data.opdrachtId - UUID van de opdracht
 * @param {number} data.bedrag - Betaalde bedrag
 * @returns {string} HTML string
 */
export function nieuweVerhuisAdmin(data) {
  const {
    klantNaam,
    klantEmail,
    plaats,
    uren,
    m2,
    toiletten,
    badkamers,
    gewensteDatum,
    schoonmakerNaam,
    autoAssigned,
    opdrachtId,
    bedrag
  } = data;

  const schoonmakerInfo = schoonmakerNaam 
    ? (autoAssigned 
        ? `<div class="warning-badge">⚡ Auto-toegewezen: ${schoonmakerNaam}</div>`
        : `<div class="success-badge">✓ Klant koos: ${schoonmakerNaam}</div>`)
    : '<div class="info-badge">📋 Schoonmaker wacht op goedkeuring</div>';

  const content = `
    <h2>🆕 Nieuwe Verhuis-/Opleverschoonmaak Opdracht Ontvangen</h2>
    
    <p>Er is een nieuwe verhuis-/opleverschoonmaak opdracht binnengekomen. De betaling is succesvol verwerkt en de opdracht is klaar voor uitvoering.</p>
    
    ${schoonmakerInfo}
    
    <div class="info-box">
      <h3 style="margin-top: 0;">👤 Klant Gegevens</h3>
      <p><strong>Naam:</strong> ${klantNaam}</p>
      <p><strong>Email:</strong> ${klantEmail}</p>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📋 Opdracht Details</h3>
      <table>
        <tr>
          <th>Detail</th>
          <th>Waarde</th>
        </tr>
        <tr>
          <td><strong>Type</strong></td>
          <td>Verhuis-/Opleverschoonmaak (eenmalig)</td>
        </tr>
        <tr>
          <td><strong>Plaats</strong></td>
          <td>${plaats}</td>
        </tr>
        <tr>
          <td><strong>Gewenste datum</strong></td>
          <td>${formatDatum(gewensteDatum)}</td>
        </tr>
        <tr>
          <td><strong>Geschatte duur</strong></td>
          <td>${uren} uur</td>
        </tr>
        ${m2 ? `
        <tr>
          <td><strong>Oppervlakte</strong></td>
          <td>${m2} m²</td>
        </tr>
        ` : ''}
        ${toiletten ? `
        <tr>
          <td><strong>Aantal toiletten</strong></td>
          <td>${toiletten}</td>
        </tr>
        ` : ''}
        ${badkamers ? `
        <tr>
          <td><strong>Aantal badkamers</strong></td>
          <td>${badkamers}</td>
        </tr>
        ` : ''}
        <tr>
          <td><strong>Betaald bedrag</strong></td>
          <td>${formatBedrag(bedrag)}</td>
        </tr>
      </table>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">🔧 Technische Details</h3>
      <p><strong>Opdracht ID:</strong> <code>${opdrachtId}</code></p>
      <p><strong>Ontvangen op:</strong> ${formatDatum(new Date().toISOString())}</p>
      <p><strong>Status:</strong> <span style="color: #f59e0b; font-weight: 600;">⏳ Aangevraagd</span></p>
      <p><strong>Betaalstatus:</strong> <span style="color: #10b981; font-weight: 600;">✓ Betaald</span></p>
    </div>
    
    <h3>📌 Volgende Stappen</h3>
    <ul>
      <li>${schoonmakerNaam ? '✅ Schoonmaker wacht op opdracht goedkeuring' : '⚠️ Handmatig een schoonmaker toewijzen via dashboard'}</li>
      <li>📧 Email notificatie verzonden naar schoonmaker (indien toegewezen)</li>
      <li>📞 Schoonmaker neemt contact op met klant voor exacte tijd en eventuele vragen</li>
      <li>📊 Opdracht staat klaar in het admin dashboard</li>
    </ul>
    
    <p style="margin-top: 30px;">
      <a href="#" class="button">Bekijk in Dashboard</a>
    </p>
  `;

  return baseLayout(content, 'Nieuwe Verhuis-/Opleverschoonmaak - Heppy Schoonmaak');
}
