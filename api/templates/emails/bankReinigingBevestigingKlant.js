/**
 * Email Template: Bank & Stoelen Reiniging Offerte Aanvraag Bevestiging voor Klant
 * 
 * Wordt verzonden naar klant na succesvolle offerte aanvraag.
 * Legt uit dat er geen betaling is gedaan en dat ze een offerte ontvangen.
 */

import { baseLayout, formatDatum } from './baseLayout.js';

/**
 * Genereer HTML voor bank reiniging offerte bevestiging (Klant)
 * 
 * @param {Object} data - Template data
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.plaats - Plaats
 * @param {Object} [data.dagdelenVoorkeur] - Object met dagdelen voorkeur
 * @param {boolean} data.geenVoorkeurDagdelen - Of klant geen voorkeur heeft
 * @param {number} data.aantalBanken - Aantal banken
 * @param {number} data.aantalStoelen - Aantal stoelen
 * @param {number} data.aantalZitvlakken - Aantal zitvlakken
 * @param {number} data.aantalKussens - Aantal kussens
 * @param {Array<string>} data.materialen - Lijst van materialen
 * @param {string} [data.specificaties] - Extra specificaties
 * @param {string} data.opdrachtId - UUID van de opdracht
 * @returns {string} HTML string
 */
export function bankReinigingBevestigingKlant(data) {
  const {
    klantNaam,
    plaats,
    dagdelenVoorkeur,
    geenVoorkeurDagdelen,
    aantalBanken,
    aantalStoelen,
    aantalZitvlakken,
    aantalKussens,
    materialen,
    specificaties,
    opdrachtId
  } = data;

  // Format dagdelen voorkeur
  let dagdelenText = '—';
  if (geenVoorkeurDagdelen) {
    dagdelenText = 'Geen voorkeur';
  } else if (dagdelenVoorkeur && Object.keys(dagdelenVoorkeur).length > 0) {
    const dagAfkortingen = {
      maandag: 'Ma',
      dinsdag: 'Di',
      woensdag: 'Wo',
      donderdag: 'Do',
      vrijdag: 'Vr',
      zaterdag: 'Za',
      zondag: 'Zo'
    };
    
    const dagdelenStrings = [];
    for (const [dag, dagdelen] of Object.entries(dagdelenVoorkeur)) {
      const dagAfkorting = dagAfkortingen[dag] || dag;
      const dagdeelLabels = dagdelen.join(', ');
      dagdelenStrings.push(`${dagAfkorting}: ${dagdeelLabels}`);
    }
    dagdelenText = dagdelenStrings.join(' • ');
  }

  // Format materialen
  const materialenText = materialen && materialen.length > 0 
    ? materialen.join(', ') 
    : '—';

  // Aantal meubels voor overzicht
  const totaalMeubels = aantalBanken + aantalStoelen;

  const content = `
    <h2>✅ Offerte Aanvraag Ontvangen!</h2>
    
    <p>Beste ${klantNaam},</p>
    
    <p>Bedankt voor uw interesse in onze bank & stoelen reinigingsdienst! Uw aanvraag is succesvol ontvangen en wordt momenteel beoordeeld.</p>
    
    <div class="info-box" style="background: #e0f2fe; border-left-color: #0284c7;">
      <h3 style="margin-top: 0; color: #075985;">📧 Wat gebeurt er nu?</h3>
      <ol style="margin: 0; padding-left: 20px; color: #075985;">
        <li><strong>Binnen 24 uur</strong> ontvangt u een offerte op maat per email</li>
        <li>In de offerte vindt u de <strong>prijs, uitvoeringstijd en werkwijze</strong></li>
        <li>U kunt de offerte <strong>vrijblijvend accepteren of afwijzen</strong></li>
        <li>Bij acceptatie plannen we de reiniging in op een moment dat u uitkomt</li>
      </ol>
    </div>
    
    <div class="success-badge">✓ Geen betaling vereist - Eerst offerte, dan beslissen</div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📋 Uw Aanvraag</h3>
      <table>
        <tr>
          <th>Detail</th>
          <th>Waarde</th>
        </tr>
        <tr>
          <td><strong>Type</strong></td>
          <td>Bank & Stoelen Reiniging</td>
        </tr>
        <tr>
          <td><strong>Plaats</strong></td>
          <td>${plaats}</td>
        </tr>
        <tr>
          <td><strong>Aantal meubels</strong></td>
          <td>${totaalMeubels} (${aantalBanken} ${aantalBanken === 1 ? 'bank' : 'banken'}, ${aantalStoelen} ${aantalStoelen === 1 ? 'stoel' : 'stoelen'})</td>
        </tr>
        <tr>
          <td><strong>Zitvlakken</strong></td>
          <td>${aantalZitvlakken}</td>
        </tr>
        <tr>
          <td><strong>Kussens</strong></td>
          <td>${aantalKussens}</td>
        </tr>
        <tr>
          <td><strong>Materialen</strong></td>
          <td>${materialenText}</td>
        </tr>
        <tr>
          <td><strong>Dagdelen voorkeur</strong></td>
          <td>${dagdelenText}</td>
        </tr>
      </table>
      ${specificaties ? `
        <div style="background: #f9fafb; padding: 12px; margin-top: 15px; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px;"><strong>Uw specificaties:</strong></p>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #4b5563;">${specificaties}</p>
        </div>
      ` : ''}
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">💼 Onze Werkwijze</h3>
      <p style="margin-bottom: 10px;"><strong>Wat maakt onze reiniging bijzonder?</strong></p>
      <ul style="margin: 0;">
        <li>✓ Professionele extractiemethode (dieptereiniging)</li>
        <li>✓ Milieuvriendelijke reinigingsmiddelen</li>
        <li>✓ Geschikt voor alle materialen (stof, leer, microvezels)</li>
        <li>✓ Verwijdert vlekken, geuren en huisstofmijt</li>
        <li>✓ Snelle droogtijd (4-6 uur)</li>
      </ul>
    </div>
    
    <div class="info-box" style="background: #fef3c7; border-left-color: #f59e0b;">
      <h3 style="margin-top: 0; color: #92400e;">💡 Tips Voor Het Beste Resultaat</h3>
      <ul style="margin: 0; color: #92400e;">
        <li><strong>Foto's helpen:</strong> Heeft u foto's van de meubels? Stuur ze mee in uw reactie op de offerte</li>
        <li><strong>Vlekken benoemen:</strong> Specifieke vlekken of problemen? Laat het ons weten</li>
        <li><strong>Toegankelijkheid:</strong> Zorg dat de meubels goed bereikbaar zijn op de dag zelf</li>
        <li><strong>Planning:</strong> Plan bij voorkeur met 3-5 dagen vooruitloop voor beste beschikbaarheid</li>
      </ul>
    </div>
    
    <h3>❓ Vragen?</h3>
    <p>Heeft u vragen over de offerte of onze dienstverlening? Neem gerust contact met ons op:</p>
    <ul>
      <li>📧 Email: <a href="mailto:info@heppy-schoonmaak.nl">info@heppy-schoonmaak.nl</a></li>
      <li>📞 Telefoon: [Telefoonnummer]</li>
    </ul>
    
    <div style="background: #f9fafb; padding: 15px; margin: 25px 0; border-radius: 4px; border-left: 4px solid #6b7280;">
      <p style="margin: 0; font-size: 14px; color: #4b5563;">
        <strong>Referentienummer:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 3px; font-size: 12px;">${opdrachtId}</code><br>
        <small>Vermeld dit nummer bij eventuele vragen over uw aanvraag</small>
      </p>
    </div>
    
    <p style="margin-top: 30px;">Met vriendelijke groet,<br><strong>Team Heppy Schoonmaak</strong></p>
  `;

  return baseLayout(content, 'Offerte Aanvraag Ontvangen - Heppy Schoonmaak');
}
