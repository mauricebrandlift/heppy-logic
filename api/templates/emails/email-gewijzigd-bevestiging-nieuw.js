/**
 * Email Template: Email Gewijzigd Bevestiging (Nieuw Adres)
 * 
 * Wordt verzonden naar het NIEUWE email adres nadat de wijziging is bevestigd.
 * Welkomstmail op het nieuwe adres.
 */

import { baseLayout } from './baseLayout.js';

/**
 * Genereer HTML voor email wijziging bevestiging (Nieuw Adres)
 * 
 * @param {Object} data - Template data
 * @param {string} data.voornaam - Voornaam van de klant
 * @param {string} data.nieuwEmail - Nieuwe email adres (dit adres)
 * @param {string} [data.dashboardUrl] - Dashboard URL (optioneel)
 * @returns {string} HTML string
 */
export function emailGewijzigdBevestigingNieuw(data) {
  const {
    voornaam,
    nieuwEmail,
    dashboardUrl = 'https://heppy-schoonmaak.webflow.io/dashboard/klant/overview'
  } = data;

  const content = `
    <h2>🎉 Je Email Is Gewijzigd!</h2>
    
    <p>Beste ${voornaam},</p>
    
    <p>Super! Je nieuwe email adres is succesvol bevestigd en actief.</p>
    
    <div class="success-badge">✓ Email Geverifieerd</div>
    
    <div class="info-box">
      <h3>Nieuwe Inloggegevens</h3>
      <p style="margin: 10px 0;">
        <strong>Email:</strong> ${nieuwEmail}<br>
        <strong>Wachtwoord:</strong> Ongewijzigd
      </p>
    </div>
    
    <p>Vanaf nu ontvang je alle communicatie van Heppy op dit email adres:</p>
    
    <ul style="color: #666; line-height: 1.8;">
      <li>Facturen en betalingsbevestigingen</li>
      <li>Berichten van je schoonmaker</li>
      <li>Updates over je afspraken</li>
      <li>Belangrijke accountmeldingen</li>
    </ul>
    
    <div style="margin: 30px 0; padding: 20px; background: #c9e9b1; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 15px 0; color: #013d29; font-weight: 600;">
        💡 Je kunt nu inloggen met je nieuwe email adres
      </p>
      <a href="${dashboardUrl}" 
         style="display: inline-block; background: #013d29; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        Naar Mijn Dashboard
      </a>
    </div>
    
    <div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; text-align: center;">
      <p style="margin: 0; color: #666;">
        Vragen? Neem contact met ons op via <a href="mailto:info@heppy-schoonmaak.nl">info@heppy-schoonmaak.nl</a>.
      </p>
    </div>
  `;

  return baseLayout(content, 'Je email is gewijzigd - Heppy');
}
