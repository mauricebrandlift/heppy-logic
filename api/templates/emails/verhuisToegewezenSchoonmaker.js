/**
 * Email Template: Verhuis-/Opleverschoonmaak Toegewezen aan Schoonmaker
 * 
 * Wordt verzonden naar schoonmaker wanneer een verhuis-/opleverschoonmaak opdracht aan hen is toegewezen.
 * Bevat accept/decline knoppen en opdracht details.
 */

import { baseLayout, formatDatum, formatBedrag } from './baseLayout.js';
import { frontendConfig } from '../../config/index.js';

/**
 * Genereer HTML voor verhuis-/opleverschoonmaak opdracht toewijzing (Schoonmaker)
 * 
 * @param {Object} data - Template data
 * @param {string} data.schoonmakerNaam - Naam van de schoonmaker
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.plaats - Plaats waar schoonmaak gewenst is
 * @param {string} data.adres - Volledig adres (straat + huisnummer)
 * @param {string} data.postcode - Postcode
 * @param {number} data.uren - Aantal uren voor verhuis-/opleverschoonmaak
 * @param {number} [data.m2] - Aantal vierkante meters
 * @param {number} [data.toiletten] - Aantal toiletten
 * @param {number} [data.badkamers] - Aantal badkamers
 * @param {string} data.gewensteDatum - Gewenste datum voor uitvoering
 * @param {boolean} [data.autoAssigned] - Of match auto-assigned is
 * @param {string} data.matchId - UUID van de schoonmaak_match
 * @param {string} data.opdrachtId - UUID van de opdracht
 * @param {number} data.bedrag - Bedrag voor de opdracht
 * @returns {string} HTML string
 */
export function verhuisToegewezenSchoonmaker(data) {
  const {
    schoonmakerNaam,
    klantNaam,
    plaats,
    adres,
    postcode,
    uren,
    m2,
    toiletten,
    badkamers,
    gewensteDatum,
    autoAssigned,
    matchId,
    opdrachtId,
    bedrag
  } = data;

  const assignmentBadge = autoAssigned
    ? '<div class="info-badge">🤖 Auto-toegewezen op basis van uw profiel</div>'
    : '<div class="success-badge">⭐ Deze klant heeft u specifiek gekozen!</div>';

  const opdrachtDetails = [];
  if (m2) opdrachtDetails.push(`${m2} m²`);
  if (toiletten) opdrachtDetails.push(`${toiletten} toilet${toiletten > 1 ? 'ten' : ''}`);
  if (badkamers) opdrachtDetails.push(`${badkamers} badkamer${badkamers > 1 ? 's' : ''}`);
  const opdrachtOmschrijving = opdrachtDetails.length > 0 
    ? ` (${opdrachtDetails.join(', ')})` 
    : '';

  const content = `
    <h2>🎉 Nieuwe Verhuis-/Opleverschoonmaak Opdracht!</h2>
    
    <p>Beste ${schoonmakerNaam},</p>
    
    <p>Goed nieuws! Er is een nieuwe verhuis-/opleverschoonmaak opdracht voor je beschikbaar gekomen.</p>
    
    ${assignmentBadge}
    
    <div class="info-box">
      <h3 style="margin-top: 0;">👤 Klant Informatie</h3>
      <p><strong>Naam:</strong> ${klantNaam}</p>
      <p><strong>Adres:</strong> ${adres}</p>
      <p><strong>Postcode:</strong> ${postcode}</p>
      <p><strong>Plaats:</strong> ${plaats}</p>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">🧹 Opdracht Details</h3>
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
          <td><strong>Gewenste datum</strong></td>
          <td>${formatDatum(gewensteDatum)}</td>
        </tr>
        <tr>
          <td><strong>Geschatte duur</strong></td>
          <td>${uren} uur${opdrachtOmschrijving}</td>
        </tr>
        <tr>
          <td><strong>Vergoeding</strong></td>
          <td>${formatBedrag(bedrag)}</td>
        </tr>
        <tr>
          <td><strong>Betaalstatus</strong></td>
          <td><span style="color: #10b981; font-weight: 600;">✓ Reeds betaald door klant</span></td>
        </tr>
      </table>
    </div>
    
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 30px 0; border-radius: 4px;">
      <p style="margin: 0; color: #92400e;">
        <strong>⏰ Actie vereist:</strong> Geef binnen 48 uur aan of je deze opdracht kunt accepteren. Als we binnen deze tijd geen reactie ontvangen, kunnen we de opdracht aan een andere schoonmaker toewijzen.
      </p>
    </div>
    
    <h3>📌 Wat moet je doen?</h3>
    <ul>
      <li>Bekijk de opdracht details hierboven</li>
      <li>Controleer of de gewenste datum beschikbaar is in jouw agenda</li>
      <li>Accepteer of weiger de opdracht via onderstaande knoppen</li>
      <li>Bij acceptatie: neem direct contact op met de klant om de exacte tijd af te spreken</li>
    </ul>
    
    <div style="margin: 30px 0; text-align: center;">
      <a href="${frontendConfig.baseUrl}/schoonmaak-actie?match_id=${matchId}&action=approve" class="button" style="background: #10b981; margin-right: 10px;">✓ Accepteer Opdracht</a>
      <a href="${frontendConfig.baseUrl}/schoonmaak-actie?match_id=${matchId}&action=decline" class="button" style="background: #ef4444;">✗ Weiger Opdracht</a>
    </div>
    
    <p style="margin-top: 30px; text-align: center;">
      <a href="${frontendConfig.baseUrl}/schoonmaker-dashboard" style="color: #3b82f6; text-decoration: underline; font-size: 14px;">Bekijk volledige opdracht details →</a>
    </p>
    
    <div style="background: #f3f4f6; padding: 15px; margin-top: 40px; border-radius: 4px; font-size: 12px; color: #6b7280;">
      <p style="margin: 0;"><strong>Technische Details:</strong></p>
      <p style="margin: 5px 0 0 0;">Match ID: <code>${matchId.substring(0, 8)}</code> | Opdracht ID: <code>${opdrachtId.substring(0, 8)}</code></p>
    </div>
    
    <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
      <strong>Vragen?</strong> Neem gerust contact met ons op. We helpen je graag verder!
    </p>
  `;

  return baseLayout(content, 'Nieuwe Verhuis-/Opleverschoonmaak Opdracht - Heppy Schoonmaak');
}
