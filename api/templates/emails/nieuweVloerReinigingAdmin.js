// api/templates/emails/nieuweVloerReinigingAdmin.js
/**
 * Email template: Nieuwe Vloer Reiniging Offerte Aanvraag (Admin Notificatie)
 * 
 * Gestuurd naar: Admin team
 * Wanneer: Zodra een klant een offerte aanvraag indient voor vloer reiniging
 * 
 * @param {Object} data - Email data
 * @param {string} data.klantNaam - Volledige naam van de klant
 * @param {string} data.klantEmail - Email van de klant
 * @param {string} data.klantTelefoon - Telefoon van de klant
 * @param {string} data.plaats - Plaats van het adres
 * @param {string} data.adres - Volledig adres
 * @param {string} data.postcode - Postcode
 * @param {Object} [data.dagdelenVoorkeur] - Object met dagdelen voorkeur
 * @param {boolean} data.geenVoorkeurDagdelen - Of klant geen voorkeur heeft
 * @param {number} data.oppervlakteM2 - Totaal aantal vierkante meters
 * @param {Array<string>} data.vloerTypes - Lijst van vloer types
 * @param {string} data.opdrachtId - UUID van de opdracht
 * @returns {string} HTML string
 */
export function nieuweVloerReinigingAdmin(data) {
  const {
    klantNaam,
    klantEmail,
    klantTelefoon,
    plaats,
    adres,
    postcode,
    dagdelenVoorkeur,
    geenVoorkeurDagdelen,
    oppervlakteM2,
    vloerTypes = [],
    opdrachtId
  } = data;

  // Format dagdelen
  let dagdelenHtml = '';
  if (geenVoorkeurDagdelen) {
    dagdelenHtml = '<p style="margin: 0; padding: 0;"><strong>Geen voorkeur</strong> - klant is flexibel</p>';
  } else if (dagdelenVoorkeur && Object.keys(dagdelenVoorkeur).length > 0) {
    const dagMapping = {
      'maandag': 'Maandag',
      'dinsdag': 'Dinsdag',
      'woensdag': 'Woensdag',
      'donderdag': 'Donderdag',
      'vrijdag': 'Vrijdag',
      'zaterdag': 'Zaterdag',
      'zondag': 'Zondag'
    };
    const dagdeelMapping = {
      'ochtend': 'ochtend',
      'middag': 'middag',
      'avond': 'avond'
    };

    const dagdelenItems = Object.entries(dagdelenVoorkeur).map(([dag, dagdelen]) => {
      const dagNaam = dagMapping[dag] || dag;
      const dagdelenFormatted = dagdelen.map(d => dagdeelMapping[d] || d).join(', ');
      return `<li style="margin: 5px 0;">${dagNaam}: ${dagdelenFormatted}</li>`;
    }).join('');

    dagdelenHtml = `<ul style="margin: 10px 0; padding-left: 20px;">${dagdelenItems}</ul>`;
  } else {
    dagdelenHtml = '<p style="margin: 0; padding: 0;"><em>Geen dagdelen opgegeven</em></p>';
  }

  // Format vloer types
  const vloerTypesHtml = vloerTypes.length > 0
    ? `<ul style="margin: 10px 0; padding-left: 20px;">${vloerTypes.map(t => `<li style="margin: 5px 0;">${t}</li>`).join('')}</ul>`
    : '<p style="margin: 0; padding: 0;"><em>Geen typen opgegeven</em></p>';

  return `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nieuwe Vloer Reiniging Offerte Aanvraag</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #4CAF50; color: #ffffff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px; font-weight: bold;">🆕 Nieuwe Vloer Reiniging Aanvraag</h1>
              <p style="margin: 10px 0 0; font-size: 14px; opacity: 0.9;">Offerte aanvraag - Actie vereist</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333;">
                Hoi team,<br><br>
                Er is een nieuwe offerte aanvraag binnengekomen voor <strong>vloer reiniging</strong>.
              </p>

              <!-- Klantgegevens -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; border: 1px solid #e0e0e0; border-radius: 4px;">
                <tr style="background-color: #f9f9f9;">
                  <td colspan="2" style="padding: 15px; border-bottom: 1px solid #e0e0e0;">
                    <h2 style="margin: 0; font-size: 18px; color: #333333;">👤 Klantgegevens</h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; width: 40%; font-weight: bold; color: #666666;">Naam</td>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; color: #333333;">${klantNaam}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #666666;">E-mail</td>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; color: #333333;"><a href="mailto:${klantEmail}" style="color: #4CAF50; text-decoration: none;">${klantEmail}</a></td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; font-weight: bold; color: #666666;">Telefoon</td>
                  <td style="padding: 12px 15px; color: #333333;">${klantTelefoon}</td>
                </tr>
              </table>

              <!-- Opdracht Details -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; border: 1px solid #e0e0e0; border-radius: 4px;">
                <tr style="background-color: #f9f9f9;">
                  <td colspan="2" style="padding: 15px; border-bottom: 1px solid #e0e0e0;">
                    <h2 style="margin: 0; font-size: 18px; color: #333333;">🧹 Opdracht Details</h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; width: 40%; font-weight: bold; color: #666666;">Dienst Type</td>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; color: #333333;">Vloer Reiniging</td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #666666;">Plaats</td>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; color: #333333;">${plaats}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #666666;">Adres</td>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; color: #333333;">${adres}, ${postcode}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #666666;">Oppervlakte</td>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; color: #333333;"><strong>${oppervlakteM2} m²</strong></td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #666666; vertical-align: top;">Vloer Types</td>
                  <td style="padding: 12px 15px; border-bottom: 1px solid #e0e0e0; color: #333333;">${vloerTypesHtml}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 15px; font-weight: bold; color: #666666; vertical-align: top;">Voorkeur Dagdelen</td>
                  <td style="padding: 12px 15px; color: #333333;">${dagdelenHtml}</td>
                </tr>
              </table>

              <!-- Opdracht ID -->
              <p style="margin: 20px 0 10px; font-size: 14px; color: #666666;">
                <strong>Opdracht ID:</strong> <code style="background-color: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${opdrachtId}</code>
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="https://heppy-frontend-code.vercel.app/admin/opdrachten/${opdrachtId}" style="display: inline-block; padding: 14px 30px; background-color: #4CAF50; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                      📋 Bekijk Opdracht & Maak Offerte
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; font-size: 14px; color: #666666; line-height: 1.6;">
                ⏰ <strong>Actie vereist:</strong> Maak binnen 24 uur een offerte en stuur deze naar de klant.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; font-size: 12px; color: #999999;">
                Deze email is automatisch verstuurd door het Heppy systeem<br>
                <a href="https://heppy-frontend-code.vercel.app" style="color: #4CAF50; text-decoration: none;">heppy-frontend-code.vercel.app</a>
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
