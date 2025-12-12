/**
 * Email Template: Email Wijziging Verificatie (Nieuw Adres)
 * 
 * Wordt verzonden naar het NIEUWE email adres met verificatie link.
 * Klant moet op link klikken om email wijziging te bevestigen.
 */

import { baseLayout } from './baseLayout.js';

/**
 * Genereer HTML voor email verificatie (Nieuw Adres)
 * 
 * @param {Object} data - Template data
 * @param {string} data.voornaam - Voornaam van de klant
 * @param {string} data.verificatieLink - Volledige URL voor verificatie
 * @param {string} data.expiresAt - Verloopdatum/tijd van de link
 * @returns {string} HTML string
 */
export function emailWijzigingVerificatieNieuw(data) {
  const {
    voornaam,
    verificatieLink,
    expiresAt
  } = data;

  const content = `
    <h2>📧 Bevestig Je Nieuwe Email Adres</h2>
    
    <p>Beste ${voornaam},</p>
    
    <p>Je hebt zojuist een verzoek gedaan om je Heppy email adres te wijzigen naar dit email adres.</p>
    
    <p>Klik op de knop hieronder om je nieuwe email adres te bevestigen:</p>
    
    <div style="text-align: center; margin: 40px 0;">
      <a href="${verificatieLink}" 
         style="display: inline-block; background: #c9e9b1; color: #013d29; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        ✓ Bevestig Nieuwe Email
      </a>
    </div>
    
    <div style="margin: 30px 0; padding: 20px; background: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 4px;">
      <p style="margin: 0; color: #014361;">
        <strong>ℹ️ Belangrijk:</strong> Deze link is geldig tot <strong>${expiresAt}</strong>. Daarna moet je een nieuwe email wijziging aanvragen.
      </p>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      <strong>Lukt de knop niet?</strong><br>
      Kopieer deze link naar je browser:<br>
      <a href="${verificatieLink}" style="word-break: break-all; color: #2196F3;">${verificatieLink}</a>
    </p>
    
    <div class="warning-box">
      <p><strong>⚠️ Heb je deze wijziging niet zelf aangevraagd?</strong></p>
      <p>Negeer dan deze email en neem contact met ons op via <a href="mailto:info@heppy-schoonmaak.nl">info@heppy-schoonmaak.nl</a>.</p>
    </div>
    
    <div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; text-align: center;">
      <p style="margin: 0; color: #666; font-size: 14px;">
        Je oude email adres blijft actief tot je op de verificatie link klikt.
      </p>
    </div>
  `;

  return baseLayout(content, 'Bevestig je nieuwe email - Heppy');
}
