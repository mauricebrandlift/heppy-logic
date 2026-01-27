// api/templates/emails/abonnementGepauzeerdAdmin.js
/**
 * Email template voor admin: abonnement gepauzeerd
 */

import { emailStyles } from './emailStyles.js';

/**
 * @param {Object} data
 * @param {string} data.klant_naam
 * @param {string} data.klant_email
 * @param {string} data.abonnement_id
 * @param {string} data.frequentie
 * @param {number} data.uren
 * @param {number} data.startweek
 * @param {number} data.startyear
 * @param {number} data.eindweek
 * @param {number} data.eindjaar
 * @param {string} data.reden
 */
export function abonnementGepauzeerdAdmin(data) {
  const {
    klant_naam,
    klant_email,
    abonnement_id,
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
      <title>Abonnement Gepauzeerd - Admin Notificatie</title>
      ${emailStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏸️ Abonnement Gepauzeerd</h1>
        </div>
        
        <div class="content">
          <p>Een klant heeft zijn/haar abonnement gepauzeerd.</p>
          
          <div class="info-box">
            <h3>Klant informatie</h3>
            <p><strong>Naam:</strong> ${klant_naam}</p>
            <p><strong>Email:</strong> ${klant_email}</p>
          </div>

          <div class="info-box">
            <h3>Abonnement details</h3>
            <p><strong>ID:</strong> ${abonnement_id}</p>
            <p><strong>Type:</strong> ${frequentie}, ${uren} uur</p>
          </div>

          <div class="info-box">
            <h3>Pauze periode</h3>
            <p><strong>Van:</strong> Week ${startweek} (${startyear})</p>
            <p><strong>Tot:</strong> Week ${eindweek} (${eindjaar})</p>
            <p><strong>Reden:</strong> ${reden}</p>
          </div>

          <p><strong>Acties vereist:</strong></p>
          <ul>
            <li>Check facturatie: vooruitbetaling in mindering brengen</li>
            <li>Automatisch hervatten is ingesteld na week ${eindweek} (${eindjaar})</li>
            <li>Monitor of klant daadwerkelijk hervat of mogelijk opzegt</li>
          </ul>
        </div>
        
        <div class="footer">
          <p>Heppy Admin Notificatie</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
