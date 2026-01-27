// api/templates/emails/abonnementGepauzeerdKlant.js
/**
 * Email template voor klant: abonnement gepauzeerd
 */

import { baseLayout } from './baseLayout.js';

/**
 * @param {Object} data
 * @param {string} data.voornaam
 * @param {string} data.achternaam
 * @param {string} data.frequentie
 * @param {number} data.uren
 * @param {number} data.laatsteSchoonmaakWeek
 * @param {number} data.laatsteSchoonmaakJaar
 * @param {number} data.eersteSchoonmaakWeek
 * @param {number} data.eersteSchoonmaakJaar
 * @param {string} data.reden
 */
export function abonnementGepauzeerdKlant(data) {
  const {
    voornaam,
    achternaam,
    frequentie,
    uren,
    laatsteSchoonmaakWeek,
    laatsteSchoonmaakJaar,
    eersteSchoonmaakWeek,
    eersteSchoonmaakJaar,
    reden
  } = data;

  const content = `
          <p>Beste ${voornaam} ${achternaam},</p>
          
          <p>Je schoonmaakpauze is succesvol ingepland.</p>
          
          <div class="info-box">
            <h3>Pauze details</h3>
            <p><strong>Abonnement:</strong> ${frequentie}, ${uren} uur</p>
            <p><strong>Laatste schoonmaak:</strong> Week ${laatsteSchoonmaakWeek} (${laatsteSchoonmaakJaar})</p>
            <p><strong>Eerste schoonmaak na pauze:</strong> Week ${eersteSchoonmaakWeek} (${eersteSchoonmaakJaar})</p>
            <p><strong>Reden:</strong> ${reden}</p>
          </div>

          <p><strong>Wat betekent dit?</strong></p>
          <ul>
            <li>Er wordt <strong>geen schoonmaak</strong> uitgevoerd tussen week ${laatsteSchoonmaakWeek} en ${eersteSchoonmaakWeek}</li>
            <li>Je ontvangt <strong>geen facturen</strong> voor de gemiste schoonmaakbeurten</li>
            <li>Als je al vooruitbetaald hebt, wordt dit in mindering gebracht op je volgende factuur</li>
            <li>De schoonmaak wordt <strong>automatisch hervat</strong> in week ${eersteSchoonmaakWeek} (${eersteSchoonmaakJaar})</li>
          </ul>

          <p>Heb je vragen? Neem gerust contact met ons op via <a href="mailto:info@heppy.nl">info@heppy.nl</a>.</p>
          
          <p>Met vriendelijke groet,<br>
          Team Heppy</p>
  `;

  return baseLayout(content, 'Je abonnement is gepauzeerd');
}
