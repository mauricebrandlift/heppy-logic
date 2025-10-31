/**
 * Email Template: Betaling Bevestiging voor Klant
 * 
 * Wordt verzonden naar klant na succesvolle betaling.
 * Bevestigt de aanvraag en geeft informatie over volgende stappen.
 */

import { baseLayout, formatDatum, formatBedrag, formatDagdelen, formatStartWeek } from './baseLayout.js';

/**
 * Genereer HTML voor betaling bevestiging (Klant)
 * 
 * @param {Object} data - Template data
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.plaats - Plaats waar schoonmaak gewenst is
 * @param {number} data.uren - Aantal gewenste uren per week
 * @param {Array<string>} data.dagdelen - Gewenste dagdelen
 * @param {string} data.startdatum - Gewenste startdatum
 * @param {string} [data.schoonmakerNaam] - Naam van gekozen schoonmaker (optioneel)
 * @param {boolean} [data.autoAssigned] - Of schoonmaker auto-assigned is
 * @param {number} data.bedrag - Betaalde bedrag
 * @param {string} data.betalingId - Payment intent ID
 * @returns {string} HTML string
 */
export function betalingBevestigingKlant(data) {
  const {
    klantNaam,
    plaats,
    uren,
    dagdelen,
    startdatum,
    schoonmakerNaam,
    autoAssigned,
    bedrag,
    betalingId
  } = data;

  const schoonmakerInfo = schoonmakerNaam 
    ? `
      <div class="warning-badge">⏳ Aanvraag verzonden - wacht op goedkeuring</div>
      <p>Uw aanvraag is verzonden naar <strong>${schoonmakerNaam}</strong>. Deze schoonmaker beoordeelt nu uw aanvraag en laat binnen 48 uur weten of de opdracht geaccepteerd wordt.</p>
      <p style="font-size: 14px; color: #6b7280; margin-top: 12px; padding: 12px; background: #f0fdf4; border-left: 3px solid #22c55e; border-radius: 4px;">
        <strong>✓ Geen zorgen:</strong> Mocht deze schoonmaker de aanvraag niet kunnen accepteren, dan zorgen wij direct voor een geschikte vervanger. Zo garanderen we dat u op tijd een schoonmaker heeft voor uw gewenste startweek.
      </p>
    `
    : `
      <div class="warning-badge">⏳ Schoonmaker wordt gezocht</div>
      <p>We zijn momenteel op zoek naar een geschikte schoonmaker voor uw aanvraag. U ontvangt bericht zodra we iemand hebben gevonden.</p>
    `;

  const content = `
    <h2>✅ Betaling Succesvol Ontvangen!</h2>
    
    <p>Beste ${klantNaam},</p>
    
    <p>Bedankt voor uw betaling! Uw aanvraag voor schoonmaakdiensten is succesvol ontvangen en in behandeling genomen.</p>
    
    ${schoonmakerInfo}
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📋 Uw Aanvraag</h3>
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
          <td><strong>Gewenste startweek</strong></td>
          <td>${formatStartWeek(startdatum)}</td>
        </tr>
      </table>
      <p style="font-size: 13px; color: #6b7280; margin-top: 10px; margin-bottom: 0;">
        <em>💡 U spreekt samen met uw schoonmaker een specifieke dag en tijd af binnen deze week.</em>
      </p>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">💳 Betaling Details</h3>
      <p><strong>Bedrag:</strong> ${formatBedrag(bedrag)}</p>
      <p><strong>Status:</strong> <span style="color: #10b981; font-weight: 600;">✓ Betaald</span></p>
      <p><strong>Referentie:</strong> <code style="font-size: 11px;">${betalingId}</code></p>
      <p><strong>Datum:</strong> ${formatDatum(new Date().toISOString())}</p>
    </div>
    
    <h3>📌 Wat gebeurt er nu?</h3>
    <ul>
      <li>✅ Uw betaling is verwerkt</li>
      <li>${schoonmakerNaam ? '📧 De schoonmaker beoordeelt uw aanvraag' : '🔍 We zoeken een geschikte schoonmaker voor u'}</li>
      <li>${schoonmakerNaam ? '⏳ U ontvangt bericht zodra de schoonmaker de aanvraag accepteert' : '⏳ U ontvangt bericht zodra we een match hebben gevonden'}</li>
      <li>📞 Bij vragen kunt u altijd contact met ons opnemen</li>
    </ul>
    
    <p style="margin-top: 30px;">
      <a href="#" class="button">Bekijk Mijn Aanvraag</a>
    </p>
    
    <p style="margin-top: 40px; font-size: 14px; color: #6b7280;">
      <strong>Tip:</strong> U kunt de status van uw aanvraag volgen via uw persoonlijke dashboard.
    </p>
  `;

  return baseLayout(content, 'Betaling Bevestiging - Heppy Schoonmaak');
}
