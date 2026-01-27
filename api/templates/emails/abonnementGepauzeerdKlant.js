// api/templates/emails/abonnementGepauzeerdKlant.js
/**
 * Email template voor klant: abonnement gepauzeerd
 */

import { emailStyles } from './emailStyles.js';

/**
 * @param {Object} data
 * @param {string} data.voornaam
 * @param {string} data.achternaam
 * @param {string} data.frequentie
 * @param {number} data.uren
 * @param {number} data.startweek
 * @param {number} data.startyear
 * @param {number} data.eindweek
 * @param {number} data.eindjaar
 * @param {string} data.reden
 */
export function abonnementGepauzeerdKlant(data) {
  const {
    voornaam,
    achternaam,
    frequentie,
    uren,
    startweek,
    startyear,
    eindweek,
    eindjaar,
    reden
  } = data;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Je abonnement is gepauzeerd</title>
      ${emailStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Je abonnement is gepauzeerd</h1>
        </div>
        
        <div class="content">
          <p>Beste ${voornaam} ${achternaam},</p>
          
          <p>Je abonnement is succesvol gepauzeerd.</p>
          
          <div class="info-box">
            <h3>Pauze details</h3>
            <p><strong>Abonnement:</strong> ${frequentie}, ${uren} uur</p>
            <p><strong>Pauze periode:</strong> Week ${startweek} (${startyear}) t/m Week ${eindweek} (${eindjaar})</p>
            <p><strong>Reden:</strong> ${reden}</p>
          </div>

          <p><strong>Wat betekent dit?</strong></p>
          <ul>
            <li>Er wordt <strong>geen schoonmaak</strong> uitgevoerd tijdens de pauze periode</li>
            <li>Je ontvangt <strong>geen facturen</strong> voor de gepauzeerde weken</li>
            <li>Als je al vooruitbetaald hebt, wordt dit in mindering gebracht op je volgende factuur</li>
            <li>Je abonnement wordt <strong>automatisch hervat</strong> na week ${eindweek} (${eindjaar})</li>
          </ul>

          <p>Heb je vragen? Neem gerust contact met ons op via <a href="mailto:info@heppy.nl">info@heppy.nl</a>.</p>
          
          <p>Met vriendelijke groet,<br>
          Team Heppy</p>
        </div>
        
        <div class="footer">
          <p>Heppy Schoonmaakdiensten<br>
          Email: <a href="mailto:info@heppy.nl">info@heppy.nl</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}
