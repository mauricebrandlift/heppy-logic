// api/templates/emails/telefoon-gewijzigd.js
/**
 * Email template voor klant wanneer telefoonnummer is gewijzigd
 */

import { baseLayout } from './baseLayout.js';

export function telefoonGewijzigd({ voornaam, oudTelefoon, nieuwTelefoon }) {
  const content = `
    <p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px; line-height: 24px;">
      Hoi ${voornaam},
    </p>
    
    <p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px; line-height: 24px;">
      Je telefoonnummer bij Heppy is succesvol gewijzigd.
    </p>

    <div style="background-color: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">
        Oud telefoonnummer:
      </p>
      <p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">
        ${oudTelefoon || 'Niet ingesteld'}
      </p>
      
      <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">
        Nieuw telefoonnummer:
      </p>
      <p style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">
        ${nieuwTelefoon}
      </p>
    </div>

    <p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px; line-height: 24px;">
      Als je actieve abonnementen hebt, zijn je schoonmakers automatisch op de hoogte gebracht van deze wijziging.
    </p>

    <div style="background-color: #fff4e6; border-left: 4px solid #ff9500; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">
        ⚠️ Dit was jij toch?
      </p>
      <p style="margin: 0; color: #666; font-size: 14px; line-height: 20px;">
        Als je deze wijziging niet zelf hebt doorgevoerd, neem dan onmiddellijk contact met ons op via <a href="mailto:info@heppy-schoonmaak.nl" style="color: #ff9500; text-decoration: none;">info@heppy-schoonmaak.nl</a>
      </p>
    </div>

    <p style="margin: 0; color: #1a1a1a; font-size: 16px; line-height: 24px;">
      Met vriendelijke groet,<br>
      Team Heppy
    </p>
  `;

  return baseLayout(content, 'Je telefoonnummer is gewijzigd - Heppy');
}
