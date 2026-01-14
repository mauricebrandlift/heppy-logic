/**
 * Email Template: Schoonmaker Weigert Match - Notificatie voor Admin
 * 
 * Wordt verzonden naar admin nadat EEN schoonmaker de match heeft afgewezen.
 * Vereist actie: nieuwe schoonmaker zoeken.
 */

import { baseLayout, formatDatum } from './baseLayout.js';

/**
 * Genereer HTML voor schoonmaker weigert match notificatie (Admin)
 * 
 * @param {Object} data - Template data
 * @param {string} data.schoonmakerNaam - Volledige naam van schoonmaker
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.type - 'aanvraag' of 'opdracht'
 * @param {string} [data.typeNaam] - Specifiek type opdracht
 * @param {string} data.plaats - Plaats waar schoonmaak plaatsvindt
 * @param {string} data.adres - Volledig adres
 * @param {number} [data.uren] - Aantal uren
 * @param {string} [data.frequentie] - Frequentie voor abonnementen
 * @param {string} [data.gewensteDatum] - Gewenste datum voor opdrachten
 * @param {string} data.reden - Reden van afwijzing
 * @param {string} data.matchId - UUID van match
 * @param {string} [data.aanvraagId] - UUID van aanvraag (indien van toepassing)
 * @param {string} [data.opdrachtId] - UUID van opdracht (indien van toepassing)
 * @param {string} [data.klantEmail] - Email klant
 * @param {string} [data.schoonmakerEmail] - Email schoonmaker
 * @returns {string} HTML string
 */
export function schoonmakerWeigertAdmin(data) {
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
    reden,
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

  const urgentie = !isAanvraag && gewensteDatum 
    ? `<div class="info-box" style="background: #fee2e2; border-left: 3px solid #ef4444;">
        <p style="margin: 0; color: #991b1b;"><strong>⚠️ URGENT:</strong> Gewenste datum is ${formatDatum(gewensteDatum)} - Zoek snel een vervanging!</p>
      </div>`
    : '';

  const content = `
    <h2>� Match Afgewezen - Ter Informatie</h2>
    
    <p><strong>${schoonmakerNaam}</strong> heeft de match afgewezen. Het systeem zoekt automatisch een nieuwe schoonmaker.</p>
    
    ${urgentie}
    
    <div class="info-box" style="background: #fef3c7; border-left: 3px solid #f59e0b;">
      <h3 style="margin-top: 0;">📋 Match Details</h3>
      <table>
        <tr>
          <th>Detail</th>
          <th>Waarde</th>
        </tr>
        <tr>
          <td><strong>Status</strong></td>
          <td><span style="color: #ef4444; font-weight: 600;">✗ Afgewezen</span></td>
        </tr>
        <tr>
          <td><strong>Type</strong></td>
          <td>${typeLabel}</td>
        </tr>
        <tr>
          <td><strong>Afgewezen door</strong></td>
          <td>${schoonmakerNaam}${schoonmakerEmail ? `<br><span style="font-size: 14px; color: #6b7280;">${schoonmakerEmail}</span>` : ''}</td>
        </tr>
        <tr>
          <td><strong>Reden afwijzing</strong></td>
          <td><em>${reden || 'Geen reden opgegeven'}</em></td>
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
      <p><strong>Match ID:</strong> <code style="font-size: 11px;">${matchId || 'Onbekend'}</code></p>
      ${aanvraagId ? `<p><strong>Aanvraag ID:</strong> <code style="font-size: 11px;">${aanvraagId}</code></p>` : ''}
      ${opdrachtId ? `<p><strong>Opdracht ID:</strong> <code style="font-size: 11px;">${opdrachtId}</code></p>` : ''}
    </div>
    
    <h3>✅ Acties Ondernomen</h3>
    <ul>
      <li>✅ Match status bijgewerkt naar "geweigerd"</li>
      <li>✅ Afwijzingsreden geregistreerd</li>
      <li>📧 Bevestigingsmail verzonden naar schoonmaker</li>
      <li>📧 Informatiemail verzonden naar klant (we zoeken een nieuwe schoonmaker)</li>
      <li>🔄 Systeem zoekt automatisch naar een nieuwe schoonmaker</li>
    </ul>
    
    <h3>ℹ️ Wat Gebeurt Er Nu?</h3>
    <div class="info-box" style="background: #e0f2fe; border-left: 3px solid #0ea5e9;">
      <p style="margin: 0 0 12px 0;">Het matching systeem probeert automatisch een nieuwe schoonmaker te vinden voor deze ${isAanvraag ? 'aanvraag' : 'opdracht'}.</p>
      <ul style="margin: 0; padding-left: 20px;">
        <li>Als er beschikbare schoonmakers zijn, wordt er automatisch een nieuwe match aangemaakt</li>
        <li>De nieuwe schoonmaker ontvangt ook een email om te accepteren of afwijzen</li>
        ${!isAanvraag && gewensteDatum ? `<li><strong>Let op:</strong> Gewenste datum is ${formatDatum(gewensteDatum)} - houd dit in de gaten</li>` : ''}
        <li>Alleen ingrijpen als er geen geschikte schoonmakers beschikbaar zijn</li>
      </ul>
    </div>
  `;

  return baseLayout(content, 'Match Afgewezen - Ter Informatie - Heppy Admin');
}
