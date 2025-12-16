/**
 * Email Template: Abonnement Gewijzigd (Admin)
 * 
 * Wordt verzonden naar admin wanneer een klant het abonnement aanpast.
 * Notificatie voor administratie en monitoring.
 */

import { baseLayout, formatBedrag } from './baseLayout.js';

/**
 * Genereer HTML voor abonnement wijziging notificatie (Admin)
 * 
 * @param {Object} data - Template data
 * @param {string} data.klantNaam - Volledige naam van de klant
 * @param {string} data.klantEmail - Email van de klant
 * @param {string} data.schoonmakerNaam - Volledige naam van de schoonmaker
 * @param {string} data.klantAdres - Volledig adres van de klant
 * @param {string} data.abonnementId - UUID van het abonnement
 * @param {number} data.oudeUren - Vorige aantal uren
 * @param {string} data.oudeFrequentie - Vorige frequentie
 * @param {number} data.oudeBundleCents - Vorige bundel bedrag per 4 weken in centen
 * @param {number} data.nieuweUren - Nieuwe aantal uren
 * @param {string} data.nieuweFrequentie - Nieuwe frequentie
 * @param {number} data.nieuweBundleCents - Nieuwe bundel bedrag per 4 weken in centen
 * @param {number} data.sessionsPerCycle - Aantal sessies per 4 weken
 * @returns {string} HTML string
 */
export function abonnementGewijzigdAdmin(data) {
  const {
    klantNaam,
    klantEmail,
    schoonmakerNaam,
    klantAdres,
    abonnementId,
    oudeUren,
    oudeFrequentie,
    oudeBundleCents,
    nieuweUren,
    nieuweFrequentie,
    nieuweBundleCents,
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

  // Bereken omzetverschil
  const verschilCents = nieuweBundleCents - oudeBundleCents;
  const isOmzetHoger = verschilCents > 0;
  const isOmzetLager = verschilCents < 0;

  const content = `
    <h2>🔄 Abonnement Gewijzigd</h2>
    
    <p>Een klant heeft het abonnement aangepast. Hieronder vind je alle details.</p>

    <div class="info-box">
      <h3>👤 Klant Gegevens</h3>
      <p><strong>Naam:</strong> ${klantNaam}</p>
      <p><strong>Email:</strong> <a href="mailto:${klantEmail}">${klantEmail}</a></p>
      <p><strong>Adres:</strong> ${klantAdres}</p>
    </div>

    <div class="info-box">
      <h3>🧹 Schoonmaker</h3>
      <p><strong>Naam:</strong> ${schoonmakerNaam}</p>
      <p><strong>Status:</strong> Automatisch geïnformeerd per email</p>
    </div>

    <div class="info-box" style="border-left-color: #667eea;">
      <h3>📊 Abonnement Wijzigingen</h3>
      <p><strong>Abonnement ID:</strong> ${abonnementId}</p>
      <p><strong>Referentie:</strong> #${abonnementId.slice(-8).toUpperCase()}</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <tr style="border-bottom: 2px solid #e5e7eb; background: #f9fafb;">
          <td style="padding: 12px 8px;"><strong>Veld</strong></td>
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
        <tr style="background: #f9fafb;">
          <td style="padding: 12px 8px;"><strong>Bundel prijs (per 4w)</strong></td>
          <td style="padding: 12px 8px;"><strong>${formatBedrag(oudeBundleCents)}</strong></td>
          <td style="padding: 12px 8px; color: #667eea; font-weight: 600;"><strong>${formatBedrag(nieuweBundleCents)}</strong></td>
        </tr>
      </table>
    </div>

    ${isOmzetHoger || isOmzetLager ? `
    <div style="margin: 20px 0; padding: 20px; background: ${isOmzetHoger ? '#d1fae5' : '#fee2e2'}; border-left: 4px solid ${isOmzetHoger ? '#10b981' : '#ef4444'}; border-radius: 4px;">
      <p style="margin: 0; color: ${isOmzetHoger ? '#065f46' : '#991b1b'}; font-weight: 600;">
        ${isOmzetHoger ? '📈 Omzetstijging' : '📉 Omzetdaling'}: ${formatBedrag(Math.abs(verschilCents))} per 4 weken
      </p>
      <p style="margin: 8px 0 0 0; color: ${isOmzetHoger ? '#065f46' : '#991b1b'}; font-size: 14px;">
        Impact op MRR (Monthly Recurring Revenue): ${isOmzetHoger ? '+' : ''}${formatBedrag(Math.abs(verschilCents))}
      </p>
    </div>
    ` : ''}

    <div class="info-box" style="background: #e7f3ff; border-left-color: #2196F3;">
      <h3>⚡ Automatische Acties</h3>
      <p style="margin: 10px 0;">De volgende acties zijn automatisch uitgevoerd:</p>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>✅ Abonnement bijgewerkt in database</li>
        <li>✅ Nieuwe prijzen doorberekend</li>
        <li>✅ Bevestigings-email naar klant verzonden</li>
        <li>✅ Notificatie-email naar schoonmaker verzonden</li>
        <li>✅ Stripe abonnement zal bij volgende betaling worden aangepast</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 40px 0;">
      <a href="https://heppy-schoonmaak.webflow.io/dashboard/admin" 
         style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
        Ga Naar Admin Dashboard
      </a>
    </div>

    <div style="margin-top: 30px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
      <p style="margin: 0; color: #856404; font-size: 14px;">
        <strong>⚠️ Actie vereist:</strong> Controleer of de planning van de schoonmaker is aangepast naar de nieuwe uren/frequentie.
      </p>
    </div>
  `;

  return baseLayout(content, 'Abonnement gewijzigd - Admin Notificatie');
}
