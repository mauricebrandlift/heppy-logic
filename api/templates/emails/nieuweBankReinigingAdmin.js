/**
 * Email Template: Nieuwe Bank & Stoelen Reiniging Offerte Aanvraag voor Admin
 * 
 * Wordt verzonden naar admin wanneer een nieuwe offerte aanvraag binnenkomt.
 * GEEN betaling - Admin moet offerte maken en versturen.
 */

import { baseLayout, formatDatum } from './baseLayout.js';

/**
 * Genereer HTML voor nieuwe bank reiniging offerte aanvraag (Admin)
 * 
 * @param {Object} data - Template data
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.klantEmail - Email van de klant
 * @param {string} data.klantTelefoon - Telefoonnummer van de klant
 * @param {string} data.plaats - Plaats
 * @param {string} data.adres - Volledig adres
 * @param {string} data.postcode - Postcode
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
export function nieuweBankReinigingAdmin(data) {
  const {
    klantNaam,
    klantEmail,
    klantTelefoon,
    plaats,
    adres,
    postcode,
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
    dagdelenText = '<span style="color: #6b7280;">Geen voorkeur</span>';
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

  const content = `
    <h2>🆕 Nieuwe Bank & Stoelen Reiniging Offerte Aanvraag</h2>
    
    <div class="warning-badge">⚠️ Actie Vereist: Offerte Maken</div>
    
    <p>Er is een nieuwe offerte aanvraag binnengekomen voor bank & stoelen reiniging. <strong>Geen betaling ontvangen</strong> - de klant wacht op een offerte van jou.</p>
    
    <div class="info-box" style="background: #fef3c7; border-left-color: #f59e0b;">
      <h3 style="margin-top: 0; color: #92400e;">📋 Volgende Stappen</h3>
      <ol style="margin: 0; padding-left: 20px; color: #92400e;">
        <li><strong>Beoordeel de aanvraag</strong> - Check alle details hieronder</li>
        <li><strong>Bereken prijs</strong> - Op basis van aantal meubels, materialen en locatie</li>
        <li><strong>Maak offerte</strong> - Stuur offerte naar klant via email</li>
        <li><strong>Update status</strong> - Zet offerte_status op 'verstuurd' in dashboard</li>
      </ol>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">👤 Klant Gegevens</h3>
      <p><strong>Naam:</strong> ${klantNaam}</p>
      <p><strong>Email:</strong> <a href="mailto:${klantEmail}">${klantEmail}</a></p>
      <p><strong>Telefoon:</strong> ${klantTelefoon}</p>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📍 Adres Gegevens</h3>
      <p><strong>Adres:</strong> ${adres}</p>
      <p><strong>Postcode:</strong> ${postcode}</p>
      <p><strong>Plaats:</strong> ${plaats}</p>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">🛋️ Meubel Details</h3>
      <table>
        <tr>
          <th>Item</th>
          <th>Aantal</th>
        </tr>
        <tr>
          <td><strong>Banken</strong></td>
          <td>${aantalBanken}</td>
        </tr>
        <tr>
          <td><strong>Stoelen</strong></td>
          <td>${aantalStoelen}</td>
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
      </table>
      ${specificaties ? `
        <div style="background: #f3f4f6; padding: 12px; margin-top: 15px; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px;"><strong>Extra Specificaties:</strong></p>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #4b5563;">${specificaties}</p>
        </div>
      ` : ''}
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📅 Dagdelen Voorkeur</h3>
      <p>${dagdelenText}</p>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">🔧 Technische Details</h3>
      <p><strong>Opdracht ID:</strong> <code>${opdrachtId}</code></p>
      <p><strong>Type:</strong> Bank & Stoelen Reiniging (Offerte)</p>
      <p><strong>Ontvangen op:</strong> ${formatDatum(new Date().toISOString())}</p>
      <p><strong>Status:</strong> <span style="color: #f59e0b; font-weight: 600;">⏳ Wacht op offerte</span></p>
      <p><strong>Offerte Status:</strong> <span style="color: #dc2626; font-weight: 600;">❌ Nog niet verstuurd</span></p>
    </div>
    
    <h3>💡 Tips voor Offerte</h3>
    <ul>
      <li><strong>Inspectie:</strong> Overweeg locatie bezoek voor nauwkeurige prijs (bij grote opdrachten)</li>
      <li><strong>Materiaal:</strong> Leer en delicate stoffen vereisen vaak speciaalwerk (+prijs)</li>
      <li><strong>Aantal:</strong> Bulk kortingen mogelijk bij veel meubels</li>
      <li><strong>Locatie:</strong> Reiskosten meenemen in prijs (afhankelijk van plaats)</li>
      <li><strong>Urgentie:</strong> Spoed opdrachten kunnen meerprijs rechtvaardigen</li>
    </ul>
    
    <p style="margin-top: 30px;">
      <a href="#" class="button">Bekijk in Dashboard</a>
    </p>
  `;

  return baseLayout(content, 'Nieuwe Offerte Aanvraag - Bank & Stoelen Reiniging');
}
