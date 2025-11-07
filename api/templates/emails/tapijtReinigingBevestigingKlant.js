// api/templates/emails/tapijtReinigingBevestigingKlant.js
/**
 * Email template: Tapijt Reiniging Offerte Aanvraag Bevestiging (Klant)
 * 
 * Gestuurd naar: Klant
 * Wanneer: Zodra de offerte aanvraag is ontvangen
 * 
 * @param {Object} data - Email data
 * @param {string} data.klantNaam - Volledige naam van de klant
 * @param {string} data.klantEmail - Email van de klant
 * @param {string} data.plaats - Plaats van het adres
 * @param {string} data.adres - Volledig adres
 * @param {number} data.totaalM2 - Totaal aantal vierkante meters
 * @param {Array<string>} data.opties - Lijst van extra opties
 * @param {Object} [data.dagdelenVoorkeur] - Object met dagdelen voorkeur
 * @param {boolean} data.geenVoorkeurDagdelen - Of klant geen voorkeur heeft
 * @param {string} data.opdrachtId - UUID van de opdracht
 * @returns {string} HTML string
 */
export function tapijtReinigingBevestigingKlant(data) {
  const {
    klantNaam,
    klantEmail,
    plaats,
    adres,
    totaalM2,
    opties = [],
    dagdelenVoorkeur,
    geenVoorkeurDagdelen,
    opdrachtId
  } = data;

  // Haal voornaam uit klantNaam
  const voornaam = klantNaam.split(' ')[0];

  // Format dagdelen
  let dagdelenText = '';
  if (geenVoorkeurDagdelen) {
    dagdelenText = 'Geen voorkeur (u bent flexibel)';
  } else if (dagdelenVoorkeur && Object.keys(dagdelenVoorkeur).length > 0) {
    const dagMapping = {
      'maandag': 'Ma',
      'dinsdag': 'Di',
      'woensdag': 'Wo',
      'donderdag': 'Do',
      'vrijdag': 'Vr',
      'zaterdag': 'Za',
      'zondag': 'Zo'
    };
    const dagdeelMapping = {
      'ochtend': 'ochtend',
      'middag': 'middag',
      'avond': 'avond'
    };

    const parts = Object.entries(dagdelenVoorkeur).map(([dag, dagdelen]) => {
      const dagKort = dagMapping[dag] || dag;
      const dagdelenFormatted = dagdelen.map(d => dagdeelMapping[d] || d).join(', ');
      return `${dagKort}: ${dagdelenFormatted}`;
    });

    dagdelenText = parts.join(' • ');
  } else {
    dagdelenText = 'Geen opgegeven';
  }

  // Format opties
  const optiesText = opties.length > 0 ? opties.join(', ') : 'Geen extra opties';

  return `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bevestiging Tapijt Reiniging Offerte Aanvraag</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #4CAF50; color: #ffffff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px; font-weight: bold;">✅ Offerte Aanvraag Ontvangen!</h1>
              <p style="margin: 10px 0 0; font-size: 14px; opacity: 0.9;">Tapijt Reiniging</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333;">
                Beste ${voornaam},<br><br>
                Bedankt voor je offerte aanvraag! We hebben je aanvraag voor <strong>tapijt reiniging</strong> ontvangen en gaan hier zo snel mogelijk mee aan de slag.
              </p>

              <!-- Info Box -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background-color: #E8F5E9; border-left: 4px solid #4CAF50; border-radius: 4px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px; font-size: 16px; color: #333333; font-weight: bold;">⏰ Wat gebeurt er nu?</p>
                    <p style="margin: 0; font-size: 14px; color: #666666; line-height: 1.6;">
                      • Ons team bekijkt je aanvraag zorgvuldig<br>
                      • We maken een gepersonaliseerde offerte voor je<br>
                      • Je ontvangt binnen <strong>24 uur</strong> een offerte per email<br>
                      • Na goedkeuring plannen we een afspraak in
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Overzicht -->
              <h2 style="margin: 30px 0 15px; font-size: 20px; color: #333333;">📋 Overzicht van je aanvraag</h2>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; border: 1px solid #e0e0e0; border-radius: 4px;">
                <tr>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; width: 40%; font-weight: bold; color: #666666;">Dienst Type</td>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; color: #333333;">Tapijt Reiniging</td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #666666;">Plaats</td>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; color: #333333;">${plaats}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #666666;">Totaal m²</td>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; color: #333333;"><strong>${totaalM2} m²</strong></td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #666666;">Extra Opties</td>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; color: #333333;">${optiesText}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; font-weight: bold; color: #666666;">Voorkeur Dagdelen</td>
                  <td style="padding: 12px 15px; color: #333333;">${dagdelenText}</td>
                </tr>
              </table>

              <!-- Contact Info -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0; background-color: #f9f9f9; border-radius: 4px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px; font-size: 16px; color: #333333; font-weight: bold;">💬 Vragen of aanpassingen?</p>
                    <p style="margin: 0; font-size: 14px; color: #666666; line-height: 1.6;">
                      Heb je vragen of wil je iets aanpassen aan je aanvraag? <br>
                      Neem gerust contact met ons op via <a href="mailto:info@heppy-schoonmaak.nl" style="color: #4CAF50; text-decoration: none;">info@heppy-schoonmaak.nl</a>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Reference Number -->
              <p style="margin: 20px 0 0; font-size: 12px; color: #999999;">
                Referentienummer: <code style="background-color: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; color: #666666;">${opdrachtId}</code>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #333333; font-weight: bold;">Bedankt voor je vertrouwen in Heppy!</p>
              <p style="margin: 0 0 15px; font-size: 12px; color: #999999;">
                We streven naar de beste service en kwaliteit
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                Heppy Schoonmaakdiensten<br>
                <a href="mailto:info@heppy-schoonmaak.nl" style="color: #4CAF50; text-decoration: none;">info@heppy-schoonmaak.nl</a> | 
                <a href="https://heppy-frontend-code.vercel.app" style="color: #4CAF50; text-decoration: none;">www.heppy-schoonmaak.nl</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
