// api/templates/emails/abonnementGepauzeerdSchoonmaker.js
/**
 * Email template voor schoonmaker: abonnement van klant gepauzeerd
 */

import { emailStyles } from './emailStyles.js';

/**
 * @param {Object} data
 * @param {string} data.voornaam
 * @param {string} data.achternaam
 * @param {string} data.klant_naam
 * @param {string} data.frequentie
 * @param {number} data.uren
 * @param {number} data.startweek
 * @param {number} data.startyear
 * @param {number} data.eindweek
 * @param {number} data.eindjaar
 * @param {string} data.reden
 */
export function abonnementGepauzeerdSchoonmaker(data) {
  const {
    voornaam,
    achternaam,
    klant_naam,
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
      <title>Abonnement van klant gepauzeerd</title>
      ${emailStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Abonnement gepauzeerd</h1>
        </div>
        
        <div class="content">
          <p>Beste ${voornaam} ${achternaam},</p>
          
          <p>Een abonnement van één van je klanten is gepauzeerd.</p>
          
          <div class="info-box">
            <h3>Pauze details</h3>
            <p><strong>Klant:</strong> ${klant_naam}</p>
            <p><strong>Abonnement:</strong> ${frequentie}, ${uren} uur</p>
            <p><strong>Pauze periode:</strong> Week ${startweek} (${startyear}) t/m Week ${eindweek} (${eindjaar})</p>
            <p><strong>Reden:</strong> ${reden}</p>
          </div>

          <p><strong>Wat betekent dit voor jou?</strong></p>
          <ul>
            <li>Je hoeft <strong>geen schoonmaak</strong> uit te voeren tijdens de pauze periode</li>
            <li>Het abonnement wordt <strong>automatisch hervat</strong> na week ${eindweek} (${eindjaar})</li>
            <li>Je ontvangt dan weer opdrachten voor deze klant</li>
          </ul>

          <p>Check je planning in het dashboard voor eventuele andere opdrachten tijdens deze periode.</p>

          <p>Heb je vragen? Neem contact op via <a href="mailto:info@heppy.nl">info@heppy.nl</a>.</p>
          
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
