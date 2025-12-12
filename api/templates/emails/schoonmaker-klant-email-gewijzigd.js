/**
 * Email Template: Schoonmaker - Klant Email Gewijzigd
 * 
 * Wordt verzonden naar schoonmaker wanneer de email van hun klant is gewijzigd.
 * Informeert de schoonmaker over de nieuwe contactgegevens.
 */

import { baseLayout } from './baseLayout.js';

/**
 * Genereer HTML voor klant email wijziging notificatie (Schoonmaker)
 * 
 * @param {Object} data - Template data
 * @param {string} data.schoonmakerNaam - Voornaam van de schoonmaker
 * @param {string} data.klantNaam - Volledige naam van de klant
 * @param {string} data.oudEmail - Oude email adres van de klant
 * @param {string} data.nieuwEmail - Nieuwe email adres van de klant
 * @param {string} data.abonnementId - UUID van het abonnement
 * @returns {string} HTML string
 */
export function schoonmakerKlantEmailGewijzigd(data) {
  const {
    schoonmakerNaam,
    klantNaam,
    oudEmail,
    nieuwEmail,
    abonnementId
  } = data;

  const content = `
    <h2>📧 Klant Email Gewijzigd</h2>
    
    <p>Beste ${schoonmakerNaam},</p>
    
    <p>Een van je klanten heeft zijn of haar email adres gewijzigd. We willen je hiervan op de hoogte brengen voor je administratie.</p>
    
    <div class="info-box">
      <h3>Nieuwe Contactgegevens</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Klant:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${klantNaam}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Oude email:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${oudEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px;"><strong>Nieuwe email:</strong></td>
          <td style="padding: 8px; color: #2196F3; font-weight: 600;">${nieuwEmail}</td>
        </tr>
      </table>
    </div>
    
    <p>Gebruik vanaf nu dit nieuwe email adres voor communicatie met deze klant. Het adres en andere gegevens blijven ongewijzigd.</p>
    
    <div style="margin: 30px 0; padding: 20px; background: #c9e9b1; border-radius: 8px; text-align: center;">
      <p style="margin: 0; color: #013d29; font-weight: 600;">
        ℹ️ Dit is een automatische notificatie - je hoeft geen actie te ondernemen
      </p>
    </div>
    
    <div style="margin-top: 20px; padding: 20px; background: #f9f9f9; border-radius: 8px; text-align: center;">
      <p style="margin: 0; color: #666;">
        Vragen? Neem contact met ons op via <a href="mailto:info@heppy-schoonmaak.nl">info@heppy-schoonmaak.nl</a>.
      </p>
    </div>
  `;

  return baseLayout(content, 'Klant email gewijzigd - Heppy');
}
