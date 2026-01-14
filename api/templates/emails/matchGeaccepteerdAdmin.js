/**
 * Email Template: Match Geaccepteerd - Notificatie voor Admin
 * 
 * Wordt verzonden naar admin nadat schoonmaker de match heeft geaccepteerd.
 * Werkt voor zowel aanvragen (abonnementen) als opdrachten (eenmalige schoonmaak).
 */

import { baseLayout, formatDatum } from './baseLayout.js';

/**
 * Genereer HTML voor match geaccepteerd notificatie (Admin)
 * 
 * @param {Object} data - Template data
 * @param {string} data.schoonmakerNaam - Volledige naam van schoonmaker
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.type - 'aanvraag' of 'opdracht'
 * @param {string} [data.typeNaam] - Specifiek type opdracht (Dieptereiniging, Verhuis, etc.)
 * @param {string} data.plaats - Plaats waar schoonmaak plaatsvindt
 * @param {string} data.adres - Volledig adres
 * @param {number} [data.uren] - Aantal uren
 * @param {string} [data.frequentie] - Frequentie voor abonnementen
 * @param {string} [data.gewensteDatum] - Gewenste datum voor opdrachten
 * @param {string} data.matchId - UUID van match
 * @param {string} [data.aanvraagId] - UUID van aanvraag (indien van toepassing)
 * @param {string} [data.opdrachtId] - UUID van opdracht (indien van toepassing)
 * @param {string} [data.klantEmail] - Email klant
 * @param {string} [data.schoonmakerEmail] - Email schoonmaker
 * @returns {string} HTML string
 */
export function matchGeaccepteerdAdmin(data) {
  const {
    schoonmakerNaam,
    klantNaam,
    type,
    typeNaam,
    plaats,
    adres,
    uren,
    frequentie,
    gewensteDatum,
    matchId,
    aanvraagId,
    opdrachtId,
    klantEmail,
    schoonmakerEmail
  } = data;

  const isAanvraag = type === 'aanvraag';
  const typeLabel = isAanvraag ? 'Schoonmaak Abonnement' : (typeNaam || 'Eenmalige Schoonmaak');

  const opdrachtDetails = [];
  if (uren) opdrachtDetails.push(`${uren} uur${isAanvraag ? ' per schoonmaak' : ''}`);
  if (frequentie && isAanvraag) opdrachtDetails.push(frequentie);

  const content = `
    <h2>✅ Match Geaccepteerd</h2>
    
    <p><strong>${schoonmakerNaam}</strong> heeft de match geaccepteerd!</p>
    
    <div class="info-box" style="background: #f0fdf4; border-left: 3px solid #22c55e;">
      <h3 style="margin-top: 0;">📋 Match Details</h3>
      <table>
        <tr>
          <th>Detail</th>
          <th>Waarde</th>
        </tr>
        <tr>
          <td><strong>Status</strong></td>
          <td><span style="color: #22c55e; font-weight: 600;">✓ Geaccepteerd</span></td>
        </tr>
        <tr>
          <td><strong>Type</strong></td>
          <td>${typeLabel}</td>
        </tr>
        <tr>
          <td><strong>Schoonmaker</strong></td>
          <td>${schoonmakerNaam}${schoonmakerEmail ? `<br><span style="font-size: 14px; color: #6b7280;">${schoonmakerEmail}</span>` : ''}</td>
        </tr>
        <tr>
          <td><strong>Klant</strong></td>
          <td>${klantNaam}${klantEmail ? `<br><span style="font-size: 14px; color: #6b7280;">${klantEmail}</span>` : ''}</td>
        </tr>
        <tr>
          <td><strong>Locatie</strong></td>
          <td>${plaats}<br><span style="font-size: 14px; color: #6b7280;">${adres}</span></td>
        </tr>
        ${opdrachtDetails.length > 0 ? `
        <tr>
          <td><strong>${isAanvraag ? 'Abonnement' : 'Opdracht'}</strong></td>
          <td>${opdrachtDetails.join(', ')}</td>
        </tr>
        ` : ''}
        ${gewensteDatum && !isAanvraag ? `
        <tr>
          <td><strong>Gewenste datum</strong></td>
          <td>${formatDatum(gewensteDatum)}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">🔗 Referenties</h3>
      <p><strong>Match ID:</strong> <code style="font-size: 11px;">${matchId}</code></p>
      ${aanvraagId ? `<p><strong>Aanvraag ID:</strong> <code style="font-size: 11px;">${aanvraagId}</code></p>` : ''}
      ${opdrachtId ? `<p><strong>Opdracht ID:</strong> <code style="font-size: 11px;">${opdrachtId}</code></p>` : ''}
    </div>
    
    <h3>📌 Acties Ondernomen</h3>
    <ul>
      <li>✅ Match status bijgewerkt naar "geaccepteerd"</li>
      <li>✅ ${isAanvraag ? 'Abonnement status bijgewerkt naar "actief"' : 'Opdracht status bijgewerkt naar "gepland"'}</li>
      <li>✅ Schoonmaker toegewezen aan ${isAanvraag ? 'abonnement' : 'opdracht'}</li>
      <li>📧 Bevestigingsmail verzonden naar klant</li>
      <li>📧 Bevestigingsmail verzonden naar schoonmaker</li>
    </ul>
    
    <h3>⏭️ Volgende Stappen</h3>
    <p>${isAanvraag 
      ? 'De schoonmaker neemt contact op met de klant om de vaste dag(en) en starttijd af te spreken.' 
      : 'De schoonmaker neemt contact op met de klant om de exacte tijd af te spreken en de opdracht uit te voeren.'
    }</p>
    
    <div class="info-box" style="background: #fef3c7; border-left: 3px solid #f59e0b;">
      <p style="margin: 0;"><strong>⚠️ Let op:</strong> Monitor of de schoonmaker inderdaad contact opneemt binnen 24-48 uur. Bij problemen, neem direct actie.</p>
    </div>
  `;

  return baseLayout(content, 'Match Geaccepteerd - Heppy Admin');
}
