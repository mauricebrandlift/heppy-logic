/**
 * Email Template: Schoonmaker - Klant Naam Gewijzigd
 * 
 * Wordt verzonden naar schoonmaker wanneer de naam van hun klant is gewijzigd.
 * Informeert de schoonmaker over de naamswijziging voor administratie.
 */

import { baseLayout } from './baseLayout.js';

/**
 * Genereer HTML voor klant naam wijziging notificatie (Schoonmaker)
 * 
 * @param {Object} data - Template data
 * @param {string} data.schoonmakerNaam - Voornaam van de schoonmaker
 * @param {string} data.oudeNaam - Oude volledige naam van de klant
 * @param {string} data.nieuweNaam - Nieuwe volledige naam van de klant
 * @param {string} data.abonnementId - UUID van het abonnement
 * @returns {string} HTML string
 */
export function schoonmakerKlantNaamGewijzigd(data) {
  const {
    schoonmakerNaam,
    oudeNaam,
    nieuweNaam,
    abonnementId
  } = data;

  const content = `
    <h2>📝 Klant Naam Gewijzigd</h2>
    
    <p>Beste ${schoonmakerNaam},</p>
    
    <p>Een van je klanten heeft zijn of haar naam gewijzigd. We willen je hiervan op de hoogte brengen voor je administratie.</p>
    
    <div class="info-box">
      <h3>Naamswijziging</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Oude naam:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${oudeNaam}</td>
        </tr>
        <tr>
          <td style="padding: 8px;"><strong>Nieuwe naam:</strong></td>
          <td style="padding: 8px;">${nieuweNaam}</td>
        </tr>
      </table>
    </div>
    
    <p>De wijziging is direct actief in het systeem. Het adres en andere gegevens van de klant blijven ongewijzigd.</p>
    
    <div style="margin-top: 30px; padding: 20px; background: #c9e9b1; border-radius: 8px; text-align: center;">
      <p style="margin: 0; color: #013d29; font-weight: 600;">
        ℹ️ Dit is een automatische notificatie - je hoeft geen actie te ondernemen
      </p>
    </div>
    
    <div style="margin-top: 20px; padding: 20px; background: #f9f9f9; border-radius: 8px; text-align: center;">
      <p style="margin: 0; color: #666;">
        Vragen? Neem contact met ons op via <a href="mailto:info@heppy-schoonmaak.nl">info@heppy-schoonmaak.nl</a>
      </p>
    </div>
  `;

  return baseLayout(content, 'Klant naam gewijzigd - Heppy');
}
