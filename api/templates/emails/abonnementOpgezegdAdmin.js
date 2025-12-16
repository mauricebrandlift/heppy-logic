/**
 * Email Template: Abonnement Opgezegd (Admin)
 * 
 * Wordt verzonden naar admin wanneer een klant het abonnement opzegt.
 * Notificatie voor churn monitoring en follow-up acties.
 */

import { baseLayout, formatBedrag } from './baseLayout.js';

/**
 * Genereer HTML voor abonnement opzeg notificatie (Admin)
 * 
 * @param {Object} data - Template data
 * @param {string} data.klantNaam - Volledige naam van de klant
 * @param {string} data.klantEmail - Email van de klant
 * @param {string} data.klantTelefoon - Telefoonnummer van de klant (optioneel)
 * @param {string} data.schoonmakerNaam - Volledige naam van de schoonmaker
 * @param {string} data.klantAdres - Volledig adres van de klant
 * @param {string} data.abonnementId - UUID van het abonnement
 * @param {number} data.opzegWeek - Weeknummer van laatste sessie
 * @param {number} data.opzegJaar - Jaar van laatste sessie
 * @param {string} data.opzegReden - Opgegeven reden
 * @param {number} data.uren - Aantal uren per sessie
 * @param {string} data.frequentie - Frequentie
 * @param {number} data.bundleCents - Bundel bedrag per 4 weken in centen
 * @param {string} data.startdatum - Startdatum van abonnement
 * @returns {string} HTML string
 */
export function abonnementOpgezegdAdmin(data) {
  const {
    klantNaam,
    klantEmail,
    klantTelefoon,
    schoonmakerNaam,
    klantAdres,
    abonnementId,
    opzegWeek,
    opzegJaar,
    opzegReden,
    uren,
    frequentie,
    bundleCents,
    startdatum
  } = data;

  // Format frequentie voor weergave
  const frequentieMap = {
    'wekelijks': 'Wekelijks',
    '2-wekelijks': 'Tweewekelijks',
    '4-wekelijks': 'Maandelijks'
  };

  const freqText = frequentieMap[frequentie] || frequentie;

  // Bereken looptijd
  const start = new Date(startdatum);
  const now = new Date();
  const diffMonths = Math.floor((now - start) / (1000 * 60 * 60 * 24 * 30));
  const looptijd = diffMonths < 1 ? 'Minder dan 1 maand' : `${diffMonths} ${diffMonths === 1 ? 'maand' : 'maanden'}`;

  const content = `
    <h2>⚠️ Klant Heeft Opgezegd</h2>
    
    <p>Een klant heeft het abonnement opgezegd. Hieronder vind je alle details voor follow-up en churn analyse.</p>

    <div class="info-box" style="background: #fee2e2; border-left-color: #ef4444;">
      <h3>👤 Klant Gegevens</h3>
      <p><strong>Naam:</strong> ${klantNaam}</p>
      <p><strong>Email:</strong> <a href="mailto:${klantEmail}">${klantEmail}</a></p>
      ${klantTelefoon ? `<p><strong>Telefoon:</strong> <a href="tel:${klantTelefoon}">${klantTelefoon}</a></p>` : ''}
      <p><strong>Adres:</strong> ${klantAdres}</p>
    </div>

    <div class="info-box">
      <h3>🧹 Schoonmaker</h3>
      <p><strong>Naam:</strong> ${schoonmakerNaam}</p>
      <p><strong>Status:</strong> Automatisch geïnformeerd per email</p>
      <p style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 4px; font-size: 14px;">
        <strong>⚠️ Actie:</strong> Check of schoonmaker nieuwe klant nodig heeft om inkomsten te behouden
      </p>
    </div>

    <div class="info-box" style="border-left-color: #f59e0b;">
      <h3>📊 Abonnement Details</h3>
      <p><strong>Abonnement ID:</strong> ${abonnementId}</p>
      <p><strong>Referentie:</strong> #${abonnementId.slice(-8).toUpperCase()}</p>
      <p><strong>Type:</strong> ${uren} uur ${freqText}</p>
      <p><strong>Prijs per 4 weken:</strong> ${formatBedrag(bundleCents)}</p>
      <p><strong>Startdatum:</strong> ${new Date(startdatum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <p><strong>Looptijd:</strong> ${looptijd}</p>
      <p><strong>Laatste schoonmaak:</strong> Week ${opzegWeek}, ${opzegJaar}</p>
      <p><strong>Opgezegd op:</strong> ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
    </div>

    <div class="info-box" style="background: #fee2e2; border-left-color: #ef4444;">
      <h3>💭 Opzeg Reden</h3>
      <p style="font-size: 16px; color: #991b1b; font-weight: 600;">
        "${opzegReden || 'Geen reden opgegeven'}"
      </p>
      ${!opzegReden || opzegReden === 'Geen reden opgegeven' ? `
      <p style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 4px; font-size: 14px; color: #92400e;">
        <strong>⚠️ Actie:</strong> Overweeg om klant te bellen voor feedback - waarom geen reden gegeven?
      </p>
      ` : ''}
    </div>

    <div class="info-box" style="background: #fef3c7; border-left-color: #f59e0b;">
      <h3>📉 Churn Impact</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0;"><strong>MRR verlies:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #ef4444; font-weight: 600;">${formatBedrag(bundleCents)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 0;"><strong>Looptijd klant:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${looptijd}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Churn type:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${diffMonths < 3 ? '⚠️ Early churn (<3 maanden)' : 'Late churn (>3 maanden)'}</td>
        </tr>
      </table>
    </div>

    <div class="info-box" style="background: #e7f3ff; border-left-color: #2196F3;">
      <h3>⚡ Automatische Acties</h3>
      <p style="margin: 10px 0;">De volgende acties zijn automatisch uitgevoerd:</p>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>✅ Abonnement status → 'gestopt'</li>
        <li>✅ Opzeg datum vastgelegd</li>
        <li>✅ Bevestigings-email naar klant verzonden</li>
        <li>✅ Notificatie-email naar schoonmaker verzonden</li>
        <li>⏳ Stripe abonnement zal worden gestopt na laatste betaling</li>
      </ul>
    </div>

    <div class="info-box" style="background: #fff3cd; border-left-color: #f59e0b;">
      <h3>✅ Follow-up Acties</h3>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li><strong>Win-back:</strong> Overweeg win-back email na 1-2 maanden met aanbieding</li>
        <li><strong>Feedback:</strong> Bel klant voor uitgebreide feedback (indien geen reden gegeven)</li>
        <li><strong>Review analyse:</strong> Analyseer opzegreden voor trend analyse</li>
        <li><strong>Schoonmaker matching:</strong> Zoek nieuwe klant voor schoonmaker om capacity te vullen</li>
        <li><strong>Administratie:</strong> Zorg dat sleutels/toegang correct worden afgerond</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 40px 0;">
      <a href="https://heppy-schoonmaak.webflow.io/dashboard/admin" 
         style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px; margin-right: 10px;">
        Ga Naar Admin Dashboard
      </a>
      <a href="mailto:${klantEmail}" 
         style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
        Email Klant Direct
      </a>
    </div>
  `;

  return baseLayout(content, 'Churn Alert: Abonnement Opgezegd - Admin');
}
