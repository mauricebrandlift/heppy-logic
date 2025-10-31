/**
 * Email Template: Match Goedgekeurd (Klant)
 * 
 * Wordt verzonden naar klant wanneer schoonmaker de aanvraag accepteert.
 * Bevestigt de match en geeft informatie over de schoonmaker.
 */

import { baseLayout, formatDatum, formatStartWeek, formatDagdelen } from './baseLayout.js';

/**
 * Genereer HTML voor match goedgekeurd notificatie (Klant)
 * 
 * @param {Object} data - Template data
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.schoonmakerNaam - Naam van de schoonmaker
 * @param {string} [data.schoonmakerFoto] - URL naar schoonmaker foto (optioneel)
 * @param {string} [data.schoonmakerBio] - Bio van schoonmaker
 * @param {string} data.startdatum - Gewenste startdatum
 * @param {number} data.uren - Aantal uren per week
 * @param {Object|Array} data.dagdelen - Gewenste dagdelen
 * @param {string} data.plaats - Plaats waar schoonmaak plaatsvindt
 * @param {string} data.aanvraagId - UUID van de aanvraag
 * @param {string} data.matchId - UUID van de match
 * @returns {string} HTML string
 */
export function matchGoedgekeurdKlant(data) {
  const {
    klantNaam,
    schoonmakerNaam,
    schoonmakerFoto,
    schoonmakerBio,
    startdatum,
    uren,
    dagdelen,
    plaats,
    aanvraagId,
    matchId
  } = data;

  const content = `
    <h2>🎉 Goed Nieuws! Je Schoonmaker Heeft Geaccepteerd</h2>
    
    <p>Beste ${klantNaam},</p>
    
    <p>Super nieuws! <strong>${schoonmakerNaam}</strong> heeft je aanvraag geaccepteerd en komt graag bij je schoonmaken!</p>
    
    <div class="success-badge">✓ Match Bevestigd</div>
    
    ${schoonmakerFoto ? `
    <div style="text-align: center; margin: 30px 0;">
      <img src="${schoonmakerFoto}" alt="${schoonmakerNaam}" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid #667eea;">
    </div>
    ` : ''}
    
    <div class="info-box">
      <h3 style="margin-top: 0;">👤 Jouw Schoonmaker</h3>
      <p><strong>Naam:</strong> ${schoonmakerNaam}</p>
      ${schoonmakerBio ? `<p><strong>Over ${schoonmakerNaam.split(' ')[0]}:</strong><br>${schoonmakerBio}</p>` : ''}
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📅 Afspraak Details</h3>
      <table>
        <tr>
          <th>Detail</th>
          <th>Waarde</th>
        </tr>
        <tr>
          <td><strong>Startweek</strong></td>
          <td>${formatStartWeek(startdatum)}</td>
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
      </table>
      <p style="font-size: 13px; color: #6b7280; margin-top: 10px; margin-bottom: 0;">
        <em>💡 U spreekt samen met ${schoonmakerNaam.split(' ')[0]} een specifieke dag en tijd af binnen deze week.</em>
      </p>
    </div>
    
    <h3>📌 Wat Gebeurt Er Nu?</h3>
    <ul>
      <li>✓ Je abonnement is actief en start in ${formatStartWeek(startdatum)}</li>
      <li>📞 ${schoonmakerNaam} neemt binnenkort contact met je op om een specifieke dag en tijd af te spreken</li>
      <li>🗓️ Jullie plannen samen de eerste schoonmaakbeurt in</li>
      <li>📱 Je kunt de planning volgen in je persoonlijke dashboard</li>
    </ul>
    
    <div class="info-box" style="background: #fef3c7; border-left-color: #f59e0b;">
      <h3 style="margin-top: 0; color: #f59e0b;">💡 Tip: Eerste Afspraak</h3>
      <p>Het is handig om bij de eerste schoonmaakbeurt thuis te zijn. Zo kun je:</p>
      <ul style="margin-bottom: 0;">
        <li>De woning rondleiden</li>
        <li>Speciale wensen bespreken</li>
        <li>Eventuele aandachtspunten aangeven</li>
      </ul>
    </div>
    
    <p style="margin-top: 30px;">
      <a href="#" class="button">Bekijk Mijn Dashboard</a>
    </p>
    
    <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
      <strong>Vragen?</strong> Je kunt altijd contact met ons opnemen via de reply op deze email.
    </p>
    
    <div style="margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 6px; font-size: 12px; color: #6b7280;">
      <strong>Referentie:</strong><br>
      Match ID: ${matchId}<br>
      Aanvraag ID: ${aanvraagId}
    </div>
  `;

  return baseLayout(content, 'Match Bevestigd - Heppy Schoonmaak');
}
