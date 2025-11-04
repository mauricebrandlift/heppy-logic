/**
 * Email Template: Dieptereiniging Bevestiging voor Klant
 * 
 * Wordt verzonden naar klant na succesvolle betaling van dieptereiniging.
 * Bevestigt de opdracht en geeft informatie over volgende stappen.
 */

import { baseLayout, formatDatum, formatBedrag } from './baseLayout.js';

/**
 * Genereer HTML voor dieptereiniging bevestiging (Klant)
 * 
 * @param {Object} data - Template data
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.plaats - Plaats waar schoonmaak gewenst is
 * @param {number} data.uren - Aantal uren voor dieptereiniging
 * @param {number} [data.m2] - Aantal vierkante meters
 * @param {number} [data.toiletten] - Aantal toiletten
 * @param {number} [data.badkamers] - Aantal badkamers
 * @param {string} data.gewensteDatum - Gewenste datum voor uitvoering
 * @param {string} [data.schoonmakerNaam] - Naam van gekozen schoonmaker (optioneel)
 * @param {boolean} [data.autoAssigned] - Of schoonmaker auto-assigned is
 * @param {number} data.bedrag - Betaalde bedrag
 * @param {string} data.betalingId - Payment intent ID
 * @param {string} data.opdrachtId - UUID van de opdracht
 * @returns {string} HTML string
 */
export function dieptereinigingBevestigingKlant(data) {
  const {
    klantNaam,
    plaats,
    uren,
    m2,
    toiletten,
    badkamers,
    gewensteDatum,
    schoonmakerNaam,
    autoAssigned,
    bedrag,
    betalingId,
    opdrachtId
  } = data;

  const schoonmakerInfo = schoonmakerNaam 
    ? `
      <div class="warning-badge">⏳ Opdracht toegewezen - wacht op bevestiging</div>
      <p>Uw opdracht is toegewezen aan <strong>${schoonmakerNaam}</strong>. Deze schoonmaker beoordeelt nu uw opdracht en neemt binnen 48 uur contact met u op om de exacte tijd af te spreken.</p>
      <p style="font-size: 14px; color: #6b7280; margin-top: 12px; padding: 12px; background: #f0fdf4; border-left: 3px solid #22c55e; border-radius: 4px;">
        <strong>✓ Geen zorgen:</strong> Mocht deze schoonmaker de opdracht niet kunnen accepteren, dan zorgen wij direct voor een geschikte vervanger. Zo garanderen we dat uw dieptereiniging op tijd wordt uitgevoerd.
      </p>
    `
    : `
      <div class="warning-badge">⏳ Schoonmaker wordt gezocht</div>
      <p>We zijn momenteel op zoek naar een geschikte schoonmaker voor uw dieptereiniging. U ontvangt bericht zodra we iemand hebben gevonden.</p>
    `;

  const opdrachtDetails = [];
  if (m2) opdrachtDetails.push(`${m2} m²`);
  if (toiletten) opdrachtDetails.push(`${toiletten} toilet${toiletten > 1 ? 'ten' : ''}`);
  if (badkamers) opdrachtDetails.push(`${badkamers} badkamer${badkamers > 1 ? 's' : ''}`);
  const opdrachtOmschrijving = opdrachtDetails.length > 0 
    ? ` (${opdrachtDetails.join(', ')})` 
    : '';

  const content = `
    <h2>✅ Betaling Succesvol Ontvangen!</h2>
    
    <p>Beste ${klantNaam},</p>
    
    <p>Bedankt voor uw betaling! Uw opdracht voor een dieptereiniging is succesvol ontvangen en in behandeling genomen.</p>
    
    ${schoonmakerInfo}
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📋 Uw Opdracht</h3>
      <table>
        <tr>
          <th>Detail</th>
          <th>Waarde</th>
        </tr>
        <tr>
          <td><strong>Type</strong></td>
          <td>Dieptereiniging (eenmalig)</td>
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
          <td>${uren} uur${opdrachtOmschrijving}</td>
        </tr>
        ${schoonmakerNaam ? `
        <tr>
          <td><strong>Schoonmaker</strong></td>
          <td>${schoonmakerNaam}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">💳 Betaling Details</h3>
      <p><strong>Bedrag:</strong> ${formatBedrag(bedrag)}</p>
      <p><strong>Status:</strong> <span style="color: #10b981; font-weight: 600;">✓ Betaald</span></p>
      <p><strong>Referentie:</strong> <code style="font-size: 11px;">${betalingId}</code></p>
      <p><strong>Datum:</strong> ${formatDatum(new Date().toISOString())}</p>
      <p><strong>Opdracht nummer:</strong> <code style="font-size: 11px;">${opdrachtId.substring(0, 8)}</code></p>
    </div>
    
    <h3>📌 Wat gebeurt er nu?</h3>
    <ul>
      <li>✅ Uw betaling is verwerkt</li>
      <li>${schoonmakerNaam ? '📧 De schoonmaker beoordeelt uw opdracht' : '🔍 We zoeken een geschikte schoonmaker voor u'}</li>
      <li>📞 De schoonmaker neemt contact met u op om de exacte tijd af te spreken</li>
      <li>🧹 De dieptereiniging wordt uitgevoerd op de afgesproken datum en tijd</li>
      <li>💬 U ontvangt een verzoek voor feedback na afloop</li>
    </ul>
    
    <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 30px 0; border-radius: 4px;">
      <p style="margin: 0; color: #1e40af;">
        <strong>💡 Tip:</strong> Zorg dat de ruimte toegankelijk is en verwijder waardevolle voorwerpen. De schoonmaker neemt eigen schoonmaakmiddelen mee, tenzij u specifieke producten wilt dat hij/zij gebruikt.
      </p>
    </div>
    
    <p style="margin-top: 30px;">
      <a href="#" class="button">Bekijk Mijn Opdracht</a>
    </p>
    
    <p style="margin-top: 40px; font-size: 14px; color: #6b7280;">
      <strong>Vragen?</strong> Neem gerust contact met ons op. We helpen u graag verder!
    </p>
  `;

  return baseLayout(content, 'Dieptereiniging Bevestiging - Heppy Schoonmaak');
}
