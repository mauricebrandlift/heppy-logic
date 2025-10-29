/**
 * Email Template: Geen Schoonmaker Beschikbaar (Klant)
 * 
 * Wordt verzonden naar klant wanneer er geen schoonmaker gevonden kan worden
 * en alle pogingen zijn uitgeput. Biedt alternatieven aan.
 */

import { baseLayout, formatDatum } from './baseLayout.js';

/**
 * Genereer HTML voor geen schoonmaker beschikbaar notificatie (Klant)
 * 
 * @param {Object} data - Template data
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.plaats - Plaats waar schoonmaak gewenst is
 * @param {string} data.startdatum - Gewenste startdatum
 * @param {number} data.uren - Aantal gewenste uren per week
 * @param {Object|Array} data.dagdelen - Gewenste dagdelen
 * @param {string} data.aanvraagId - UUID van de aanvraag
 * @returns {string} HTML string
 */
export function geenSchoonmakerBeschikbaarKlant(data) {
  const {
    klantNaam,
    plaats,
    startdatum,
    uren,
    dagdelen,
    aanvraagId
  } = data;

  // Format dagdelen voor display
  let dagdelenText = 'de door jou gekozen tijden';
  if (typeof dagdelen === 'object' && !Array.isArray(dagdelen)) {
    const formatted = Object.entries(dagdelen)
      .map(([dag, delen]) => {
        const dagNamen = { maandag: 'maandag', dinsdag: 'dinsdag', woensdag: 'woensdag', donderdag: 'donderdag', vrijdag: 'vrijdag', zaterdag: 'zaterdag', zondag: 'zondag' };
        return `${dagNamen[dag] || dag} ${Array.isArray(delen) ? delen.join(' en ') : delen}`;
      })
      .join(', ');
    dagdelenText = formatted;
  } else if (Array.isArray(dagdelen) && dagdelen.length > 0) {
    dagdelenText = dagdelen.join(', ');
  }

  const content = `
    <h2>We Zijn Op Zoek Naar Een Geschikte Schoonmaker</h2>
    
    <p>Beste ${klantNaam},</p>
    
    <p>Bedankt voor je vertrouwen in Heppy. Helaas kunnen we op dit moment geen schoonmaker vinden die beschikbaar is voor ${dagdelenText} in ${plaats}.</p>
    
    <div class="warning-badge">⏳ Zoeken Naar Oplossing</div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📋 Jouw Aanvraag</h3>
      <table>
        <tr>
          <th>Detail</th>
          <th>Waarde</th>
        </tr>
        <tr>
          <td><strong>Plaats</strong></td>
          <td>${plaats}</td>
        </tr>
        <tr>
          <td><strong>Uren per week</strong></td>
          <td>${uren} uur</td>
        </tr>
        <tr>
          <td><strong>Gewenste tijden</strong></td>
          <td>${dagdelenText}</td>
        </tr>
        <tr>
          <td><strong>Startdatum</strong></td>
          <td>${formatDatum(startdatum)}</td>
        </tr>
      </table>
    </div>
    
    <h3>💡 Wat Kun Je Doen?</h3>
    
    <div class="info-box" style="background: #dbeafe; border-left-color: #3b82f6;">
      <h3 style="margin-top: 0; color: #3b82f6;">Optie 1: Flexibeler Zijn Met Tijden</h3>
      <p>We hebben mogelijk wel schoonmakers beschikbaar op andere tijden of dagen. Als je flexibel kunt zijn, kunnen we je sneller helpen.</p>
      <p style="margin-bottom: 0;">
        <a href="#" style="color: #3b82f6; text-decoration: underline;">Wijzig Voorkeurstijden</a>
      </p>
    </div>
    
    <div class="info-box" style="background: #dcfce7; border-left-color: #10b981;">
      <h3 style="margin-top: 0; color: #10b981;">Optie 2: Even Geduld Hebben</h3>
      <p>We blijven actief zoeken naar een geschikte schoonmaker. Zodra er iemand beschikbaar komt in jouw regio, nemen we direct contact met je op.</p>
      <p style="margin-bottom: 0;"><strong>Geschatte wachttijd:</strong> 1-2 weken</p>
    </div>
    
    <div class="info-box" style="background: #fef3c7; border-left-color: #f59e0b;">
      <h3 style="margin-top: 0; color: #f59e0b;">Optie 3: Persoonlijk Contact</h3>
      <p>Wil je liever persoonlijk overleggen? Ons team helpt je graag om naar alternatieve oplossingen te kijken.</p>
      <p style="margin-bottom: 0;">
        <a href="mailto:info@mail.heppy-schoonmaak.nl" style="color: #f59e0b; text-decoration: underline;">Neem Contact Op</a>
      </p>
    </div>
    
    <h3>🔄 Wat Gebeurt Er Met Mijn Betaling?</h3>
    <p>Geen zorgen! Je betaling blijft veilig gereserveerd. Als we geen geschikte schoonmaker kunnen vinden binnen 2 weken, of als je besluit om te annuleren, krijg je je <strong>volledige bedrag terug</strong>.</p>
    
    <div class="info-box" style="background: #f9fafb;">
      <h3 style="margin-top: 0;">📞 Hulp Nodig?</h3>
      <p>We begrijpen dat dit teleurstellend is. Ons team doet er alles aan om een oplossing te vinden.</p>
      <p style="margin-bottom: 0;">
        📧 <a href="mailto:info@mail.heppy-schoonmaak.nl">info@mail.heppy-schoonmaak.nl</a><br>
        📱 Direct contact via de reply op deze email
      </p>
    </div>
    
    <p style="margin-top: 30px;">
      <a href="#" class="button">Bekijk Mijn Aanvraag</a>
    </p>
    
    <div style="margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 6px; font-size: 12px; color: #6b7280;">
      <strong>Referentie:</strong><br>
      Aanvraag ID: ${aanvraagId}
    </div>
  `;

  return baseLayout(content, 'We Zoeken Een Geschikte Schoonmaker - Heppy');
}
