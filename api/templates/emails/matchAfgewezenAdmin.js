/**
 * Email Template: Match Afgewezen - Geen Match Gevonden (Admin)
 * 
 * Wordt verzonden naar admin wanneer alle schoonmakers hebben geweigerd
 * en er geen automatische match meer mogelijk is. Vereist handmatige actie.
 */

import { baseLayout, formatDatum, formatBedrag } from './baseLayout.js';

/**
 * Genereer HTML voor geen match gevonden notificatie (Admin)
 * 
 * @param {Object} data - Template data
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.klantEmail - Email van de klant
 * @param {string} data.plaats - Plaats waar schoonmaak gewenst is
 * @param {number} data.uren - Aantal gewenste uren per week
 * @param {Object|Array} data.dagdelen - Gewenste dagdelen
 * @param {string} data.startdatum - Gewenste startdatum
 * @param {number} data.aantalPogingen - Aantal schoonmakers die hebben geweigerd
 * @param {number} data.bedrag - Betaalde bedrag
 * @param {string} data.aanvraagId - UUID van de aanvraag
 * @returns {string} HTML string
 */
export function matchAfgewezenAdmin(data) {
  const {
    klantNaam,
    klantEmail,
    plaats,
    uren,
    dagdelen,
    startdatum,
    aantalPogingen,
    bedrag,
    aanvraagId
  } = data;

  // Format dagdelen voor display
  let dagdelenText = 'Niet opgegeven';
  if (typeof dagdelen === 'object' && !Array.isArray(dagdelen)) {
    const formatted = Object.entries(dagdelen)
      .map(([dag, delen]) => {
        const dagNamen = { maandag: 'Ma', dinsdag: 'Di', woensdag: 'Wo', donderdag: 'Do', vrijdag: 'Vr', zaterdag: 'Za', zondag: 'Zo' };
        return `${dagNamen[dag] || dag} ${Array.isArray(delen) ? delen.join('+') : delen}`;
      })
      .join(', ');
    dagdelenText = formatted;
  } else if (Array.isArray(dagdelen) && dagdelen.length > 0) {
    dagdelenText = dagdelen.join(', ');
  }

  const content = `
    <h2>⚠️ Geen Schoonmaker Match Gevonden - Actie Vereist</h2>
    
    <div class="warning-badge">🚨 Handmatige Toewijzing Nodig</div>
    
    <p>Er is een aanvraag waarbij geen automatische match meer mogelijk is. Alle beschikbare schoonmakers in de regio hebben de aanvraag geweigerd.</p>
    
    <div class="info-box" style="background: #fee2e2; border-left-color: #ef4444;">
      <h3 style="margin-top: 0; color: #ef4444;">⚠️ Urgentie</h3>
      <p><strong>${aantalPogingen} schoonmaker(s)</strong> hebben de aanvraag geweigerd.</p>
      <p style="margin-bottom: 0;">De klant heeft al betaald (${formatBedrag(bedrag)}) en verwacht een oplossing.</p>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">👤 Klant Gegevens</h3>
      <p><strong>Naam:</strong> ${klantNaam}</p>
      <p><strong>Email:</strong> ${klantEmail}</p>
      <p><strong>Plaats:</strong> ${plaats}</p>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📋 Aanvraag Details</h3>
      <table>
        <tr>
          <th>Detail</th>
          <th>Waarde</th>
        </tr>
        <tr>
          <td><strong>Uren per week</strong></td>
          <td>${uren} uur</td>
        </tr>
        <tr>
          <td><strong>Gewenste dagdelen</strong></td>
          <td>${dagdelenText}</td>
        </tr>
        <tr>
          <td><strong>Startdatum</strong></td>
          <td>${formatDatum(startdatum)}</td>
        </tr>
        <tr>
          <td><strong>Betaald bedrag</strong></td>
          <td>${formatBedrag(bedrag)}</td>
        </tr>
        <tr>
          <td><strong>Pogingen</strong></td>
          <td style="color: #ef4444; font-weight: bold;">${aantalPogingen} weigering(en)</td>
        </tr>
      </table>
    </div>
    
    <h3>🔧 Mogelijke Acties</h3>
    <ul>
      <li><strong>Optie 1:</strong> Wijs handmatig een schoonmaker toe die net beschikbaar is gekomen</li>
      <li><strong>Optie 2:</strong> Contact klant om alternatieve tijden/dagdelen te bespreken</li>
      <li><strong>Optie 3:</strong> Zoek in naburige plaatsen voor beschikbare schoonmakers</li>
      <li><strong>Optie 4:</strong> Als laatste redmiddel: bied refund aan en leg uit waarom</li>
    </ul>
    
    <div class="info-box" style="background: #fef3c7; border-left-color: #f59e0b;">
      <h3 style="margin-top: 0; color: #f59e0b;">💡 Tips</h3>
      <ul style="margin-bottom: 0;">
        <li>Check of er nieuwe schoonmakers zijn geregistreerd in ${plaats}</li>
        <li>Bekijk of bestaande schoonmakers recent beschikbaarheid hebben geüpdatet</li>
        <li>Overweeg om schoonmakers persoonlijk te benaderen met hogere vergoeding</li>
      </ul>
    </div>
    
    <p style="margin-top: 30px;">
      <a href="#" class="button">Bekijk in Dashboard</a>
      <a href="mailto:${klantEmail}" class="button" style="background: #6b7280; margin-left: 10px;">Contact Klant</a>
    </p>
    
    <div style="margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 6px; font-size: 12px; color: #6b7280;">
      <strong>Technische Details:</strong><br>
      Aanvraag ID: ${aanvraagId}<br>
      Plaats: ${plaats}<br>
      Aantal pogingen: ${aantalPogingen}
    </div>
  `;

  return baseLayout(content, '⚠️ Geen Match Gevonden - Actie Vereist');
}
