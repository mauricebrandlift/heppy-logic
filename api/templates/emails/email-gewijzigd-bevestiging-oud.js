/**
 * Email Template: Email Gewijzigd Bevestiging (Oud Adres)
 * 
 * Wordt verzonden naar het OUDE email adres nadat de wijziging is bevestigd.
 * Finale notificatie dat het account email is gewijzigd.
 */

import { baseLayout } from './baseLayout.js';

/**
 * Genereer HTML voor email wijziging bevestiging (Oud Adres)
 * 
 * @param {Object} data - Template data
 * @param {string} data.voornaam - Voornaam van de klant
 * @param {string} data.oudEmail - Oude email adres (dit adres)
 * @param {string} data.nieuwEmail - Nieuwe email adres
 * @returns {string} HTML string
 */
export function emailGewijzigdBevestigingOud(data) {
  const {
    voornaam,
    oudEmail,
    nieuwEmail
  } = data;

  const content = `
    <h2>✓ Je Email Is Gewijzigd</h2>
    
    <p>Beste ${voornaam},</p>
    
    <p>We bevestigen dat het email adres van je Heppy account is gewijzigd.</p>
    
    <div class="info-box">
      <h3>Wijziging Voltooid</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Oude email:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${oudEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px;"><strong>Nieuwe email:</strong></td>
          <td style="padding: 8px;">${nieuwEmail}</td>
        </tr>
      </table>
    </div>
    
    <div style="margin: 30px 0; padding: 20px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
      <p style="margin: 0; color: #856404;">
        <strong>⚠️ Let op:</strong> Je kunt vanaf nu alleen nog inloggen met je nieuwe email adres: <strong>${nieuwEmail}</strong>
      </p>
    </div>
    
    <p>Dit oude email adres (<strong>${oudEmail}</strong>) is niet meer gekoppeld aan je Heppy account.</p>
    
    <div class="warning-box">
      <p><strong>⚠️ Heb je deze wijziging niet zelf uitgevoerd?</strong></p>
      <p>Neem dan direct contact met ons op via <a href="mailto:info@heppy-schoonmaak.nl">info@heppy-schoonmaak.nl</a>.</p>
    </div>
    
    <div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; text-align: center;">
      <p style="margin: 0; color: #666;">
        Dit is de laatste email die je ontvangt op dit adres voor je Heppy account.
      </p>
    </div>
  `;

  return baseLayout(content, 'Je email is gewijzigd - Heppy');
}
