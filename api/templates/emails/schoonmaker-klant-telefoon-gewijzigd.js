// api/templates/emails/schoonmaker-klant-telefoon-gewijzigd.js
/**
 * Email template voor schoonmaker wanneer klant telefoonnummer wijzigt
 */

import { baseLayout } from './baseLayout.js';

export function schoonmakerKlantTelefoonGewijzigd({ schoonmakerVoornaam, klantNaam, oudTelefoon, nieuwTelefoon }) {
  const content = `
    <p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px; line-height: 24px;">
      Hoi ${schoonmakerVoornaam},
    </p>
    
    <p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px; line-height: 24px;">
      De contactgegevens van een van je klanten zijn gewijzigd.
    </p>

    <div style="background-color: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">
        Klant:
      </p>
      <p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">
        ${klantNaam}
      </p>
      
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
      Gebruik dit nieuwe telefoonnummer voor toekomstig contact met deze klant.
    </p>

    <p style="margin: 0; color: #1a1a1a; font-size: 16px; line-height: 24px;">
      Met vriendelijke groet,<br>
      Team Heppy
    </p>
  `;

  return baseLayout(content, 'Klantgegevens gewijzigd - Heppy');
}
