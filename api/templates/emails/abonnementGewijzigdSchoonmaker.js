/**
 * Email Template: Abonnement Gewijzigd (Schoonmaker)
 * 
 * Wordt verzonden naar schoonmaker wanneer hun klant het abonnement aanpast.
 * Informeert over de wijzigingen zodat schoonmaker zich kan voorbereiden.
 */

import { baseLayout, formatBedrag } from './baseLayout.js';

/**
 * Genereer HTML voor abonnement wijziging notificatie (Schoonmaker)
 * 
 * @param {Object} data - Template data
 * @param {string} data.schoonmakerNaam - Voornaam van de schoonmaker
 * @param {string} data.klantNaam - Volledige naam van de klant
 * @param {string} data.klantAdres - Volledig adres van de klant
 * @param {string} data.abonnementId - UUID van het abonnement
 * @param {number} data.oudeUren - Vorige aantal uren
 * @param {string} data.oudeFrequentie - Vorige frequentie
 * @param {number} data.oudePrijsPerSessieCents - Vorige prijs per sessie in centen
 * @param {number} data.nieuweUren - Nieuwe aantal uren
 * @param {string} data.nieuweFrequentie - Nieuwe frequentie
 * @param {number} data.nieuwePrijsPerSessieCents - Nieuwe prijs per sessie in centen
 * @param {number} data.sessionsPerCycle - Aantal sessies per 4 weken
 * @returns {string} HTML string
 */
export function abonnementGewijzigdSchoonmaker(data) {
  const {
    schoonmakerNaam,
    klantNaam,
    klantAdres,
    abonnementId,
    oudeUren,
    oudeFrequentie,
    oudePrijsPerSessieCents,
    nieuweUren,
    nieuweFrequentie,
    nieuwePrijsPerSessieCents,
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

  // Bereken verschil in inkomsten per sessie
  const verschilPerSessieCents = nieuwePrijsPerSessieCents - oudePrijsPerSessieCents;
  const isInkomstenHoger = verschilPerSessieCents > 0;
  const isInkomstenLager = verschilPerSessieCents < 0;

  const content = `
    <h2>📋 Abonnement Gewijzigd</h2>
    
    <p>Beste ${schoonmakerNaam},</p>
    
    <p>Je klant <strong>${klantNaam}</strong> heeft het abonnement aangepast. Hieronder vind je een overzicht van de wijzigingen.</p>

    <div class="info-box">
      <h3>👤 Klant Gegevens</h3>
      <p><strong>Naam:</strong> ${klantNaam}</p>
      <p><strong>Adres:</strong> ${klantAdres}</p>
      <p><strong>Abonnement ID:</strong> #${abonnementId.slice(-8).toUpperCase()}</p>
    </div>

    <div class="info-box">
      <h3>📊 Wat Is Er Veranderd?</h3>
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
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 8px;">Sessies per 4 weken</td>
          <td style="padding: 12px 8px;">—</td>
          <td style="padding: 12px 8px; color: #667eea; font-weight: 600;">${sessionsPerCycle}x</td>
        </tr>
        <tr>
          <td style="padding: 12px 8px;">Jouw inkomsten per sessie</td>
          <td style="padding: 12px 8px;">${formatBedrag(oudePrijsPerSessieCents)}</td>
          <td style="padding: 12px 8px; color: #667eea; font-weight: 600;">${formatBedrag(nieuwePrijsPerSessieCents)}</td>
        </tr>
      </table>
    </div>

    ${isInkomstenHoger || isInkomstenLager ? `
    <div style="margin: 20px 0; padding: 20px; background: ${isInkomstenHoger ? '#d1fae5' : '#fef3c7'}; border-left: 4px solid ${isInkomstenHoger ? '#10b981' : '#f59e0b'}; border-radius: 4px;">
      <p style="margin: 0; color: ${isInkomstenHoger ? '#065f46' : '#92400e'}; font-weight: 600;">
        ${isInkomstenHoger ? '📈 Hogere inkomsten' : '📉 Lagere inkomsten'}: ${formatBedrag(Math.abs(verschilPerSessieCents))} per sessie
      </p>
      <p style="margin: 8px 0 0 0; color: ${isInkomstenHoger ? '#065f46' : '#92400e'}; font-size: 14px;">
        ${isInkomstenHoger ? 'Je verdient meer per sessie door de aanpassing.' : 'Je verdient minder per sessie door de aanpassing.'}
      </p>
    </div>
    ` : ''}

    <div class="info-box">
      <h3>ℹ️ Wat Betekent Dit Voor Jou?</h3>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li><strong>Ingangsdatum:</strong> De wijzigingen gaan in vanaf de volgende schoonmaak sessie</li>
        <li><strong>Planning:</strong> Check je planning en pas je schema aan indien nodig</li>
        <li><strong>Materialen:</strong> Bereid je voor op ${nieuweUren} uur werk per sessie</li>
        <li><strong>Betaling:</strong> Je uitbetaling wordt automatisch aangepast naar het nieuwe bedrag</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 40px 0;">
      <a href="https://heppy-schoonmaak.webflow.io/dashboard/schoonmaker" 
         style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
        Ga Naar Dashboard
      </a>
    </div>

    <div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px;">
      <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
        <strong>Vragen over deze wijziging?</strong>
      </p>
      <p style="margin: 0; color: #666; font-size: 14px;">
        Neem contact met ons op via <a href="mailto:info@heppy-schoonmaak.nl" style="color: #667eea;">info@heppy-schoonmaak.nl</a> of bel naar <a href="tel:+31850606755" style="color: #667eea;">085 060 6755</a>.
      </p>
    </div>
  `;

  return baseLayout(content, 'Abonnement gewijzigd - Heppy');
}
