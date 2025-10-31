/**
 * Email Template: Match Toegewezen aan Schoonmaker
 * 
 * Wordt verzonden naar schoonmaker wanneer een nieuwe aanvraag wordt toegewezen.
 * Bevat alle relevante informatie en knoppen om te accepteren/weigeren.
 */

import { baseLayout, formatDatum, formatDagdelen, formatStartWeek } from './baseLayout.js';

/**
 * Genereer HTML voor match toegewezen notificatie (Schoonmaker)
 * 
 * @param {Object} data - Template data
 * @param {string} data.schoonmakerNaam - Naam van de schoonmaker
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.adres - Adres van de klant (straat + huisnummer)
 * @param {string} data.plaats - Plaats
 * @param {string} data.postcode - Postcode
 * @param {number} data.uren - Aantal uren per week
 * @param {Array<string>} data.dagdelen - Gewenste dagdelen
 * @param {string} data.startdatum - Gewenste startdatum
 * @param {boolean} data.autoAssigned - Of dit een auto-assigned match is
 * @param {string} data.aanvraagId - UUID van de aanvraag
 * @param {string} data.matchId - UUID van de match
 * @returns {string} HTML string
 */
export function matchToegewezenSchoonmaker(data) {
  const {
    schoonmakerNaam,
    klantNaam,
    adres,
    plaats,
    postcode,
    uren,
    dagdelen,
    startdatum,
    autoAssigned,
    aanvraagId,
    matchId
  } = data;

  const assignmentBadge = autoAssigned 
    ? '<div class="warning-badge">⚡ Automatisch toegewezen</div>'
    : '<div class="success-badge">✨ Klant heeft u gekozen!</div>';

  const content = `
    <h2>🎉 Nieuwe Schoonmaak Aanvraag Voor U!</h2>
    
    <p>Beste ${schoonmakerNaam},</p>
    
    <p>Goed nieuws! Er is een nieuwe schoonmaak aanvraag voor u binnengekomen.</p>
    
    ${assignmentBadge}
    
    <p>${autoAssigned 
      ? 'Op basis van uw profiel en beschikbaarheid hebben wij u automatisch toegewezen aan deze aanvraag.' 
      : 'De klant heeft specifiek voor u gekozen op basis van uw profiel en beoordelingen!'}
    </p>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">👤 Klant Informatie</h3>
      <p><strong>Naam:</strong> ${klantNaam}</p>
      <p><strong>Adres:</strong> ${adres}</p>
      <p><strong>Postcode/Plaats:</strong> ${postcode}, ${plaats}</p>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📋 Opdracht Details</h3>
      <table>
        <tr>
          <th>Detail</th>
          <th>Waarde</th>
        </tr>
        <tr>
          <td><strong>Uren per week</strong></td>
          <td>${uren} uur</td>
        </tr>
        <tr>
          <td><strong>Gewenste dagdelen</strong></td>
          <td>${formatDagdelen(dagdelen)}</td>
        </tr>
        <tr>
          <td><strong>Gewenste startweek</strong></td>
          <td>${formatStartWeek(startdatum)}</td>
        </tr>
      </table>
      <p style="font-size: 13px; color: #6b7280; margin-top: 10px; margin-bottom: 0;">
        <em>💡 U spreekt samen met de klant een specifieke dag en tijd af binnen deze week.</em>
      </p>
    </div>
    
    <h3>❓ Wat Moet U Doen?</h3>
    <p>Bekijk de aanvraag en geef aan of u deze kunt accepteren. Als u de opdracht accepteert, wordt de klant op de hoogte gebracht en kunnen jullie samen een dag en tijd afspreken voor de eerste schoonmaakbeurt.</p>
    
    <div style="text-align: center; margin: 40px 0;">
      <p>
        <a href="#" class="button" style="background: #10b981; margin-right: 10px;">
          ✓ Accepteer Aanvraag
        </a>
        <a href="#" class="button" style="background: #ef4444;">
          ✗ Weiger Aanvraag
        </a>
      </p>
    </div>
    
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #92400e;">
        <strong>⏰ Let op:</strong> Reageer binnen 48 uur om de aanvraag niet te missen. Als u niet reageert, kan de aanvraag automatisch worden toegewezen aan een andere schoonmaker.
      </p>
    </div>
    
    <p style="margin-top: 30px;">
      <a href="#" class="button">Bekijk Volledige Details</a>
    </p>
    
    <div class="info-box" style="background: #f0f9ff; border-left-color: #0284c7; margin-top: 40px;">
      <p style="margin: 0; font-size: 13px; color: #0c4a6e;">
        <strong>Match ID:</strong> <code>${matchId}</code><br>
        <strong>Aanvraag ID:</strong> <code>${aanvraagId}</code>
      </p>
    </div>
  `;

  return baseLayout(content, 'Nieuwe Aanvraag - Heppy Schoonmaak');
}
