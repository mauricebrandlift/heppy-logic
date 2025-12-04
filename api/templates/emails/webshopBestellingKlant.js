/**
 * Email Template: Webshop Bestelling Bevestiging voor Klant
 * 
 * Wordt verzonden naar klant na succesvolle webshop bestelling.
 */

import { baseLayout, formatDatum, formatBedrag } from './baseLayout.js';

/**
 * Genereer HTML voor bestelling bevestiging (Klant)
 * 
 * @param {Object} data - Template data
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.bestelNummer - Bestelnummer
 * @param {Array} data.items - Bestelde items
 * @param {number} data.subtotaalCents - Subtotaal in centen
 * @param {number} data.verzendkostenCents - Verzendkosten in centen
 * @param {number} data.btwCents - BTW in centen
 * @param {number} data.totaalCents - Totaalbedrag in centen
 * @param {string} data.bezorgNaam - Naam voor bezorging
 * @param {string} data.bezorgStraat - Straat bezorgadres
 * @param {string} data.bezorgHuisnummer - Huisnummer
 * @param {string} [data.bezorgToevoeging] - Toevoeging (optioneel)
 * @param {string} data.bezorgPostcode - Postcode
 * @param {string} data.bezorgPlaats - Plaats
 * @param {string} data.bestellingDatum - Datum van bestelling
 * @returns {string} HTML string
 */
export function webshopBestellingKlant(data) {
  const {
    klantNaam,
    bestelNummer,
    items,
    subtotaalCents,
    verzendkostenCents,
    btwCents,
    totaalCents,
    bezorgNaam,
    bezorgStraat,
    bezorgHuisnummer,
    bezorgToevoeging,
    bezorgPlaats,
    bezorgPostcode,
    bestellingDatum
  } = data;

  // Render items
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong>${item.product_naam}</strong>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        ${item.aantal}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
        ${formatBedrag(item.prijs_per_stuk_cents / 100)}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
        <strong>${formatBedrag(item.totaal_cents / 100)}</strong>
      </td>
    </tr>
  `).join('');

  const bezorgAdres = `${bezorgStraat} ${bezorgHuisnummer}${bezorgToevoeging ? ' ' + bezorgToevoeging : ''}, ${bezorgPostcode} ${bezorgPlaats}`;

  const content = `
    <h2>✅ Bedankt voor je bestelling!</h2>
    
    <p>Beste ${klantNaam},</p>
    
    <p>Je bestelling is succesvol geplaatst en in behandeling genomen. We sturen je producten zo snel mogelijk op!</p>
    
    <div class="success-badge">Bestelnummer: ${bestelNummer}</div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📦 Bestelde Producten</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Product</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Aantal</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Prijs</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Totaal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; text-align: right;">Subtotaal:</td>
            <td style="padding: 6px 0; text-align: right; width: 120px;">${formatBedrag(subtotaalCents / 100)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; text-align: right;">Verzendkosten:</td>
            <td style="padding: 6px 0; text-align: right;">${formatBedrag(verzendkostenCents / 100)}</td>
          </tr>
          <tr style="font-size: 16px; border-top: 2px solid #e5e7eb;">
            <td style="padding: 12px 0; text-align: right;"><strong>Totaal:</strong></td>
            <td style="padding: 12px 0; text-align: right;"><strong>${formatBedrag(totaalCents / 100)}</strong></td>
          </tr>
          <tr style="font-size: 12px; color: #6b7280;">
            <td style="padding: 0 0 6px 0; text-align: right;">waarvan BTW (21%):</td>
            <td style="padding: 0 0 6px 0; text-align: right;">${formatBedrag(btwCents / 100)}</td>
          </tr>
        </table>
      </div>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">🚚 Bezorgadres</h3>
      <p><strong>${bezorgNaam}</strong></p>
      <p>${bezorgAdres}</p>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📋 Bestelgegevens</h3>
      <p><strong>Bestelnummer:</strong> ${bestelNummer}</p>
      <p><strong>Besteldatum:</strong> ${formatDatum(bestellingDatum)}</p>
      <p><strong>Status:</strong> In behandeling</p>
    </div>
    
    <p style="margin-top: 30px; padding: 16px; background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px;">
      <strong>✓ Volgende stappen:</strong><br>
      We verwerken je bestelling zo snel mogelijk en houden je op de hoogte van de voortgang.
    </p>
    
    <p style="margin-top: 30px;">Vragen over je bestelling? Neem gerust contact met ons op!</p>
    
    <p>Met vriendelijke groet,<br>
    <strong>Team Heppy</strong></p>
  `;

  return baseLayout(content, `Orderbevestiging ${bestelNummer} - Heppy`);
}
