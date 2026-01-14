/**
 * Email Template: Match Afgewezen - Bevestiging voor Schoonmaker
 * 
 * Wordt verzonden naar schoonmaker nadat deze de match heeft afgewezen.
 * Bevestigt de afwijzing en bedankt voor de snelle reactie.
 */

import { baseLayout } from './baseLayout.js';

/**
 * Genereer HTML voor match afgewezen bevestiging (Schoonmaker)
 * 
 * @param {Object} data - Template data
 * @param {string} data.schoonmakerNaam - Volledige naam van schoonmaker
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.type - 'aanvraag' of 'opdracht'
 * @param {string} [data.typeNaam] - Specifiek type opdracht
 * @param {string} data.plaats - Plaats waar schoonmaak plaatsvindt
 * @param {string} data.reden - Reden van afwijzing
 * @returns {string} HTML string
 */
export function matchAfgewezenSchoonmaker(data) {
  const {
    schoonmakerNaam,
    klantNaam,
    type,
    typeNaam,
    plaats,
    reden
  } = data;

  const isAanvraag = type === 'aanvraag';
  const typeLabel = isAanvraag ? 'Schoonmaak Abonnement' : (typeNaam || 'Eenmalige Schoonmaak');

  const content = `
    <h2>Afwijzing Bevestigd</h2>
    
    <p>Beste ${schoonmakerNaam},</p>
    
    <p>Bedankt voor je snelle reactie. We hebben je afwijzing ontvangen en geregistreerd.</p>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📋 Afgewezen ${isAanvraag ? 'Aanvraag' : 'Opdracht'}</h3>
      <table>
        <tr>
          <th>Detail</th>
          <th>Waarde</th>
        </tr>
        <tr>
          <td><strong>Type</strong></td>
          <td>${typeLabel}</td>
        </tr>
        <tr>
          <td><strong>Klant</strong></td>
          <td>${klantNaam}</td>
        </tr>
        <tr>
          <td><strong>Locatie</strong></td>
          <td>${plaats}</td>
        </tr>
        ${reden ? `
        <tr>
          <td><strong>Jouw reden</strong></td>
          <td>${reden}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    <div class="info-box" style="background: #f0fdf4; border-left: 3px solid #22c55e;">
      <h3 style="margin-top: 0;">✅ Actie Ondernomen</h3>
      <ul style="margin: 8px 0 0 0; padding-left: 20px;">
        <li>Je afwijzing is geregistreerd</li>
        <li>We zoeken een andere schoonmaker voor deze klant</li>
        <li>Je hoeft verder niets te doen</li>
      </ul>
    </div>
    
    <h3>💡 Feedback (optioneel)</h3>
    <p>Was er een specifieke reden dat deze ${isAanvraag ? 'aanvraag' : 'opdracht'} niet bij je paste? Laat het ons weten via <a href="mailto:info@heppy.nl">info@heppy.nl</a>, dan kunnen we in de toekomst beter matchen!</p>
    
    <p>Voorbeelden:</p>
    <ul>
      <li>Te ver van mijn locatie</li>
      <li>Geen tijd op de gewenste datum</li>
      <li>Type schoonmaak past niet bij mijn expertise</li>
      <li>Planning conflict</li>
    </ul>
    
    <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; text-align: center;">
      <p style="color: white; margin: 0; font-size: 16px; font-weight: 600;">Bedankt voor je eerlijkheid! We sturen je binnenkort weer nieuwe opdrachten. 👍</p>
    </div>
  `;

  return baseLayout(content, 'Afwijzing Bevestigd - Heppy Schoonmaak');
}
