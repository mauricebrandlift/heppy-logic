/**
 * Email Template: Match Geaccepteerd - Bevestiging voor Schoonmaker
 * 
 * Wordt verzonden naar schoonmaker nadat deze de match heeft geaccepteerd.
 * Werkt voor zowel aanvragen (abonnementen) als opdrachten (eenmalige schoonmaak).
 */

import { baseLayout, formatDatum } from './baseLayout.js';

/**
 * Genereer HTML voor match geaccepteerd bevestiging (Schoonmaker)
 * 
 * @param {Object} data - Template data
 * @param {string} data.schoonmakerNaam - Volledige naam van schoonmaker
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.type - 'aanvraag' of 'opdracht'
 * @param {string} [data.typeNaam] - Specifiek type opdracht (Dieptereiniging, Verhuis, etc.)
 * @param {string} data.plaats - Plaats waar schoonmaak plaatsvindt
 * @param {string} data.adres - Volledig adres
 * @param {number} [data.uren] - Aantal uren (voor opdrachten of abonnement per sessie)
 * @param {string} [data.frequentie] - Frequentie voor abonnementen
 * @param {string} [data.gewensteDatum] - Gewenste datum voor opdrachten
 * @param {string} [data.klantTelefoon] - Telefoonnummer klant
 * @param {string} [data.klantEmail] - Email klant
 * @returns {string} HTML string
 */
export function matchGeaccepteerdSchoonmaker(data) {
  const {
    schoonmakerNaam,
    klantNaam,
    type,
    typeNaam,
    plaats,
    adres,
    uren,
    frequentie,
    gewensteDatum,
    klantTelefoon,
    klantEmail
  } = data;

  const isAanvraag = type === 'aanvraag';
  const typeLabel = isAanvraag ? 'Schoonmaak Abonnement' : (typeNaam || 'Eenmalige Schoonmaak');

  const volgendeStappen = isAanvraag ? `
    <h3>📋 Volgende Stappen</h3>
    <ol>
      <li><strong>Neem contact op met ${klantNaam}</strong> - Stel jezelf voor en plan een kennismakingsgesprek (kan telefonisch of bij de klant thuis)</li>
      <li><strong>Bespreek de vaste dag(en) en tijd</strong> - Plan wanneer je ${frequentie || 'regelmatig'} komt schoonmaken</li>
      <li><strong>Plan de eerste schoonmaak</strong> - Spreek af wanneer je voor het eerst langskomt</li>
      <li><strong>Bespreek eventuele bijzonderheden</strong> - Vraag naar huisdieren, speciale wensen, toegang tot de woning, etc.</li>
      <li><strong>Noteer het in je agenda</strong> - Zorg dat je de afspraken vastlegt</li>
    </ol>
  ` : `
    <h3>📋 Volgende Stappen</h3>
    <ol>
      <li><strong>Neem contact op met ${klantNaam}</strong> - Bel of mail binnen 24 uur om de exacte starttijd af te spreken${gewensteDatum ? ` voor ${formatDatum(gewensteDatum)}` : ''}</li>
      <li><strong>Bevestig de afspraak</strong> - Spreek de datum, tijd en toegang tot de woning af</li>
      <li><strong>Bereid je voor</strong> - Zorg dat je alle benodigde schoonmaakmiddelen en materialen bij je hebt</li>
      <li><strong>Voer de schoonmaak uit</strong> - Werk volgens de afgesproken ${uren} uur en lever kwaliteit</li>
      <li><strong>Meld voltooiing</strong> - Laat ons weten wanneer de opdracht is afgerond</li>
    </ol>
  `;

  const contactInfo = (klantTelefoon || klantEmail) ? `
    <div class="info-box" style="background: #fef3c7; border-left: 3px solid #f59e0b;">
      <h3 style="margin-top: 0;">📞 Contact Klant</h3>
      ${klantTelefoon ? `<p><strong>Telefoon:</strong> <a href="tel:${klantTelefoon}">${klantTelefoon}</a></p>` : ''}
      ${klantEmail ? `<p><strong>Email:</strong> <a href="mailto:${klantEmail}">${klantEmail}</a></p>` : ''}
      <p style="font-size: 14px; color: #92400e; margin: 8px 0 0 0;"><strong>⚡ Belangrijk:</strong> Neem binnen 24 uur contact op met de klant!</p>
    </div>
  ` : '';

  const opdrachtDetails = [];
  if (uren) opdrachtDetails.push(`${uren} uur${isAanvraag ? ' per schoonmaak' : ''}`);
  if (frequentie && isAanvraag) opdrachtDetails.push(frequentie);

  const content = `
    <h2>✅ Opdracht Geaccepteerd!</h2>
    
    <p>Beste ${schoonmakerNaam},</p>
    
    <p>Je hebt de ${isAanvraag ? 'aanvraag' : 'opdracht'} succesvol geaccepteerd! De klant is op de hoogte gebracht en verwacht je telefoontje om de details af te spreken.</p>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📋 Opdracht Details</h3>
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
          <td><strong>Klant</strong></td>
          <td>${klantNaam}</td>
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
    
    ${contactInfo}
    
    ${volgendeStappen}
    
    <div class="info-box" style="background: #f0fdf4; border-left: 3px solid #22c55e;">
      <p style="margin: 0;"><strong>💡 Tips voor het eerste contact:</strong></p>
      <ul style="margin: 8px 0 0 0; padding-left: 20px;">
        <li>Wees vriendelijk en professioneel</li>
        <li>Bevestig het adres en de verwachte duur</li>
        <li>Vraag naar toegang tot de woning (sleutel, toegangscode, etc.)</li>
        <li>Noteer eventuele speciale wensen of aandachtspunten</li>
        ${!isAanvraag ? '<li>Bevestig de afgesproken datum en tijd schriftelijk (bijv. via WhatsApp)</li>' : ''}
      </ul>
    </div>
    
    <h3>💬 Vragen?</h3>
    <p>Heb je vragen over deze opdracht? Neem dan contact met ons op via <a href="mailto:info@heppy.nl">info@heppy.nl</a>.</p>
    
    <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; text-align: center;">
      <p style="color: white; margin: 0; font-size: 18px; font-weight: 600;">Succes met je opdracht! 💪</p>
    </div>
  `;

  return baseLayout({
    title: 'Opdracht Geaccepteerd',
    content
  });
}
