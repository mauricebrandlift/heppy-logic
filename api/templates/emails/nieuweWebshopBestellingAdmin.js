/**
 * Email Template: Nieuwe Webshop Bestelling voor Admin
 * 
 * Wordt verzonden naar admin wanneer een nieuwe webshop bestelling binnenkomt.
 */

import { baseLayout, formatDatum, formatBedrag } from './baseLayout.js';

/**
 * Genereer HTML voor nieuwe bestelling notificatie (Admin)
 * 
 * @param {Object} data - Template data
 * @param {string} data.klantNaam - Naam van de klant
 * @param {string} data.klantEmail - Email van de klant
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
 * @param {string} data.bestellingId - UUID van de bestelling
 * @returns {string} HTML string
 */
export function nieuweWebshopBestellingAdmin(data) {
  const {
    klantNaam,
    klantEmail,
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
    bestellingDatum,
    bestellingId
  } = data;

  // Render items
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
        ${item.product_naam}
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        ${item.aantal}x
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">
        ${formatBedrag(item.prijs_per_stuk_cents / 100)}
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">
        <strong>${formatBedrag(item.totaal_cents / 100)}</strong>
      </td>
    </tr>
  `).join('');

  const bezorgAdres = `${bezorgStraat} ${bezorgHuisnummer}${bezorgToevoeging ? ' ' + bezorgToevoeging : ''}, ${bezorgPostcode} ${bezorgPlaats}`;

  const content = `
    <h2>🛒 Nieuwe Webshop Bestelling Ontvangen</h2>
    
    <p>Er is een nieuwe webshop bestelling binnengekomen. De betaling is succesvol verwerkt.</p>
    
    <div class="success-badge">Bestelnummer: ${bestelNummer}</div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">👤 Klant Gegevens</h3>
      <p><strong>Naam:</strong> ${klantNaam}</p>
      <p><strong>Email:</strong> <a href="mailto:${klantEmail}">${klantEmail}</a></p>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📦 Bestelde Producten</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Product</th>
            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #e5e7eb;">Aantal</th>
            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">Prijs</th>
            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">Totaal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      
      <div style="margin-top: 16px; padding-top: 16px; border-top: 2px solid #e5e7eb;">
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="padding: 4px 0; text-align: right;">Subtotaal:</td>
            <td style="padding: 4px 0; text-align: right; width: 100px;">${formatBedrag(subtotaalCents / 100)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; text-align: right;">Verzendkosten:</td>
            <td style="padding: 4px 0; text-align: right;">${formatBedrag(verzendkostenCents / 100)}</td>
          </tr>
          <tr style="font-size: 16px; border-top: 2px solid #e5e7eb;">
            <td style="padding: 8px 0; text-align: right;"><strong>Totaal:</strong></td>
            <td style="padding: 8px 0; text-align: right;"><strong>${formatBedrag(totaalCents / 100)}</strong></td>
          </tr>
          <tr style="font-size: 12px; color: #6b7280;">
            <td style="padding: 0; text-align: right;">waarvan BTW (21%):</td>
            <td style="padding: 0; text-align: right;">${formatBedrag(btwCents / 100)}</td>
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
      <h3 style="margin-top: 0;">📋 Besteldetails</h3>
      <p><strong>Bestelnummer:</strong> ${bestelNummer}</p>
      <p><strong>Bestelling ID:</strong> <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-size: 12px;">${bestellingId}</code></p>
      <p><strong>Besteldatum:</strong> ${formatDatum(bestellingDatum)}</p>
      <p><strong>Status:</strong> Nieuw - wacht op verzending</p>
    </div>
    
    <div style="margin-top: 30px; padding: 16px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
      <strong>⚡ Actie vereist:</strong><br>
      Deze bestelling is klaar voor verwerking en verzending. Log in op het admin dashboard om de bestelling te beheren.
    </div>
    
    <p style="margin-top: 30px;">
      <strong>Team Heppy Admin</strong>
    </p>
  `;

  return baseLayout(content, `Nieuwe Bestelling ${bestelNummer} - Admin`);
}
