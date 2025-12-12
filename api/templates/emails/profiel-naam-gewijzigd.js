/**
 * Email Template: Profiel Naam Gewijzigd (Klant)
 * 
 * Wordt verzonden naar klant wanneer voornaam of achternaam is gewijzigd.
 * Bevestigt de wijziging voor de administratie van de klant.
 */

import { baseLayout } from './baseLayout.js';

/**
 * Genereer HTML voor profiel naam wijziging notificatie (Klant)
 * 
 * @param {Object} data - Template data
 * @param {string} data.voornaam - Nieuwe voornaam
 * @param {string} data.achternaam - Nieuwe achternaam
 * @param {string} data.oudeVoornaam - Oude voornaam
 * @param {string} data.oudeAchternaam - Oude achternaam
 * @returns {string} HTML string
 */
export function profielNaamGewijzigd(data) {
  const {
    voornaam,
    achternaam,
    oudeVoornaam,
    oudeAchternaam
  } = data;

  const content = `
    <h2>✓ Je naam is gewijzigd</h2>
    
    <p>Beste ${voornaam},</p>
    
    <p>We bevestigen dat je naam is gewijzigd in je Heppy account.</p>
    
    <div class="info-box">
      <h3>Wijziging Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Oude naam:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${oudeVoornaam} ${oudeAchternaam}</td>
        </tr>
        <tr>
          <td style="padding: 8px;"><strong>Nieuwe naam:</strong></td>
          <td style="padding: 8px;">${voornaam} ${achternaam}</td>
        </tr>
      </table>
    </div>
    
    <p>Deze wijziging is direct actief in je account.</p>
    
    <div class="warning-box">
      <p><strong>⚠️ Heb je deze wijziging niet zelf uitgevoerd?</strong></p>
      <p>Neem dan direct contact met ons op via <a href="mailto:info@heppy-schoonmaak.nl">info@heppy-schoonmaak.nl</a> of bel naar <strong>088 - 4377 900</strong>.</p>
    </div>
    
    <div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; text-align: center;">
      <p style="margin: 0; color: #666;">
        Je kunt je account beheren via je dashboard op onze website.
      </p>
    </div>
  `;

  return baseLayout(content, 'Je naam is gewijzigd - Heppy');
}
