// api/templates/emails/wachtwoord-gewijzigd.js
/**
 * Email template voor klant wanneer wachtwoord is gewijzigd
 * Security notificatie
 */

import { baseLayout } from './baseLayout.js';

export function wachtwoordGewijzigd({ voornaam }) {
  const content = `
    <p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px; line-height: 24px;">
      Hoi ${voornaam},
    </p>
    
    <p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px; line-height: 24px;">
      Het wachtwoord van je Heppy account is zojuist gewijzigd.
    </p>

    <div style="background-color: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">
        🔒 Beveiligingsnotificatie
      </p>
      <p style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">
        Je wachtwoord is succesvol bijgewerkt
      </p>
    </div>

    <p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px; line-height: 24px;">
      Als extra beveiligingsmaatregel zijn alle andere actieve sessies uitgelogd. Je huidige sessie blijft actief.
    </p>

    <div style="background-color: #fff4e6; border-left: 4px solid #ff9500; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">
        ⚠️ Dit was jij toch?
      </p>
      <p style="margin: 0; color: #666; font-size: 14px; line-height: 20px;">
        Als je deze wachtwoordwijziging niet zelf hebt doorgevoerd, neem dan <strong>onmiddellijk</strong> contact met ons op via <a href="mailto:info@heppy-schoonmaak.nl" style="color: #ff9500; text-decoration: none;">info@heppy-schoonmaak.nl</a>
      </p>
    </div>

    <div style="background-color: #e8f4fd; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">
        💡 Veiligheidstips
      </p>
      <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 20px;">
        <li>Gebruik een uniek wachtwoord voor je Heppy account</li>
        <li>Deel je wachtwoord nooit met anderen</li>
        <li>Wijzig je wachtwoord regelmatig</li>
        <li>Gebruik minimaal 8 tekens met een mix van letters, cijfers en symbolen</li>
      </ul>
    </div>

    <p style="margin: 0; color: #1a1a1a; font-size: 16px; line-height: 24px;">
      Met vriendelijke groet,<br>
      Team Heppy
    </p>
  `;

  return baseLayout(content, 'Je wachtwoord is gewijzigd - Heppy');
}
