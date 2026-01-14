/**
 * Email Template: Match Afgewezen - Bericht voor Klant
 * 
 * Wordt verzonden naar klant nadat schoonmaker de match heeft afgewezen.
 * Stelt de klant gerust dat we een nieuwe schoonmaker zoeken.
 */

import { baseLayout, formatDatum } from './baseLayout.js';

/**
 * Genereer HTML voor match afgewezen bericht (Klant)
 * 
 * @param {Object} data - Template data
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.schoonmakerNaam - Volledige naam van schoonmaker die afwees
 * @param {string} data.type - 'aanvraag' of 'opdracht'
 * @param {string} [data.typeNaam] - Specifiek type opdracht (Dieptereiniging, Verhuis, etc.)
 * @param {string} data.plaats - Plaats waar schoonmaak plaatsvindt
 * @param {number} [data.uren] - Aantal uren
 * @param {string} [data.frequentie] - Frequentie voor abonnementen
 * @param {string} [data.gewensteDatum] - Gewenste datum voor opdrachten
 * @returns {string} HTML string
 */
export function matchAfgewezenKlant(data) {
  const {
    klantNaam,
    schoonmakerNaam,
    type,
    typeNaam,
    plaats,
    uren,
    frequentie,
    gewensteDatum
  } = data;

  const isAanvraag = type === 'aanvraag';
  const typeLabel = isAanvraag ? 'Schoonmaak Abonnement' : (typeNaam || 'Eenmalige Schoonmaak');

  const opdrachtDetails = [];
  if (uren) opdrachtDetails.push(`${uren} uur${isAanvraag ? ' per schoonmaak' : ''}`);
  if (frequentie && isAanvraag) opdrachtDetails.push(frequentie);

  const content = `
    <h2>Update over je ${isAanvraag ? 'aanvraag' : 'opdracht'}</h2>
    
    <p>Beste ${klantNaam},</p>
    
    <p>We willen je even op de hoogte brengen: <strong>${schoonmakerNaam}</strong> heeft helaas laten weten dat deze keer niet beschikbaar is voor je ${isAanvraag ? 'aanvraag' : 'opdracht'}.</p>
    
    <div class="info-box" style="background: #f0fdf4; border-left: 3px solid #22c55e;">
      <h3 style="margin-top: 0; color: #22c55e;">✓ Geen zorgen!</h3>
      <p style="margin: 0;">Wij zijn al bezig met het zoeken naar een andere geschikte schoonmaker voor je. Je hoeft zelf niets te doen.</p>
    </div>
    
    <h3>📋 Jouw ${isAanvraag ? 'Aanvraag' : 'Opdracht'}</h3>
    <div class="info-box">
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
          <td><strong>Locatie</strong></td>
          <td>${plaats}</td>
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
    
    <h3>⏭️ Wat gebeurt er nu?</h3>
    <ul>
      <li>🔍 Wij zoeken direct een andere geschikte schoonmaker voor je</li>
      <li>📧 Je ontvangt bericht zodra we iemand hebben gevonden</li>
      <li>✅ De nieuwe schoonmaker beoordeelt je ${isAanvraag ? 'aanvraag' : 'opdracht'} en neemt contact met je op</li>
      ${!isAanvraag && gewensteDatum ? `<li>📅 We houden rekening met je gewenste datum: ${formatDatum(gewensteDatum)}</li>` : ''}
    </ul>
    
    <div class="info-box" style="background: #fef3c7; border-left: 3px solid #f59e0b;">
      <p style="margin: 0;"><strong>💡 Let op:</strong> Het kan soms even duren voordat we een nieuwe schoonmaker hebben gevonden. We doen ons best om dit zo snel mogelijk te regelen!</p>
    </div>
    
    <h3>💬 Vragen of aanpassingen?</h3>
    <p>Wil je iets aanpassen aan je ${isAanvraag ? 'aanvraag' : 'opdracht'}? Of heb je vragen? Neem dan gerust contact met ons op via <a href="mailto:info@heppy.nl">info@heppy.nl</a>.</p>
    
    <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; text-align: center;">
      <p style="color: white; margin: 0; font-size: 16px; font-weight: 600;">We zorgen ervoor dat je snel een nieuwe schoonmaker krijgt! 💪</p>
    </div>
  `;

  return baseLayout({
    title: 'Update over je aanvraag',
    content
  });
}
