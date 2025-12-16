/**
 * Email Template: Abonnement Opgezegd (Schoonmaker)
 * 
 * Wordt verzonden naar schoonmaker wanneer hun klant het abonnement opzegt.
 * Informeert over laatste schoonmaakdatum en administratieve afronding.
 */

import { baseLayout } from './baseLayout.js';

/**
 * Genereer HTML voor abonnement opzeg notificatie (Schoonmaker)
 * 
 * @param {Object} data - Template data
 * @param {string} data.schoonmakerNaam - Voornaam van de schoonmaker
 * @param {string} data.klantNaam - Volledige naam van de klant
 * @param {string} data.klantAdres - Volledig adres van de klant
 * @param {string} data.klantTelefoon - Telefoonnummer van de klant (optioneel)
 * @param {string} data.abonnementId - UUID van het abonnement
 * @param {number} data.opzegWeek - Weeknummer van laatste sessie
 * @param {number} data.opzegJaar - Jaar van laatste sessie
 * @param {string} data.opzegReden - Opgegeven reden (optioneel)
 * @param {number} data.uren - Aantal uren per sessie
 * @param {string} data.frequentie - Frequentie
 * @returns {string} HTML string
 */
export function abonnementOpgezegdSchoonmaker(data) {
  const {
    schoonmakerNaam,
    klantNaam,
    klantAdres,
    klantTelefoon,
    abonnementId,
    opzegWeek,
    opzegJaar,
    opzegReden,
    uren,
    frequentie
  } = data;

  // Format frequentie voor weergave
  const frequentieMap = {
    'wekelijks': 'wekelijks',
    '2-wekelijks': 'tweewekelijks',
    '4-wekelijks': 'maandelijks'
  };

  const freqText = frequentieMap[frequentie] || frequentie;

  const content = `
    <h2>📢 Klant Heeft Opgezegd</h2>
    
    <p>Beste ${schoonmakerNaam},</p>
    
    <p>We moeten je helaas laten weten dat je klant <strong>${klantNaam}</strong> het schoonmaakabonnement heeft opgezegd.</p>

    <div class="info-box">
      <h3>👤 Klant Gegevens</h3>
      <p><strong>Naam:</strong> ${klantNaam}</p>
      <p><strong>Adres:</strong> ${klantAdres}</p>
      ${klantTelefoon ? `<p><strong>Telefoon:</strong> <a href="tel:${klantTelefoon}">${klantTelefoon}</a></p>` : ''}
      <p><strong>Abonnement ID:</strong> #${abonnementId.slice(-8).toUpperCase()}</p>
    </div>

    <div class="info-box" style="border-left-color: #f59e0b; background: #fff7ed;">
      <h3>📋 Opzegging Details</h3>
      <p><strong>Type abonnement:</strong> ${uren} uur ${freqText}</p>
      <p><strong>Laatste schoonmaak:</strong> Week ${opzegWeek}, ${opzegJaar}</p>
      <p><strong>Opgezegd op:</strong> ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      ${opzegReden && opzegReden !== 'Geen reden opgegeven' ? `<p><strong>Reden:</strong> ${opzegReden}</p>` : '<p><strong>Reden:</strong> Geen reden opgegeven</p>'}
    </div>

    <div class="info-box">
      <h3>✅ Wat Moet Je Doen?</h3>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li><strong>Laatste schoonmaak:</strong> Voer nog uit t/m week ${opzegWeek} (${opzegJaar})</li>
        <li><strong>Planning:</strong> Je planning wordt automatisch aangepast na de laatste sessie</li>
        <li><strong>Sleutels/toegang:</strong> Zorg dat je eventuele sleutels teruggeeft of toegangscodes afrondt</li>
        <li><strong>Nette afsluiting:</strong> Laat een goede laatste indruk achter - wie weet komt de klant terug!</li>
        <li><strong>Administratie:</strong> Alle administratie wordt door Heppy afgehandeld</li>
      </ul>
    </div>

    <div style="margin: 30px 0; padding: 20px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
      <h3 style="margin-top: 0; color: #92400e;">💬 Contact Met Klant</h3>
      <p style="margin: 10px 0; color: #92400e;">
        Wil je weten waarom de klant stopt? Je mag zelf contact opnemen voor een persoonlijk afscheid of feedback. 
        Dit kan waardevolle informatie opleveren voor jouw dienstverlening.
      </p>
    </div>

    <div style="margin: 30px 0; padding: 20px; background: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
      <h3 style="margin-top: 0; color: #065f46;">🆕 Nieuwe Klanten</h3>
      <p style="margin: 10px 0; color: #065f46;">
        Zodra er een nieuwe klant beschikbaar is in jouw regio, krijg je direct bericht. 
        Je verdiensten blijven dus niet lang stil staan!
      </p>
      <p style="margin: 10px 0; color: #065f46; font-weight: 600;">
        💡 Tip: Heb je meer uren beschikbaar? Laat het ons weten via je dashboard.
      </p>
    </div>

    <div style="text-align: center; margin: 40px 0;">
      <a href="https://heppy-schoonmaak.webflow.io/dashboard/schoonmaker" 
         style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
        Ga Naar Dashboard
      </a>
    </div>

    <div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px;">
      <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
        <strong>Vragen over deze opzegging?</strong>
      </p>
      <p style="margin: 0; color: #666; font-size: 14px;">
        Neem contact met ons op via <a href="mailto:info@heppy-schoonmaak.nl" style="color: #667eea;">info@heppy-schoonmaak.nl</a> of bel naar <a href="tel:+31850606755" style="color: #667eea;">085 060 6755</a>.
      </p>
    </div>
  `;

  return baseLayout(content, 'Klant heeft opgezegd - Heppy');
}
