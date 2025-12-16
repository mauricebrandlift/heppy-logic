/**
 * Email Template: Abonnement Gewijzigd (Klant)
 * 
 * Wordt verzonden naar klant wanneer abonnement wordt aangepast (uren/frequentie).
 * Bevestigt de wijziging en toont nieuwe gegevens.
 */

import { baseLayout, formatBedrag } from './baseLayout.js';

/**
 * Genereer HTML voor abonnement wijziging bevestiging (Klant)
 * 
 * @param {Object} data - Template data
 * @param {string} data.voornaam - Voornaam van de klant
 * @param {string} data.achternaam - Achternaam van de klant
 * @param {string} data.abonnementId - UUID van het abonnement (laatste 8 chars gebruikt)
 * @param {number} data.oudeUren - Vorige aantal uren
 * @param {string} data.oudeFrequentie - Vorige frequentie (wekelijks, 2-wekelijks, 4-wekelijks)
 * @param {number} data.oudePrijsCents - Vorige prijs in centen
 * @param {number} data.nieuweUren - Nieuwe aantal uren
 * @param {string} data.nieuweFrequentie - Nieuwe frequentie
 * @param {number} data.nieuwePrijsCents - Nieuwe prijs in centen
 * @param {number} data.sessionsPerCycle - Aantal sessies per 4 weken
 * @returns {string} HTML string
 */
export function abonnementGewijzigdKlant(data) {
  const {
    voornaam,
    achternaam = '',
    abonnementId,
    oudeUren,
    oudeFrequentie,
    oudePrijsCents,
    nieuweUren,
    nieuweFrequentie,
    nieuwePrijsCents,
    sessionsPerCycle
  } = data;

  // Format frequentie voor weergave
  const frequentieMap = {
    'wekelijks': 'Wekelijks',
    '2-wekelijks': 'Tweewekelijks',
    '4-wekelijks': 'Maandelijks'
  };

  const oudeFreqText = frequentieMap[oudeFrequentie] || oudeFrequentie;
  const nieuweFreqText = frequentieMap[nieuweFrequentie] || nieuweFrequentie;

  // Bereken prijsverschil
  const verschilCents = nieuwePrijsCents - oudePrijsCents;
  const isPrijsHoger = verschilCents > 0;
  const isPrijsLager = verschilCents < 0;
  const verschilTekst = isPrijsHoger 
    ? `+${formatBedrag(Math.abs(verschilCents))}` 
    : formatBedrag(Math.abs(verschilCents));

  const content = `
    <h2>✅ Je Abonnement Is Gewijzigd</h2>
    
    <p>Beste ${voornaam},</p>
    
    <p>Je abonnement is succesvol aangepast. Hieronder vind je een overzicht van de wijzigingen.</p>

    <div class="info-box">
      <h3>📋 Wat Is Er Veranderd?</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 8px;"><strong>Detail</strong></td>
          <td style="padding: 12px 8px;"><strong>Oud</strong></td>
          <td style="padding: 12px 8px;"><strong>Nieuw</strong></td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 8px;">Uren per sessie</td>
          <td style="padding: 12px 8px;">${oudeUren} uur</td>
          <td style="padding: 12px 8px; color: #667eea; font-weight: 600;">${nieuweUren} uur</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 8px;">Frequentie</td>
          <td style="padding: 12px 8px;">${oudeFreqText}</td>
          <td style="padding: 12px 8px; color: #667eea; font-weight: 600;">${nieuweFreqText}</td>
        </tr>
        <tr>
          <td style="padding: 12px 8px;">Prijs per 4 weken</td>
          <td style="padding: 12px 8px;">${formatBedrag(oudePrijsCents)}</td>
          <td style="padding: 12px 8px; color: #667eea; font-weight: 600;">${formatBedrag(nieuwePrijsCents)}</td>
        </tr>
      </table>
    </div>

    ${isPrijsHoger || isPrijsLager ? `
    <div style="margin: 20px 0; padding: 20px; background: ${isPrijsHoger ? '#fef3c7' : '#d1fae5'}; border-left: 4px solid ${isPrijsHoger ? '#f59e0b' : '#10b981'}; border-radius: 4px;">
      <p style="margin: 0; color: ${isPrijsHoger ? '#92400e' : '#065f46'}; font-weight: 600;">
        ${isPrijsHoger ? '📈' : '📉'} Prijsverschil: ${verschilTekst} per 4 weken
      </p>
      <p style="margin: 8px 0 0 0; color: ${isPrijsHoger ? '#92400e' : '#065f46'}; font-size: 14px;">
        ${isPrijsHoger ? 'Je nieuwe bundel bedrag is hoger. De volgende automatische incasso wordt aangepast.' : 'Je nieuwe bundel bedrag is lager. Dit wordt verrekend in de volgende automatische incasso.'}
      </p>
    </div>
    ` : ''}

    <div class="info-box">
      <h3>ℹ️ Belangrijke Informatie</h3>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li><strong>Ingangsdatum:</strong> De wijzigingen gaan direct in voor je volgende schoonmaak sessie</li>
        <li><strong>Sessies per 4 weken:</strong> ${sessionsPerCycle}x per 4 weken</li>
        <li><strong>Betalingen:</strong> Je automatische incasso wordt automatisch aangepast naar het nieuwe bedrag</li>
        <li><strong>Schoonmaker:</strong> Je huidige schoonmaker blijft gewoon bij je</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 40px 0;">
      <a href="https://heppy-schoonmaak.webflow.io/dashboard/klant/abonnement-detail?id=${abonnementId}" 
         style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
        Bekijk Abonnement Details
      </a>
    </div>

    <div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px;">
      <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
        <strong>Toch iets niet goed?</strong>
      </p>
      <p style="margin: 0; color: #666; font-size: 14px;">
        Je kunt je abonnement altijd aanpassen via je dashboard of neem contact met ons op via <a href="mailto:info@heppy-schoonmaak.nl" style="color: #667eea;">info@heppy-schoonmaak.nl</a>.
      </p>
    </div>
  `;

  return baseLayout(content, 'Abonnement gewijzigd - Heppy');
}
