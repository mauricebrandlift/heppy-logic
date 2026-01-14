/**
 * Email Template: Match Geaccepteerd - Bevestiging voor Klant
 * 
 * Wordt verzonden naar klant nadat schoonmaker de match heeft geaccepteerd.
 * Werkt voor zowel aanvragen (abonnementen) als opdrachten (eenmalige schoonmaak).
 */

import { baseLayout, formatDatum } from './baseLayout.js';

/**
 * Genereer HTML voor match geaccepteerd bevestiging (Klant)
 * 
 * @param {Object} data - Template data
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.schoonmakerNaam - Volledige naam van schoonmaker
 * @param {string} data.type - 'aanvraag' of 'opdracht'
 * @param {string} [data.typeNaam] - Specifiek type opdracht (Dieptereiniging, Verhuis, etc.)
 * @param {string} data.plaats - Plaats waar schoonmaak plaatsvindt
 * @param {string} data.adres - Volledig adres
 * @param {number} [data.uren] - Aantal uren (voor opdrachten of abonnement per sessie)
 * @param {string} [data.frequentie] - Frequentie voor abonnementen
 * @param {string} [data.gewensteDatum] - Gewenste datum voor opdrachten
 * @returns {string} HTML string
 */
export function matchGeaccepteerdKlant(data) {
  const {
    klantNaam,
    schoonmakerNaam,
    type,
    typeNaam,
    plaats,
    adres,
    uren,
    frequentie,
    gewensteDatum
  } = data;

  const isAanvraag = type === 'aanvraag';
  const typeLabel = isAanvraag ? 'Schoonmaak Abonnement' : (typeNaam || 'Eenmalige Schoonmaak');

  // Verschillende content voor abonnement vs opdracht
  const volgendeStappen = isAanvraag ? `
    <h3>📌 Wat gebeurt er nu?</h3>
    <ul>
      <li>✅ <strong>${schoonmakerNaam}</strong> heeft uw aanvraag geaccepteerd</li>
      <li>📞 ${schoonmakerNaam} neemt spoedig contact met u op om de vaste dag(en) en starttijd af te spreken</li>
      <li>📅 Samen plannen jullie wanneer de eerste schoonmaak plaatsvindt</li>
      <li>🔄 Daarna komt ${schoonmakerNaam} ${frequentie || 'regelmatig'} bij u schoonmaken</li>
    </ul>

    <div class="info-box" style="background: #f0fdf4; border-left: 3px solid #22c55e;">
      <p style="margin: 0;"><strong>💡 Tip:</strong> Bespreek bij het eerste contact ook eventuele speciale wensen of aandachtspunten voor uw woning.</p>
    </div>
  ` : `
    <h3>📌 Wat gebeurt er nu?</h3>
    <ul>
      <li>✅ <strong>${schoonmakerNaam}</strong> heeft uw opdracht geaccepteerd</li>
      <li>📞 ${schoonmakerNaam} neemt spoedig contact met u op om de exacte starttijd af te spreken${gewensteDatum ? ` voor ${formatDatum(gewensteDatum)}` : ''}</li>
      <li>🧹 Op de afgesproken datum en tijd voert ${schoonmakerNaam} de schoonmaak uit</li>
      <li>✨ Na afloop ontvangt u een bevestiging dat de opdracht is voltooid</li>
    </ul>

    <div class="info-box" style="background: #f0fdf4; border-left: 3px solid #22c55e;">
      <p style="margin: 0;"><strong>💡 Belangrijk:</strong> Zorg ervoor dat ${schoonmakerNaam} toegang heeft tot uw woning op de afgesproken tijd. Bespreek dit bij het telefonisch contact.</p>
    </div>
  `;

  const opdrachtDetails = [];
  if (uren) opdrachtDetails.push(`${uren} uur${isAanvraag ? ' per schoonmaak' : ''}`);
  if (frequentie && isAanvraag) opdrachtDetails.push(frequentie);

  const content = `
    <h2>🎉 Goed Nieuws!</h2>
    
    <p>Beste ${klantNaam},</p>
    
    <p>We hebben goed nieuws! <strong>${schoonmakerNaam}</strong> heeft uw ${isAanvraag ? 'aanvraag voor een schoonmaak abonnement' : 'opdracht'} geaccepteerd en neemt spoedig contact met u op om de details te bespreken.</p>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📋 Overzicht</h3>
      <table>
        <tr>
          <th>Detail</th>
          <th>Waarde</th>
        </tr>
        <tr>
          <td><strong>Type</strong></td>
          <td>${typeLabel}</td>
        </tr>
        <tr>
          <td><strong>Schoonmaker</strong></td>
          <td>${schoonmakerNaam}</td>
        </tr>
        <tr>
          <td><strong>Locatie</strong></td>
          <td>${plaats}<br><span style="font-size: 14px; color: #6b7280;">${adres}</span></td>
        </tr>
        ${opdrachtDetails.length > 0 ? `
        <tr>
          <td><strong>${isAanvraag ? 'Abonnement' : 'Opdracht'}</strong></td>
          <td>${opdrachtDetails.join(', ')}</td>
        </tr>
        ` : ''}
        ${gewensteDatum && !isAanvraag ? `
        <tr>
          <td><strong>Gewenste datum</strong></td>
          <td>${formatDatum(gewensteDatum)}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    ${volgendeStappen}
    
    <h3>💬 Vragen?</h3>
    <p>Heeft u vragen over de planning of uw ${isAanvraag ? 'abonnement' : 'opdracht'}? Neem dan contact met ons op via <a href="mailto:info@heppy.nl">info@heppy.nl</a>.</p>
    
    <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; text-align: center;">
      <p style="color: white; margin: 0; font-size: 18px; font-weight: 600;">Bedankt voor uw vertrouwen in Heppy! 🙏</p>
    </div>
  `;

  return baseLayout(content, 'Match Geaccepteerd - Heppy Schoonmaak');
}
