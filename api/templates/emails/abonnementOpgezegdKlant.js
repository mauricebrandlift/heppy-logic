/**
 * Email Template: Abonnement Opgezegd (Klant)
 * 
 * Wordt verzonden naar klant wanneer abonnement wordt opgezegd.
 * Bevestigt de opzegging en geeft informatie over laatste sessies.
 */

import { baseLayout } from './baseLayout.js';

/**
 * Genereer HTML voor abonnement opzeg bevestiging (Klant)
 * 
 * @param {Object} data - Template data
 * @param {string} data.voornaam - Voornaam van de klant
 * @param {string} data.achternaam - Achternaam van de klant
 * @param {string} data.abonnementId - UUID van het abonnement (laatste 8 chars gebruikt)
 * @param {number} data.opzegWeek - Weeknummer van laatste sessie
 * @param {number} data.opzegJaar - Jaar van laatste sessie
 * @param {string} data.opzegReden - Opgegeven reden (optioneel)
 * @param {number} data.uren - Aantal uren per sessie
 * @param {string} data.frequentie - Frequentie (wekelijks, 2-wekelijks, 4-wekelijks)
 * @returns {string} HTML string
 */
export function abonnementOpgezegdKlant(data) {
  const {
    voornaam,
    achternaam = '',
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
    <h2>💔 Jammer Dat Je Weggaat</h2>
    
    <p>Beste ${voornaam},</p>
    
    <p>We hebben je opzegging van het schoonmaakabonnement ontvangen en verwerkt. Bedankt dat je voor Heppy hebt gekozen.</p>

    <div class="info-box" style="border-left-color: #f59e0b; background: #fff7ed;">
      <h3>📋 Opzegging Details</h3>
      <p><strong>Abonnement ID:</strong> #${abonnementId.slice(-8).toUpperCase()}</p>
      <p><strong>Type:</strong> ${uren} uur ${freqText}</p>
      <p><strong>Laatste schoonmaak:</strong> Week ${opzegWeek}, ${opzegJaar}</p>
      <p><strong>Opgezegd op:</strong> ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      ${opzegReden && opzegReden !== 'Geen reden opgegeven' ? `<p><strong>Reden:</strong> ${opzegReden}</p>` : ''}
    </div>

    <div class="info-box">
      <h3>ℹ️ Wat Gebeurt Er Nu?</h3>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li><strong>Laatste schoonmaak:</strong> Je schoonmaker komt nog t/m week ${opzegWeek} (${opzegJaar})</li>
        <li><strong>Betalingen:</strong> Automatische incasso's worden gestopt na de laatste facturatie</li>
        <li><strong>Sleutels/toegang:</strong> Zorg dat je eventuele sleutels of toegangscodes afrondt met je schoonmaker</li>
        <li><strong>Account:</strong> Je account blijft actief - je kunt altijd opnieuw starten</li>
      </ul>
    </div>

    <div style="margin: 30px 0; padding: 20px; background: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
      <h3 style="margin-top: 0; color: #065f46;">💚 Toch Van Gedachten Veranderd?</h3>
      <p style="margin: 10px 0; color: #065f46;">
        Je kunt je opzegging annuleren tot aan de laatste schoonmaakdatum. Neem contact met ons op via:
      </p>
      <p style="margin: 10px 0; color: #065f46;">
        📧 <a href="mailto:info@heppy-schoonmaak.nl" style="color: #10b981; font-weight: 600;">info@heppy-schoonmaak.nl</a><br>
        📞 <a href="tel:+31850606755" style="color: #10b981; font-weight: 600;">085 060 6755</a>
      </p>
    </div>

    <div class="info-box" style="background: #fef3c7; border-left-color: #f59e0b;">
      <h3>📝 We Horen Graag Je Feedback</h3>
      <p style="margin: 10px 0;">
        Om onze service te verbeteren, zijn we benieuwd waarom je weggaat. 
        ${!opzegReden || opzegReden === 'Geen reden opgegeven' ? 
          `Zou je 2 minuten hebben om een korte <a href="https://heppy-schoonmaak.nl/contact" style="color: #667eea; font-weight: 600;">feedback vragenlijst</a> in te vullen?` :
          `Bedankt voor je feedback. We nemen dit mee in onze verbeteringen.`
        }
      </p>
    </div>

    <div style="text-align: center; margin: 40px 0;">
      <a href="https://heppy-schoonmaak.webflow.io/dashboard/klant/overview" 
         style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
        Ga Naar Dashboard
      </a>
    </div>

    <div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; text-align: center;">
      <h3 style="margin-top: 0; color: #667eea;">✨ We Hopen Je Snel Terug Te Zien!</h3>
      <p style="margin: 0; color: #666; font-size: 14px;">
        Bedankt voor je vertrouwen in Heppy. We wensen je het allerbeste!<br>
        Mocht je in de toekomst weer schoonmaakhulp nodig hebben, dan staan we voor je klaar.
      </p>
    </div>
  `;

  return baseLayout(content, 'Opzegging bevestigd - Heppy');
}
