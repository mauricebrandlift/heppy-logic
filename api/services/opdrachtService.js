// opdrachtService: approve/reject logic voor dieptereiniging opdrachten
import { supabaseConfig, emailConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';
import * as schoonmaakMatchService from './schoonmaakMatchService.js';
import * as schoonmakerService from './schoonmakerService.js';
import { auditService } from './auditService.js';
import { sendEmail } from './emailService.js';

export const opdrachtService = {
  /**
   * Schoonmaker keurt opdracht goed (dieptereiniging)
   * 
   * Flow:
   * 1. Haal opdracht op (check bestaat)
   * 2. Haal actieve match op (schoonmaker_id + opdracht_id, status='open')
   * 3. Valideer: match moet status 'open' hebben
   * 4. Update match.status = 'geaccepteerd'
   * 5. Update opdracht.schoonmaker_id = schoonmaker_id
   * 6. Update opdracht.status = 'geaccepteerd'
   * 7. Audit log
   * 8. Send emails (klant + schoonmaker + admin)
   * 
   * @param {Object} params
   * @param {string} params.opdrachtId - UUID van opdracht
   * @param {string} params.schoonmakerId - UUID van schoonmaker die goedkeurt
   * @param {string} correlationId - Voor logging
   * @returns {Promise<Object>} Result met opdracht, match, schoonmaker
   * @throws {Error} Als opdracht niet bestaat, match niet gevonden, of al goedgekeurd
   */
  async approve({ opdrachtId, schoonmakerId }, correlationId) {
    console.log(`[opdrachtService.approve] START [${correlationId}]`, { opdrachtId, schoonmakerId });

    // STAP 1: Haal opdracht op
    const opdrachtUrl = `${supabaseConfig.url}/rest/v1/opdrachten?id=eq.${opdrachtId}&select=*`;
    const opdrachtResp = await httpClient(opdrachtUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    }, correlationId);

    if (!opdrachtResp.ok) {
      throw new Error(`Failed to fetch opdracht: ${await opdrachtResp.text()}`);
    }

    const opdrachten = await opdrachtResp.json();
    if (!opdrachten || opdrachten.length === 0) {
      const error = new Error('Opdracht not found');
      error.statusCode = 404;
      throw error;
    }

    const opdracht = opdrachten[0];
    console.log(`[opdrachtService.approve] Opdracht found [${correlationId}]`, { 
      id: opdracht.id, 
      status: opdracht.status,
      type: opdracht.type
    });

    // STAP 2: Haal actieve match op
    const matches = await schoonmaakMatchService.findByOpdrachtId(opdrachtId, correlationId);
    
    if (!matches || matches.length === 0) {
      const error = new Error('No match found for this opdracht');
      error.statusCode = 404;
      throw error;
    }

    // Neem de meest recente match (array is gesorteerd op aangemaakt_op DESC)
    const match = matches[0];

    // Valideer dat deze schoonmaker de juiste is
    if (match.schoonmaker_id !== schoonmakerId) {
      const error = new Error('This schoonmaker is not assigned to this opdracht');
      error.statusCode = 403;
      throw error;
    }

    console.log(`[opdrachtService.approve] Match found [${correlationId}]`, { 
      match_id: match.id,
      status: match.status,
      schoonmaker_id: match.schoonmaker_id
    });

    // STAP 3: Valideer match status
    if (match.status === 'geaccepteerd') {
      const error = new Error('Opdracht already approved by this schoonmaker');
      error.statusCode = 409;
      throw error;
    }

    if (match.status === 'geweigerd') {
      const error = new Error('Cannot approve a previously rejected match');
      error.statusCode = 409;
      throw error;
    }

    if (match.status !== 'open') {
      const error = new Error(`Cannot approve match with status: ${match.status}`);
      error.statusCode = 409;
      throw error;
    }

    // STAP 4: Update match status naar 'geaccepteerd'
    await schoonmaakMatchService.updateStatus(match.id, 'geaccepteerd', correlationId);
    console.log(`[opdrachtService.approve] Match status updated to 'geaccepteerd' [${correlationId}]`);

    // STAP 5: Update opdracht.schoonmaker_id en status
    const updateOpdrachtUrl = `${supabaseConfig.url}/rest/v1/opdrachten?id=eq.${opdrachtId}`;
    const updateOpdrachtResp = await httpClient(updateOpdrachtUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        schoonmaker_id: schoonmakerId,
        status: 'gepland'
      })
    }, correlationId);

    if (!updateOpdrachtResp.ok) {
      throw new Error(`Failed to update opdracht: ${await updateOpdrachtResp.text()}`);
    }

    console.log(`[opdrachtService.approve] Opdracht updated [${correlationId}]`, {
      opdracht_id: opdrachtId,
      schoonmaker_id: schoonmakerId,
      status: 'gepland'
    });

    // STAP 6: Audit log
    await auditService.log(
      'opdracht_goedgekeurd',
      opdrachtId,
      'approved',
      schoonmakerId,
      {
        opdracht_id: opdrachtId,
        schoonmaker_id: schoonmakerId,
        match_id: match.id,
        type: opdracht.type
      },
      correlationId
    );

    // STAP 7: Haal schoonmaker gegevens op
    let schoonmakerData = null;
    let klantNaam = 'Beste klant';
    let plaats = 'onbekend';
    let gewensteDatum = opdracht.gewenste_datum;
    
    // Parse gegevens JSONB voor dieptereiniging specifieke data
    const gegevens = opdracht.gegevens || {};
    const uren = gegevens.dr_uren || 0;
    const m2 = gegevens.dr_m2 || null;
    const toiletten = gegevens.dr_toiletten || null;
    const badkamers = gegevens.dr_badkamers || null;

    try {
      // Haal schoonmaker gegevens op
      const schoonmakerUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${schoonmakerId}&select=*`;
      const schoonmakerResp = await httpClient(schoonmakerUrl, {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`
        }
      }, correlationId);

      if (schoonmakerResp.ok) {
        const schoonmakers = await schoonmakerResp.json();
        if (schoonmakers && schoonmakers.length > 0) {
          schoonmakerData = schoonmakers[0];
        }
      }

      // Haal klant gegevens op via gebruiker_id
      if (opdracht.gebruiker_id) {
        const klantUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${opdracht.gebruiker_id}&select=*`;
        const klantResp = await httpClient(klantUrl, {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.anonKey}`
          }
        }, correlationId);

        if (klantResp.ok) {
          const klanten = await klantResp.json();
          if (klanten && klanten.length > 0) {
            const klant = klanten[0];
            klantNaam = `${klant.voornaam || ''} ${klant.achternaam || ''}`.trim() || 'Beste klant';
            
            // Haal adres op via klant.adres_id
            if (klant.adres_id) {
              const adresUrl = `${supabaseConfig.url}/rest/v1/adressen?id=eq.${klant.adres_id}&select=*`;
              const adresResp = await httpClient(adresUrl, {
                method: 'GET',
                headers: {
                  'apikey': supabaseConfig.anonKey,
                  'Authorization': `Bearer ${supabaseConfig.anonKey}`
                }
              }, correlationId);

              if (adresResp.ok) {
                const adressen = await adresResp.json();
                if (adressen && adressen.length > 0) {
                  plaats = adressen[0].plaats || 'onbekend';
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(`⚠️ [opdrachtService.approve] Could not fetch user data [${correlationId}]`, err.message);
    }

    const schoonmakerNaam = schoonmakerData 
      ? `${schoonmakerData.voornaam || ''} ${schoonmakerData.achternaam || ''}`.trim()
      : 'Je schoonmaker';

    const schoonmakerEmail = schoonmakerData?.email || null;
    const klantEmail = gegevens.email || null;

    // STAP 8: 📧 EMAIL TRIGGER: Opdracht goedgekeurd → Klant
    console.log(`📧 [opdrachtService.approve] Sending email to klant [${correlationId}]`);
    if (klantEmail) {
      try {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                      <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Je Schoonmaker Heeft Geaccepteerd!</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 30px;">
                        <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">
                          Hoi ${klantNaam},
                        </p>
                        <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">
                          Goed nieuws! <strong>${schoonmakerNaam}</strong> heeft je dieptereiniging opdracht geaccepteerd en neemt binnenkort contact met je op om de exacte tijd af te spreken.
                        </p>
                        
                        <div class="info-box" style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0; border-radius: 4px;">
                          <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">📋 Jouw Opdracht</h3>
                          <p style="margin: 0; font-size: 14px; color: #666;">
                            <strong style="color: #333;">Type:</strong> Dieptereiniging (eenmalig)<br>
                            <strong style="color: #333;">Plaats:</strong> ${plaats}<br>
                            <strong style="color: #333;">Gewenste datum:</strong> ${gewensteDatum}<br>
                            <strong style="color: #333;">Geschatte duur:</strong> ${uren} uur${m2 ? ` (${m2} m²)` : ''}
                          </p>
                        </div>

                        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
                          <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">📞 Wat Gebeurt Er Nu?</h3>
                          <p style="margin: 0; font-size: 14px; color: #666;">
                            • ${schoonmakerNaam} neemt binnen 48 uur contact met je op<br>
                            • Jullie spreken samen de exacte tijd af<br>
                            • De schoonmaker komt op de afgesproken datum<br>
                            • Je ontvangt na afloop een verzoek voor feedback
                          </p>
                        </div>

                        <div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 4px;">
                          <p style="margin: 0; font-size: 14px; color: #856404;">
                            <strong>💡 Tip:</strong> Zorg dat de ruimte toegankelijk is en verwijder waardevolle voorwerpen. De schoonmaker neemt eigen schoonmaakmiddelen mee.
                          </p>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                          <a href="https://heppy-schoonmaak.nl/dashboard" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                            Bekijk Mijn Opdracht
                          </a>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
                        <p style="margin: 0; font-size: 12px; color: #6c757d;">
                          Vragen? Neem contact op via <a href="mailto:${emailConfig.supportEmail || 'support@heppy-schoonmaak.nl'}" style="color: #667eea;">support</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;

        await sendEmail({
          to: klantEmail,
          subject: `🎉 Je Schoonmaker Heeft Geaccepteerd! - ${schoonmakerNaam}`,
          html: emailHtml
        }, correlationId);

        console.log(`✅ [opdrachtService.approve] Klant email sent to: ${klantEmail} [${correlationId}]`);
      } catch (emailError) {
        console.error(`⚠️ [opdrachtService.approve] Klant email failed (non-critical) [${correlationId}]`, {
          error: emailError.message
        });
      }
    }

    // Delay tussen emails (rate limit protection)
    await new Promise(resolve => setTimeout(resolve, 600));

    // STAP 9: 📧 EMAIL TRIGGER: Opdracht goedgekeurd → Schoonmaker (bevestiging)
    console.log(`📧 [opdrachtService.approve] Sending confirmation email to schoonmaker [${correlationId}]`);
    if (schoonmakerEmail && klantEmail) {
      try {
        const schoonmakerEmailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                      <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">✅ Bevestiging: Opdracht Geaccepteerd</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 30px;">
                        <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">
                          Hoi ${schoonmakerNaam},
                        </p>
                        <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">
                          Je hebt de dieptereiniging opdracht succesvol geaccepteerd! Neem binnen 48 uur contact op met de klant om de exacte tijd af te spreken.
                        </p>
                        
                        <div style="background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
                          <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">📋 Klant Gegevens</h3>
                          <p style="margin: 0; font-size: 14px; color: #666;">
                            <strong style="color: #333;">Naam:</strong> ${klantNaam}<br>
                            <strong style="color: #333;">Email:</strong> <a href="mailto:${klantEmail}" style="color: #667eea;">${klantEmail}</a><br>
                            <strong style="color: #333;">Plaats:</strong> ${plaats}<br>
                            <strong style="color: #333;">Gewenste datum:</strong> ${gewensteDatum}
                          </p>
                        </div>

                        <div style="background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 4px;">
                          <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">🧹 Opdracht Details</h3>
                          <p style="margin: 0; font-size: 14px; color: #666;">
                            <strong style="color: #333;">Type:</strong> Dieptereiniging (eenmalig)<br>
                            <strong style="color: #333;">Geschatte duur:</strong> ${uren} uur<br>
                            ${m2 ? `<strong style="color: #333;">Oppervlakte:</strong> ${m2} m²<br>` : ''}
                            ${toiletten ? `<strong style="color: #333;">Toiletten:</strong> ${toiletten}<br>` : ''}
                            ${badkamers ? `<strong style="color: #333;">Badkamers:</strong> ${badkamers}<br>` : ''}
                            <strong style="color: #333;">Status:</strong> ✓ Reeds betaald door klant
                          </p>
                        </div>

                        <div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 4px;">
                          <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 16px;">💬 Volgende Stappen</h3>
                          <p style="margin: 0; font-size: 14px; color: #856404;">
                            1. <strong>Neem binnen 48 uur contact op</strong> met de klant<br>
                            2. Bespreek de exacte tijd en eventuele specifieke wensen<br>
                            3. Voer de dieptereiniging uit op de afgesproken datum<br>
                            4. Vraag feedback na afloop
                          </p>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                          <a href="https://heppy-schoonmaak.nl/dashboard/schoonmaker" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                            Open Dashboard
                          </a>
                        </div>

                        <p style="font-size: 14px; color: #666; margin: 20px 0 0 0;">
                          Succes met je opdracht! 🎉
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
                        <p style="margin: 0; font-size: 12px; color: #6c757d;">
                          Vragen? Neem contact op via <a href="mailto:${emailConfig.supportEmail || 'support@heppy-schoonmaak.nl'}" style="color: #667eea;">support</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;

        await sendEmail({
          to: schoonmakerEmail,
          subject: `✅ Bevestiging: Je hebt de opdracht geaccepteerd - ${klantNaam}`,
          html: schoonmakerEmailHtml
        }, correlationId);

        console.log(`✅ [opdrachtService.approve] Schoonmaker confirmation sent to: ${schoonmakerEmail} [${correlationId}]`);
      } catch (emailError) {
        console.error(`⚠️ [opdrachtService.approve] Schoonmaker email failed (non-critical) [${correlationId}]`, {
          error: emailError.message
        });
      }
    }

    // Delay tussen emails (rate limit protection)
    await new Promise(resolve => setTimeout(resolve, 600));

    // STAP 10: 📧 EMAIL TRIGGER: Admin notificatie - Opdracht geaccepteerd
    try {
      console.log(`📧 [opdrachtService.approve] Sending admin notification [${correlationId}]`);
      
      const adminEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                      <h1 style="color: white; margin: 0; font-size: 24px;">✅ Dieptereiniging Opdracht Geaccepteerd</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px;">
                      <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">
                        Goed nieuws! Een schoonmaker heeft een dieptereiniging opdracht geaccepteerd.
                      </p>
                      
                      <div style="background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0; font-size: 14px; color: #666;">
                          <strong style="color: #333;">Schoonmaker:</strong> ${schoonmakerNaam}<br>
                          <strong style="color: #333;">Klant:</strong> ${klantNaam}<br>
                          <strong style="color: #333;">Type:</strong> Dieptereiniging (eenmalig)<br>
                          <strong style="color: #333;">Plaats:</strong> ${plaats}<br>
                          <strong style="color: #333;">Gewenste datum:</strong> ${gewensteDatum}<br>
                          <strong style="color: #333;">Uren:</strong> ${uren} uur${m2 ? ` (${m2} m²)` : ''}<br>
                          <strong style="color: #333;">Match ID:</strong> ${match.id}<br>
                          <strong style="color: #333;">Opdracht ID:</strong> ${opdracht.id}
                        </p>
                      </div>
                      
                      <p style="font-size: 14px; color: #666; margin: 20px 0 0 0;">
                        De klant en schoonmaker hebben beide een bevestigingsmail ontvangen.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
                      <p style="margin: 0; font-size: 12px; color: #6c757d;">
                        Heppy Admin Notificatie
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await sendEmail({
        to: emailConfig.notificationsEmail,
        subject: `✅ Dieptereiniging Geaccepteerd - ${schoonmakerNaam} → ${klantNaam} (${plaats})`,
        html: adminEmailHtml
      }, correlationId);

      console.log(`✅ [opdrachtService.approve] Admin email sent to: ${emailConfig.notificationsEmail} [${correlationId}]`);
    } catch (emailError) {
      console.error(`⚠️ [opdrachtService.approve] Admin email failed (non-critical) [${correlationId}]`, {
        error: emailError.message
      });
    }

    console.log(`[opdrachtService.approve] SUCCESS [${correlationId}]`);

    // Return complete result
    return {
      opdracht: {
        id: opdracht.id,
        status: 'geaccepteerd',
        type: opdracht.type
      },
      match: {
        id: match.id,
        status: 'geaccepteerd'
      },
      schoonmaker: {
        id: schoonmakerId
      }
    };
  },

  /**
   * Schoonmaker keurt opdracht af (dieptereiniging)
   * 
   * Flow:
   * 1. Haal opdracht op (check bestaat)
   * 2. Haal actieve match op (schoonmaker_id + opdracht_id, status='open')
   * 3. Valideer: match moet status 'open' hebben
   * 4. Update match.status = 'geweigerd' + afwijzing_reden
   * 5. Haal lijst van eerder afgewezen schoonmakers op
   * 6. Zoek nieuwe schoonmaker (exclude afgewezen lijst)
   * 7a. Als gevonden: maak nieuwe match (status='open')
   * 7b. Als NIET gevonden: update opdracht.status = 'afgewezen'
   * 8. Audit log
   * 9. Send emails
   * 
   * @param {Object} params
   * @param {string} params.opdrachtId - UUID van opdracht
   * @param {string} params.schoonmakerId - UUID van schoonmaker die afkeurt
   * @param {string|null} params.reden - Optionele afwijzingsreden
   * @param {string} correlationId - Voor logging
   * @returns {Promise<Object>} Result met opdracht, rejectedMatch, newMatch (of null)
   * @throws {Error} Als opdracht niet bestaat, match niet gevonden, of al afgewezen
   */
  async reject({ opdrachtId, schoonmakerId, reden }, correlationId) {
    console.log(`[opdrachtService.reject] START [${correlationId}]`, { 
      opdrachtId, 
      schoonmakerId,
      reden: reden || '(geen reden)'
    });

    // STAP 1: Haal opdracht op
    const opdrachtUrl = `${supabaseConfig.url}/rest/v1/opdrachten?id=eq.${opdrachtId}&select=*`;
    const opdrachtResp = await httpClient(opdrachtUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    }, correlationId);

    if (!opdrachtResp.ok) {
      throw new Error(`Failed to fetch opdracht: ${await opdrachtResp.text()}`);
    }

    const opdrachten = await opdrachtResp.json();
    if (!opdrachten || opdrachten.length === 0) {
      const error = new Error('Opdracht not found');
      error.statusCode = 404;
      throw error;
    }

    const opdracht = opdrachten[0];
    console.log(`[opdrachtService.reject] Opdracht found [${correlationId}]`, { 
      id: opdracht.id, 
      status: opdracht.status,
      type: opdracht.type
    });

    // STAP 2: Haal actieve match op
    const matches = await schoonmaakMatchService.findByOpdrachtId(opdrachtId, correlationId);
    
    if (!matches || matches.length === 0) {
      const error = new Error('No match found for this opdracht');
      error.statusCode = 404;
      throw error;
    }

    // Neem de meest recente match (array is gesorteerd op aangemaakt_op DESC)
    const match = matches[0];

    // Valideer dat deze schoonmaker de juiste is
    if (match.schoonmaker_id !== schoonmakerId) {
      const error = new Error('This schoonmaker is not assigned to this opdracht');
      error.statusCode = 403;
      throw error;
    }

    console.log(`[opdrachtService.reject] Match found [${correlationId}]`, { 
      match_id: match.id,
      status: match.status,
      schoonmaker_id: match.schoonmaker_id
    });

    // STAP 3: Valideer match status
    if (match.status === 'geweigerd') {
      const error = new Error('Match already rejected by this schoonmaker');
      error.statusCode = 409;
      throw error;
    }

    if (match.status === 'geaccepteerd') {
      const error = new Error('Cannot reject an accepted match');
      error.statusCode = 409;
      throw error;
    }

    if (match.status !== 'open') {
      const error = new Error(`Cannot reject match with status: ${match.status}`);
      error.statusCode = 409;
      throw error;
    }

    // STAP 4: Update match status naar 'geweigerd' + reden
    const updateMatchUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_match?id=eq.${match.id}`;
    const updateMatchResp = await httpClient(updateMatchUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        status: 'geweigerd',
        afwijzing_reden: reden || null,
        bijgewerkt_op: new Date().toISOString()
      })
    }, correlationId);

    if (!updateMatchResp.ok) {
      throw new Error(`Failed to update match: ${await updateMatchResp.text()}`);
    }

    console.log(`[opdrachtService.reject] Match status updated to 'geweigerd' [${correlationId}]`);

    // STAP 5: Haal lijst van eerder afgewezen schoonmakers op
    const rejectedMatches = matches.filter(m => m.status === 'geweigerd');
    const excludeSchoonmakerIds = rejectedMatches.map(m => m.schoonmaker_id).filter(Boolean);
    
    // Voeg de HUIDIGE afgewezen schoonmaker toe (net ge-update, niet in matches array)
    if (!excludeSchoonmakerIds.includes(schoonmakerId)) {
      excludeSchoonmakerIds.push(schoonmakerId);
    }
    
    console.log(`[opdrachtService.reject] Excluding ${excludeSchoonmakerIds.length} previously rejected schoonmakers [${correlationId}]`, {
      excluded_ids: excludeSchoonmakerIds
    });

    // STAP 6: Zoek nieuwe schoonmaker (indien beschikbaar) - TODO: Implement findAndAssignForOpdracht
    console.log(`[opdrachtService.reject] Searching for new schoonmaker [${correlationId}]`);
    
    let newMatch = null;
    let newSchoonmaker = null;

    // TODO: Voor nu skippen we auto-matching bij dieptereiniging reject
    // Later kunnen we een specifieke findAndAssignForDieptereiniging functie maken
    console.log(`ℹ️ [opdrachtService.reject] Auto-matching for dieptereiniging not yet implemented [${correlationId}]`);

    // STAP 7: Als geen nieuwe schoonmaker gevonden, update opdracht status
    if (!newMatch) {
      console.log(`[opdrachtService.reject] No new match found, updating opdracht status [${correlationId}]`);
      
      const updateOpdrachtUrl = `${supabaseConfig.url}/rest/v1/opdrachten?id=eq.${opdrachtId}`;
      const updateOpdrachtResp = await httpClient(updateOpdrachtUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          status: 'geannuleerd'
        })
      }, correlationId);

      if (!updateOpdrachtResp.ok) {
        throw new Error(`Failed to update opdracht: ${await updateOpdrachtResp.text()}`);
      }

      console.log(`[opdrachtService.reject] Opdracht status updated to 'geannuleerd' [${correlationId}]`);
    }

    // STAP 8: Audit log
    await auditService.log(
      'opdracht_afgewezen',
      opdrachtId,
      'rejected',
      schoonmakerId,
      {
        opdracht_id: opdrachtId,
        rejected_match_id: match.id,
        schoonmaker_id: schoonmakerId,
        reden: reden || null,
        new_match_found: newMatch !== null,
        excluded_schoonmakers: excludeSchoonmakerIds,
        type: opdracht.type
      },
      correlationId
    );

    // STAP 9: 📧 EMAIL TRIGGERS
    // Scenario: Geen nieuwe match (altijd voor dieptereiniging reject) → Email naar admin
    console.log(`📧 [opdrachtService.reject] Sending admin notification [${correlationId}]`);
    
    try {
      // Parse gegevens voor email data
      const gegevens = opdracht.gegevens || {};
      const uren = gegevens.dr_uren || 0;
      const m2 = gegevens.dr_m2 || null;
      const klantEmail = gegevens.email || 'geen email';
      
      // Haal klant gegevens op
      let klantNaam = 'Onbekende klant';
      let plaats = 'onbekend';
      
      if (opdracht.gebruiker_id) {
        try {
          const klantUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${opdracht.gebruiker_id}&select=*`;
          const klantResp = await httpClient(klantUrl, {
            method: 'GET',
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${supabaseConfig.anonKey}`
            }
          }, correlationId);

          if (klantResp.ok) {
            const klanten = await klantResp.json();
            if (klanten && klanten.length > 0) {
              const klant = klanten[0];
              klantNaam = `${klant.voornaam || ''} ${klant.achternaam || ''}`.trim() || 'Onbekende klant';
              
              // Haal adres op
              if (klant.adres_id) {
                const adresUrl = `${supabaseConfig.url}/rest/v1/adressen?id=eq.${klant.adres_id}&select=plaats`;
                const adresResp = await httpClient(adresUrl, {
                  method: 'GET',
                  headers: {
                    'apikey': supabaseConfig.anonKey,
                    'Authorization': `Bearer ${supabaseConfig.anonKey}`
                  }
                }, correlationId);

                if (adresResp.ok) {
                  const adressen = await adresResp.json();
                  if (adressen && adressen.length > 0) {
                    plaats = adressen[0].plaats || 'onbekend';
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn(`⚠️ [opdrachtService.reject] Could not fetch klant data [${correlationId}]`, err.message);
        }
      }

      const adminEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center;">
                      <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Dieptereiniging Opdracht Afgewezen</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px;">
                      <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">
                        Een schoonmaker heeft een dieptereiniging opdracht afgewezen. <strong>Handmatige actie vereist.</strong>
                      </p>
                      
                      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0; font-size: 14px; color: #856404;">
                          <strong>⏰ Actie Vereist:</strong> Wijs handmatig een nieuwe schoonmaker toe voor deze opdracht.
                        </p>
                      </div>

                      <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">📋 Opdracht Details</h3>
                        <p style="margin: 0; font-size: 14px; color: #666;">
                          <strong style="color: #333;">Type:</strong> Dieptereiniging (eenmalig)<br>
                          <strong style="color: #333;">Klant:</strong> ${klantNaam}<br>
                          <strong style="color: #333;">Email:</strong> ${klantEmail}<br>
                          <strong style="color: #333;">Plaats:</strong> ${plaats}<br>
                          <strong style="color: #333;">Gewenste datum:</strong> ${opdracht.gewenste_datum}<br>
                          <strong style="color: #333;">Uren:</strong> ${uren} uur${m2 ? ` (${m2} m²)` : ''}<br>
                          <strong style="color: #333;">Aantal afwijzingen:</strong> ${excludeSchoonmakerIds.length}<br>
                          <strong style="color: #333;">Afwijzingsreden:</strong> ${reden || '(geen reden opgegeven)'}<br>
                          <strong style="color: #333;">Opdracht ID:</strong> ${opdracht.id}
                        </p>
                      </div>

                      <p style="font-size: 14px; color: #666; margin: 20px 0 0 0;">
                        Let op: Auto-matching voor dieptereiniging is nog niet geïmplementeerd. Wijs handmatig een schoonmaker toe via het admin dashboard.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
                      <p style="margin: 0; font-size: 12px; color: #6c757d;">
                        Heppy Admin Notificatie - Actie Vereist
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await sendEmail({
        to: emailConfig.notificationsEmail,
        subject: `⚠️ Dieptereiniging Afgewezen - Actie Vereist - ${klantNaam} (${plaats})`,
        html: adminEmailHtml
      }, correlationId);

      console.log(`✅ [opdrachtService.reject] Admin email sent to: ${emailConfig.notificationsEmail} [${correlationId}]`);
    } catch (emailError) {
      console.error(`⚠️ [opdrachtService.reject] Admin email failed (non-critical) [${correlationId}]`, {
        error: emailError.message
      });
    }

    console.log(`[opdrachtService.reject] SUCCESS [${correlationId}]`);

    // Return complete result
    return {
      opdracht: {
        id: opdracht.id,
        status: 'afgewezen',
        type: opdracht.type
      },
      rejectedMatch: {
        id: match.id,
        status: 'geweigerd',
        reden: reden || null
      },
      newMatch: null // Always null voor nu (geen auto-matching voor dieptereiniging)
    };
  }
};
