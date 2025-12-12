/**
 * Email Template: Email Wijziging Aangevraagd (Oud Adres)
 * 
 * Wordt verzonden naar het OUDE email adres wanneer een email wijziging wordt aangevraagd.
 * Beveiligingsnotificatie voor de klant.
 */

import { baseLayout } from './baseLayout.js';

/**
 * Genereer HTML voor email wijziging aanvraag notificatie (Oud Adres)
 * 
 * @param {Object} data - Template data
 * @param {string} data.voornaam - Voornaam van de klant
 * @param {string} data.oudEmail - Huidige (oude) email adres
 * @param {string} data.nieuwEmail - Nieuw aangevraagd email adres
 * @returns {string} HTML string
 */
export function emailWijzigingAangevraagdOud(data) {
  const {
    voornaam,
    oudEmail,
    nieuwEmail
  } = data;

  const content = `
    <h2>🔔 Email Wijziging Aangevraagd</h2>
    
    <p>Beste ${voornaam},</p>
    
    <p>Er is zojuist een verzoek gedaan om het email adres van je Heppy account te wijzigen.</p>
    
    <div class="info-box">
      <h3>Wijziging Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Huidige email:</strong></td>
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
        <strong>⚠️ Let op:</strong> De wijziging wordt pas actief nadat het nieuwe email adres is geverifieerd via de link die naar <strong>${nieuwEmail}</strong> is verstuurd.
      </p>
    </div>
    
    <p>Tot die tijd blijft je huidige email adres (<strong>${oudEmail}</strong>) actief en kun je gewoon inloggen.</p>
    
    <div class="warning-box">
      <p><strong>⚠️ Heb je deze wijziging niet zelf aangevraagd?</strong></p>
      <p>Neem dan direct contact met ons op via <a href="mailto:info@heppy-schoonmaak.nl">info@heppy-schoonmaak.nl</a>.</p>
    </div>
    
    <div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; text-align: center;">
      <p style="margin: 0; color: #666;">
        Dit is een automatische beveiligingsnotificatie van je Heppy account.
      </p>
    </div>
  `;

  return baseLayout(content, 'Email wijziging aangevraagd - Heppy');
}
