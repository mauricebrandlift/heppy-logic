// aanvraagService: create schoonmaak_aanvraag
import { supabaseConfig, emailConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';
import * as schoonmaakMatchService from './schoonmaakMatchService.js';
import * as schoonmakerService from './schoonmakerService.js';
import { auditService } from './auditService.js';
import { sendEmail } from './emailService.js';
import { 
  matchGoedgekeurdKlant,
  matchAfgewezenAdmin,
  geenSchoonmakerBeschikbaarKlant
} from '../templates/emails/index.js';

function uuid(){
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
}

export const aanvraagService = {
  async create(meta, addressId, correlationId){
    const id = uuid();
    const url = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen`;
    const body = { id, voornaam: meta.voornaam||null, achternaam: meta.achternaam||null, email: meta.email||null, telefoon: meta.telefoon||null, adres_id: addressId, uren: meta.uren||null, startdatum: meta.startdatum||null, schoonmaak_optie: meta.frequentie||null, status: 'betaald' };
    const resp = await httpClient(url, { method:'POST', headers:{ 'Content-Type':'application/json','apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}`,'Prefer':'return=minimal' }, body: JSON.stringify(body) }, correlationId);
    if(!resp.ok) throw new Error(`schoonmaak_aanvragen insert failed: ${await resp.text()}`);
    return { id };
  },

  /**
   * Schoonmaker keurt aanvraag goed
   * 
   * Flow:
   * 1. Haal aanvraag op (check bestaat)
   * 2. Haal gerelateerd abonnement op (via aanvraag_id)
   * 3. Haal actieve match op (schoonmaker_id + aanvraag_id, status='open')
   * 4. Valideer: match moet status 'open' hebben
   * 5. Update match.status = 'geaccepteerd'
   * 6. Update abonnement.schoonmaker_id = schoonmaker_id
   * 7. Update abonnement.status = 'actief'
   * 8. Update aanvraag.status = 'geaccepteerd'
   * 9. Audit log
   * 
   * @param {Object} params
   * @param {string} params.aanvraagId - UUID van schoonmaak_aanvraag
   * @param {string} params.schoonmakerId - UUID van schoonmaker die goedkeurt
   * @param {string} correlationId - Voor logging
   * @returns {Promise<Object>} Result met aanvraag, abonnement, match, schoonmaker
   * @throws {Error} Als aanvraag niet bestaat, match niet gevonden, of al goedgekeurd
   */
  async approve({ aanvraagId, schoonmakerId }, correlationId) {
    console.log(`[aanvraagService.approve] START [${correlationId}]`, { aanvraagId, schoonmakerId });

    // STAP 1: Haal aanvraag op
    const aanvraagUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen?id=eq.${aanvraagId}&select=*`;
    const aanvraagResp = await httpClient(aanvraagUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    }, correlationId);

    if (!aanvraagResp.ok) {
      throw new Error(`Failed to fetch aanvraag: ${await aanvraagResp.text()}`);
    }

    const aanvragen = await aanvraagResp.json();
    if (!aanvragen || aanvragen.length === 0) {
      const error = new Error('Aanvraag not found');
      error.statusCode = 404;
      throw error;
    }

    const aanvraag = aanvragen[0];
    console.log(`[aanvraagService.approve] Aanvraag found [${correlationId}]`, { 
      id: aanvraag.id, 
      status: aanvraag.status 
    });

    // STAP 2: Haal gerelateerd abonnement op
    const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?schoonmaak_aanvraag_id=eq.${aanvraagId}&select=*`;
    const abonnementResp = await httpClient(abonnementUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    }, correlationId);

    if (!abonnementResp.ok) {
      throw new Error(`Failed to fetch abonnement: ${await abonnementResp.text()}`);
    }

    const abonnementen = await abonnementResp.json();
    if (!abonnementen || abonnementen.length === 0) {
      const error = new Error('Abonnement not found for this aanvraag');
      error.statusCode = 404;
      throw error;
    }

    const abonnement = abonnementen[0];
    console.log(`[aanvraagService.approve] Abonnement found [${correlationId}]`, { 
      id: abonnement.id,
      status: abonnement.status
    });

    // STAP 3: Haal actieve match op
    const matches = await schoonmaakMatchService.findByAanvraagId(aanvraagId, correlationId);
    
    if (!matches || matches.length === 0) {
      const error = new Error('No match found for this aanvraag');
      error.statusCode = 404;
      throw error;
    }

    // Neem de meest recente match (array is gesorteerd op aangemaakt_op DESC)
    const match = matches[0];

    // Valideer dat deze schoonmaker de juiste is
    if (match.schoonmaker_id !== schoonmakerId) {
      const error = new Error('This schoonmaker is not assigned to this aanvraag');
      error.statusCode = 403;
      throw error;
    }

    console.log(`[aanvraagService.approve] Match found [${correlationId}]`, { 
      match_id: match.id,
      status: match.status,
      schoonmaker_id: match.schoonmaker_id
    });

    // STAP 4: Valideer match status
    if (match.status === 'geaccepteerd') {
      const error = new Error('Aanvraag already approved by this schoonmaker');
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

    // STAP 5: Update match status naar 'geaccepteerd'
    await schoonmaakMatchService.updateStatus(match.id, 'geaccepteerd', correlationId);
    console.log(`[aanvraagService.approve] Match status updated to 'geaccepteerd' [${correlationId}]`);

    // STAP 6: Update abonnement.schoonmaker_id
    const updateAbonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${abonnement.id}`;
    const updateAbonnementResp = await httpClient(updateAbonnementUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        schoonmaker_id: schoonmakerId,
        status: 'actief'
      })
    }, correlationId);

    if (!updateAbonnementResp.ok) {
      throw new Error(`Failed to update abonnement: ${await updateAbonnementResp.text()}`);
    }

    console.log(`[aanvraagService.approve] Abonnement updated [${correlationId}]`, {
      abonnement_id: abonnement.id,
      schoonmaker_id: schoonmakerId,
      status: 'actief'
    });

    // STAP 7: Update aanvraag.status naar 'geaccepteerd'
    const updateAanvraagUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen?id=eq.${aanvraagId}`;
    const updateAanvraagResp = await httpClient(updateAanvraagUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        status: 'geaccepteerd'
      })
    }, correlationId);

    if (!updateAanvraagResp.ok) {
      throw new Error(`Failed to update aanvraag: ${await updateAanvraagResp.text()}`);
    }

    console.log(`[aanvraagService.approve] Aanvraag status updated to 'geaccepteerd' [${correlationId}]`);

    // STAP 8: Audit log
    await auditService.log(
      'aanvraag_goedgekeurd',
      aanvraagId,
      'approved',
      schoonmakerId,
      {
        aanvraag_id: aanvraagId,
        abonnement_id: abonnement.id,
        schoonmaker_id: schoonmakerId,
        match_id: match.id
      },
      correlationId
    );

    // STAP 9: Haal schoonmaker gegevens + dagdelen op (voor alle emails)
    let schoonmakerData = null;
    let dagdelen = {};
    let klantNaam = `${aanvraag.voornaam || ''} ${aanvraag.achternaam || ''}`.trim() || 'Beste klant';
    let plaats = aanvraag.plaats || 'onbekend';
    let startdatum = aanvraag.startdatum || abonnement.startdatum;
    let uren = aanvraag.uren || 4;

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

      // Haal voorkeurs_dagdelen op (gebruik aanvraag.user_id!)
      const dagdelenUrl = `${supabaseConfig.url}/rest/v1/voorkeurs_dagdelen?user_id=eq.${aanvraag.user_id}&select=*`;
      const dagdelenResp = await httpClient(dagdelenUrl, {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`
        }
      }, correlationId);

      if (dagdelenResp.ok) {
        const dagdelenData = await dagdelenResp.json();
        console.log(`📊 [aanvraagService.approve] Dagdelen data fetched [${correlationId}]`, { count: dagdelenData?.length || 0 });
        if (dagdelenData && dagdelenData.length > 0) {
          // Convert array naar object format {maandag: ['ochtend']}
          dagdelenData.forEach(item => {
            if (!dagdelen[item.dag]) {
              dagdelen[item.dag] = [];
            }
            dagdelen[item.dag].push(item.dagdeel);
          });
        }
      }

      // Haal adres op voor volledige adresgegevens
      if (aanvraag.adres_id) {
        try {
          const adresUrl = `${supabaseConfig.url}/rest/v1/adressen?id=eq.${aanvraag.adres_id}&select=*`;
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
              const adres = adressen[0];
              plaats = adres.plaats || plaats; // Update plaats met volledige adres data
            }
          }
        } catch (err) {
          console.warn(`⚠️ [aanvraagService.approve] Could not fetch address [${correlationId}]`, err.message);
        }
      }
    } catch (err) {
      console.warn(`⚠️ [aanvraagService.approve] Could not fetch schoonmaker/dagdelen data [${correlationId}]`, err.message);
    }

    const schoonmakerNaam = schoonmakerData 
      ? `${schoonmakerData.voornaam || ''} ${schoonmakerData.achternaam || ''}`.trim()
      : 'Je schoonmaker';

    const schoonmakerEmail = schoonmakerData?.email || null;
    const schoonmakerTelefoon = schoonmakerData?.telefoon || null;

    // STAP 10: 📧 EMAIL TRIGGER: Match goedgekeurd → Klant
    console.log(`📧 [aanvraagService.approve] Sending email to klant [${correlationId}]`);
    try {
      const emailHtml = matchGoedgekeurdKlant({
        klantNaam,
        schoonmakerNaam,
        schoonmakerFoto: null, // TODO: Add when schoonmaker fotos are implemented
        schoonmakerBio: null, // TODO: Add when schoonmaker bios are available
        startdatum,
        uren,
        dagdelen: Object.keys(dagdelen).length > 0 ? dagdelen : null,
        plaats,
        aanvraagId: aanvraag.id,
        matchId: match.id
      });

      await sendEmail({
        to: aanvraag.email,
        subject: `🎉 Je Schoonmaker Heeft Geaccepteerd! - Heppy`,
        html: emailHtml
      }, correlationId);

      console.log(`✅ [aanvraagService.approve] Email sent to klant: ${aanvraag.email} [${correlationId}]`);
    } catch (emailError) {
      // Email failure mag approve flow niet breken
      console.error(`⚠️ [aanvraagService.approve] Klant email failed (non-critical) [${correlationId}]`, {
        error: emailError.message,
        klant_email: aanvraag.email
      });
    }

    // Delay tussen emails (rate limit protection)
    await new Promise(resolve => setTimeout(resolve, 600));

    // STAP 11: 📧 EMAIL TRIGGER: Match goedgekeurd → Schoonmaker (bevestiging)
    console.log(`📧 [aanvraagService.approve] Sending confirmation email to schoonmaker [${correlationId}]`);
    if (schoonmakerEmail) {
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
                        <h1 style="color: white; margin: 0; font-size: 24px;">✅ Bevestiging: Aanvraag Geaccepteerd</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 30px;">
                        <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">
                          Hoi ${schoonmakerNaam},
                        </p>
                        <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">
                          Je hebt de aanvraag succesvol geaccepteerd! Hier zijn de klant gegevens voor de eerste schoonmaak.
                        </p>
                        
                        <div style="background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
                          <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">📋 Klant Gegevens</h3>
                          <p style="margin: 0; font-size: 14px; color: #666;">
                            <strong style="color: #333;">Naam:</strong> ${klantNaam}<br>
                            <strong style="color: #333;">Email:</strong> <a href="mailto:${aanvraag.email}" style="color: #667eea;">${aanvraag.email}</a><br>
                            ${aanvraag.telefoon ? `<strong style="color: #333;">Telefoon:</strong> <a href="tel:${aanvraag.telefoon}" style="color: #667eea;">${aanvraag.telefoon}</a><br>` : ''}
                            <strong style="color: #333;">Adres:</strong> ${plaats}<br>
                            <strong style="color: #333;">Startdatum:</strong> ${startdatum}<br>
                            <strong style="color: #333;">Uren per week:</strong> ${uren} uur
                          </p>
                        </div>

                        <div style="background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 4px;">
                          <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">🕐 Voorkeur Dagdelen Klant</h3>
                          <p style="margin: 0; font-size: 14px; color: #666;">
                            ${Object.keys(dagdelen).length > 0 
                              ? Object.entries(dagdelen).map(([dag, delen]) => `<strong>${dag.charAt(0).toUpperCase() + dag.slice(1)}:</strong> ${delen.join(', ')}`).join('<br>')
                              : '<em>Klant heeft geen specifieke voorkeur doorgegeven</em>'}
                          </p>
                        </div>

                        <div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 4px;">
                          <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 16px;">💬 Communicatie</h3>
                          <p style="margin: 0; font-size: 14px; color: #856404;">
                            • <strong>Direct contact:</strong> Neem contact op via email of telefoon voor eerste afspraak<br>
                            • <strong>Dashboard chat:</strong> Communiceer via het dashboard voor vragen en updates
                          </p>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                          <a href="https://heppy-schoonmaak.nl/dashboard/schoonmaker" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                            Open Dashboard
                          </a>
                        </div>

                        <p style="font-size: 14px; color: #666; margin: 20px 0 0 0;">
                          Succes met je nieuwe klant! 🎉
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
          subject: `✅ Bevestiging: Je hebt de aanvraag geaccepteerd - ${klantNaam}`,
          html: schoonmakerEmailHtml
        }, correlationId);

        console.log(`✅ [aanvraagService.approve] Schoonmaker confirmation sent to: ${schoonmakerEmail} [${correlationId}]`);
      } catch (emailError) {
        console.error(`⚠️ [aanvraagService.approve] Schoonmaker email failed (non-critical) [${correlationId}]`, {
          error: emailError.message
        });
      }
    } else {
      console.warn(`⚠️ [aanvraagService.approve] No schoonmaker email found, skipping confirmation [${correlationId}]`);
    }

    // Delay tussen emails (rate limit protection)
    await new Promise(resolve => setTimeout(resolve, 600));

    // STAP 12: 📧 EMAIL TRIGGER: Admin notificatie - Match geaccepteerd
    try {
      console.log(`📧 [aanvraagService.approve] Sending admin notification [${correlationId}]`);
      
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
                      <h1 style="color: white; margin: 0; font-size: 24px;">✅ Match Geaccepteerd</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px;">
                      <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">
                        Goed nieuws! Een schoonmaker heeft de aanvraag geaccepteerd.
                      </p>
                      
                          <div style="background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0; font-size: 14px; color: #666;">
                          <strong style="color: #333;">Schoonmaker:</strong> ${schoonmakerNaam}<br>
                          <strong style="color: #333;">Klant:</strong> ${klantNaam}<br>
                          <strong style="color: #333;">Plaats:</strong> ${plaats}<br>
                          <strong style="color: #333;">Startdatum:</strong> ${startdatum}<br>
                          <strong style="color: #333;">Uren:</strong> ${uren} uur per week<br>
                          <strong style="color: #333;">Match ID:</strong> ${match.id}<br>
                          <strong style="color: #333;">Aanvraag ID:</strong> ${aanvraag.id}
                        </p>
                      </div>                      <p style="font-size: 14px; color: #666; margin: 20px 0 0 0;">
                        De klant heeft een bevestigingsmail ontvangen met de schoonmaker gegevens.
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
        subject: `✅ Match Geaccepteerd - ${schoonmakerNaam} → ${klantNaam} (${plaats})`,
        html: adminEmailHtml
      }, correlationId);

      console.log(`✅ [aanvraagService.approve] Admin email sent to: ${emailConfig.notificationsEmail} [${correlationId}]`);
    } catch (emailError) {
      console.error(`⚠️ [aanvraagService.approve] Admin email failed (non-critical) [${correlationId}]`, {
        error: emailError.message
      });
    }

    console.log(`[aanvraagService.approve] SUCCESS [${correlationId}]`);

    // Return complete result
    return {
      aanvraag: {
        id: aanvraag.id,
        status: 'geaccepteerd'
      },
      abonnement: {
        id: abonnement.id,
        status: 'actief',
        schoonmaker_id: schoonmakerId
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
   * Schoonmaker keurt aanvraag af
   * 
   * Flow:
   * 1. Haal aanvraag op (check bestaat)
   * 2. Haal actieve match op (schoonmaker_id + aanvraag_id, status='open')
   * 3. Valideer: match moet status 'open' hebben
   * 4. Update match.status = 'geweigerd' + afwijzing_reden
   * 5. Haal lijst van eerder afgewezen schoonmakers op
   * 6. Zoek nieuwe schoonmaker (exclude afgewezen lijst)
   * 7a. Als gevonden: maak nieuwe match (status='open')
   * 7b. Als NIET gevonden: update aanvraag.status = 'afgewezen'
   * 8. Audit log
   * 
   * @param {Object} params
   * @param {string} params.aanvraagId - UUID van schoonmaak_aanvraag
   * @param {string} params.schoonmakerId - UUID van schoonmaker die afkeurt
   * @param {string|null} params.reden - Optionele afwijzingsreden
   * @param {string} correlationId - Voor logging
   * @returns {Promise<Object>} Result met aanvraag, rejectedMatch, newMatch (of null)
   * @throws {Error} Als aanvraag niet bestaat, match niet gevonden, of al afgewezen
   */
  async reject({ aanvraagId, schoonmakerId, reden }, correlationId) {
    console.log(`[aanvraagService.reject] START [${correlationId}]`, { 
      aanvraagId, 
      schoonmakerId,
      reden: reden || '(geen reden)'
    });

    // STAP 1: Haal aanvraag op
    const aanvraagUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen?id=eq.${aanvraagId}&select=*`;
    const aanvraagResp = await httpClient(aanvraagUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    }, correlationId);

    if (!aanvraagResp.ok) {
      throw new Error(`Failed to fetch aanvraag: ${await aanvraagResp.text()}`);
    }

    const aanvragen = await aanvraagResp.json();
    if (!aanvragen || aanvragen.length === 0) {
      const error = new Error('Aanvraag not found');
      error.statusCode = 404;
      throw error;
    }

    const aanvraag = aanvragen[0];
    console.log(`[aanvraagService.reject] Aanvraag found [${correlationId}]`, { 
      id: aanvraag.id, 
      status: aanvraag.status 
    });

    // STAP 2: Haal abonnement op (nodig voor auto-matching)
    const abonnementUrl = `${supabaseConfig.url}/rest/v1/abonnementen?schoonmaak_aanvraag_id=eq.${aanvraagId}&select=*`;
    const abonnementResp = await httpClient(abonnementUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    }, correlationId);

    if (!abonnementResp.ok) {
      throw new Error(`Failed to fetch abonnement: ${await abonnementResp.text()}`);
    }

    const abonnementen = await abonnementResp.json();
    if (!abonnementen || abonnementen.length === 0) {
      const error = new Error('Abonnement not found for this aanvraag');
      error.statusCode = 404;
      throw error;
    }

    const abonnement = abonnementen[0];
    console.log(`[aanvraagService.reject] Abonnement found [${correlationId}]`, { 
      id: abonnement.id, 
      status: abonnement.status 
    });

    // STAP 3: Haal actieve match op
    const matches = await schoonmaakMatchService.findByAanvraagId(aanvraagId, correlationId);
    
    if (!matches || matches.length === 0) {
      const error = new Error('No match found for this aanvraag');
      error.statusCode = 404;
      throw error;
    }

    // Neem de meest recente match (array is gesorteerd op aangemaakt_op DESC)
    const match = matches[0];

    // Valideer dat deze schoonmaker de juiste is
    if (match.schoonmaker_id !== schoonmakerId) {
      const error = new Error('This schoonmaker is not assigned to this aanvraag');
      error.statusCode = 403;
      throw error;
    }

    console.log(`[aanvraagService.reject] Match found [${correlationId}]`, { 
      match_id: match.id,
      status: match.status,
      schoonmaker_id: match.schoonmaker_id
    });

    // STAP 4: Valideer match status
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

    // STAP 5: Update match status naar 'geweigerd' + reden
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

    console.log(`[aanvraagService.reject] Match status updated to 'geweigerd' [${correlationId}]`);

    // STAP 6: Haal lijst van eerder afgewezen schoonmakers op
    const rejectedMatches = matches.filter(m => m.status === 'geweigerd');
    const excludeSchoonmakerIds = rejectedMatches.map(m => m.schoonmaker_id).filter(Boolean);
    
    // Voeg de HUIDIGE afgewezen schoonmaker toe (net ge-update, niet in matches array)
    if (!excludeSchoonmakerIds.includes(schoonmakerId)) {
      excludeSchoonmakerIds.push(schoonmakerId);
    }
    
    console.log(`[aanvraagService.reject] Excluding ${excludeSchoonmakerIds.length} previously rejected schoonmakers [${correlationId}]`, {
      excluded_ids: excludeSchoonmakerIds
    });

    // STAP 7: Zoek nieuwe schoonmaker (indien beschikbaar)
    console.log(`[aanvraagService.reject] Searching for new schoonmaker [${correlationId}]`);
    
    let newMatch = null;
    let newSchoonmaker = null;

    try {
      const matchResult = await schoonmakerService.findAndAssignSchoonmaker(
        aanvraagId,
        abonnement.id,
        excludeSchoonmakerIds,
        correlationId
      );

      if (matchResult) {
        newMatch = matchResult;
        newSchoonmaker = {
          id: matchResult.schoonmaker_id,
          voornaam: matchResult.schoonmaker_voornaam,
          achternaam: matchResult.schoonmaker_achternaam
        };
        console.log(`✅ [aanvraagService.reject] New match created [${correlationId}]`, {
          match_id: newMatch.id,
          schoonmaker_id: newSchoonmaker.id
        });
      } else {
        console.log(`ℹ️ [aanvraagService.reject] No available schoonmaker found [${correlationId}]`);
      }
    } catch (error) {
      console.error(`❌ [aanvraagService.reject] Auto-matching failed [${correlationId}]`, {
        error: error.message
      });
      // Continue flow - geen nieuwe match betekent admin actie nodig
    }

    // STAP 8: Als geen nieuwe schoonmaker gevonden, update aanvraag status
    if (!newMatch) {
      console.log(`[aanvraagService.reject] No new match found, updating aanvraag status [${correlationId}]`);
      
      const updateAanvraagUrl = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen?id=eq.${aanvraagId}`;
      const updateAanvraagResp = await httpClient(updateAanvraagUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          status: 'afgewezen'
        })
      }, correlationId);

      if (!updateAanvraagResp.ok) {
        throw new Error(`Failed to update aanvraag: ${await updateAanvraagResp.text()}`);
      }

      console.log(`[aanvraagService.reject] Aanvraag status updated to 'afgewezen' [${correlationId}]`);
    }

    // STAP 9: Audit log
    await auditService.log(
      'aanvraag_afgewezen',
      aanvraagId,
      'rejected',
      schoonmakerId,
      {
        aanvraag_id: aanvraagId,
        rejected_match_id: match.id,
        schoonmaker_id: schoonmakerId,
        reden: reden || null,
        new_match_found: newMatch !== null,
        excluded_schoonmakers: excludeSchoonmakerIds
      },
      correlationId
    );

    // STAP 10: 📧 EMAIL TRIGGERS
    if (newMatch) {
      // Scenario A: Nieuwe match gevonden → Email naar nieuwe schoonmaker
      console.log(`📧 [aanvraagService.reject] Sending email to new schoonmaker [${correlationId}]`);
      try {
        // Import matchToegewezenSchoonmaker template
        const { matchToegewezenSchoonmaker } = await import('../templates/emails/index.js');
        
        // Haal voorkeurs_dagdelen op
        let dagdelen = {};
        try {
          const dagdelenUrl = `${supabaseConfig.url}/rest/v1/voorkeurs_dagdelen?user_id=eq.${abonnement.user_id}&select=*`;
          const dagdelenResp = await httpClient(dagdelenUrl, {
            method: 'GET',
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${supabaseConfig.anonKey}`
            }
          }, correlationId);

          if (dagdelenResp.ok) {
            const dagdelenData = await dagdelenResp.json();
            if (dagdelenData && dagdelenData.length > 0) {
              dagdelenData.forEach(item => {
                if (!dagdelen[item.dag]) {
                  dagdelen[item.dag] = [];
                }
                dagdelen[item.dag].push(item.dagdeel);
              });
            }
          }
        } catch (err) {
          console.warn(`⚠️ [aanvraagService.reject] Could not fetch dagdelen [${correlationId}]`, err.message);
        }

        // Haal adres op
        let adresData = { straat: '', huisnummer: '', plaats: '', postcode: '' };
        if (aanvraag.adres_id) {
          try {
            const adresUrl = `${supabaseConfig.url}/rest/v1/adressen?id=eq.${aanvraag.adres_id}&select=*`;
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
                adresData = adressen[0];
              }
            }
          } catch (err) {
            console.warn(`⚠️ [aanvraagService.reject] Could not fetch address [${correlationId}]`, err.message);
          }
        }

        const emailHtml = matchToegewezenSchoonmaker({
          schoonmakerNaam: `${newSchoonmaker?.voornaam || ''} ${newSchoonmaker?.achternaam || ''}`.trim() || 'Beste schoonmaker',
          klantNaam: `${aanvraag.voornaam || ''} ${aanvraag.achternaam || ''}`.trim() || 'de klant',
          adres: `${adresData.straat} ${adresData.huisnummer}${adresData.toevoeging || ''}`,
          plaats: adresData.plaats || aanvraag.plaats || 'onbekend',
          postcode: adresData.postcode || 'onbekend',
          uren: aanvraag.uren || 4,
          dagdelen: Object.keys(dagdelen).length > 0 ? dagdelen : {},
          startdatum: aanvraag.startdatum || abonnement.startdatum,
          autoAssigned: true, // Dit is een auto-assigned match na reject
          aanvraagId: aanvraag.id,
          matchId: newMatch.id
        });

        // Haal nieuwe schoonmaker email op
        const newSchoonmakerUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${newMatch.schoonmaker_id}&select=email`;
        const newSchoonmakerResp = await httpClient(newSchoonmakerUrl, {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.anonKey}`
          }
        }, correlationId);

        if (newSchoonmakerResp.ok) {
          const schoonmakers = await newSchoonmakerResp.json();
          if (schoonmakers && schoonmakers.length > 0 && schoonmakers[0].email) {
            await sendEmail({
              to: schoonmakers[0].email,
              subject: `🎉 Nieuwe Aanvraag Voor U - ${aanvraag.voornaam || 'Klant'} ${aanvraag.achternaam || ''}`,
              html: emailHtml
            }, correlationId);

            console.log(`✅ [aanvraagService.reject] Email sent to new schoonmaker: ${schoonmakers[0].email} [${correlationId}]`);
          }
        }

        // B1: Admin notificatie - Nieuwe match wacht op goedkeuring
        try {
          console.log(`📧 [aanvraagService.reject] Sending admin notification for new match [${correlationId}]`);
          
          // Haal afgewezen schoonmaker naam op
          let afgewezenSchoonmakerNaam = 'Onbekende schoonmaker';
          try {
            const afgewezenUrl = `${supabaseConfig.url}/rest/v1/user_profiles?id=eq.${schoonmakerId}&select=voornaam,achternaam`;
            const afgewezenResp = await httpClient(afgewezenUrl, {
              method: 'GET',
              headers: {
                'apikey': supabaseConfig.anonKey,
                'Authorization': `Bearer ${supabaseConfig.anonKey}`
              }
            }, correlationId);

            if (afgewezenResp.ok) {
              const afgewezen = await afgewezenResp.json();
              if (afgewezen && afgewezen.length > 0) {
                afgewezenSchoonmakerNaam = `${afgewezen[0].voornaam || ''} ${afgewezen[0].achternaam || ''}`.trim() || 'Onbekende schoonmaker';
              }
            }
          } catch (err) {
            console.warn(`⚠️ [aanvraagService.reject] Could not fetch rejected schoonmaker name [${correlationId}]`);
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
                          <h1 style="color: white; margin: 0; font-size: 24px;">🔄 Nieuwe Match Toegewezen</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 30px;">
                          <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">
                            Een schoonmaker heeft afgewezen. Er is automatisch een nieuwe match toegewezen.
                          </p>
                          
                          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                            <p style="margin: 0; font-size: 14px; color: #856404;">
                              <strong>⏳ Nieuwe match wacht op goedkeuring</strong>
                            </p>
                          </div>

                          <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px;">
                            <p style="margin: 0; font-size: 14px; color: #666;">
                              <strong style="color: #333;">Afgewezen door:</strong> ${afgewezenSchoonmakerNaam}<br>
                              <strong style="color: #333;">Nieuwe schoonmaker:</strong> ${`${newSchoonmaker?.voornaam || ''} ${newSchoonmaker?.achternaam || ''}`.trim()}<br>
                              <strong style="color: #333;">Klant:</strong> ${`${aanvraag.voornaam || ''} ${aanvraag.achternaam || ''}`.trim()}<br>
                              <strong style="color: #333;">Plaats:</strong> ${adresData.plaats || aanvraag.plaats || 'onbekend'}<br>
                              <strong style="color: #333;">Startdatum:</strong> ${aanvraag.startdatum || abonnement.startdatum}<br>
                              <strong style="color: #333;">Uren:</strong> ${aanvraag.uren || 4} uur per week<br>
                              <strong style="color: #333;">Nieuwe Match ID:</strong> ${newMatch.id}<br>
                              <strong style="color: #333;">Aanvraag ID:</strong> ${aanvraag.id}
                            </p>
                          </div>

                          <p style="font-size: 14px; color: #666; margin: 20px 0 0 0;">
                            De nieuwe schoonmaker heeft een notificatie ontvangen en kan nu accepteren of afwijzen.
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
            subject: `🔄 Nieuwe Match Toegewezen - ${`${newSchoonmaker?.voornaam || ''} ${newSchoonmaker?.achternaam || ''}`.trim()} → ${`${aanvraag.voornaam || ''} ${aanvraag.achternaam || ''}`.trim()} (${adresData.plaats || aanvraag.plaats})`,
            html: adminEmailHtml
          }, correlationId);

          console.log(`✅ [aanvraagService.reject] Admin notification sent to: ${emailConfig.notificationsEmail} [${correlationId}]`);
        } catch (emailError) {
          console.error(`⚠️ [aanvraagService.reject] Admin notification failed (non-critical) [${correlationId}]`, {
            error: emailError.message
          });
        }
      } catch (emailError) {
        console.error(`⚠️ [aanvraagService.reject] New schoonmaker email failed (non-critical) [${correlationId}]`, {
          error: emailError.message
        });
      }
    } else {
      // Scenario B: Geen match gevonden → Email naar admin + klant
      console.log(`📧 [aanvraagService.reject] No match found, sending emails to admin + klant [${correlationId}]`);
      
      // Haal voorkeurs_dagdelen op
      let dagdelen = {};
      try {
        const dagdelenUrl = `${supabaseConfig.url}/rest/v1/voorkeurs_dagdelen?user_id=eq.${abonnement.user_id}&select=*`;
        const dagdelenResp = await httpClient(dagdelenUrl, {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.anonKey}`
          }
        }, correlationId);

        if (dagdelenResp.ok) {
          const dagdelenData = await dagdelenResp.json();
          if (dagdelenData && dagdelenData.length > 0) {
            dagdelenData.forEach(item => {
              if (!dagdelen[item.dag]) {
                dagdelen[item.dag] = [];
              }
              dagdelen[item.dag].push(item.dagdeel);
            });
          }
        }
      } catch (err) {
        console.warn(`⚠️ [aanvraagService.reject] Could not fetch dagdelen [${correlationId}]`, err.message);
      }

      // B1: Email naar admin (urgentie - actie vereist) - geen match gevonden
      try {
        // Haal betaling op voor bedrag
        let bedrag = 0;
        try {
          const betalingUrl = `${supabaseConfig.url}/rest/v1/betalingen?abonnement_id=eq.${abonnement.id}&select=bedrag_cents&order=aangemaakt_op.desc&limit=1`;
          const betalingResp = await httpClient(betalingUrl, {
            method: 'GET',
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${supabaseConfig.anonKey}`
            }
          }, correlationId);

          if (betalingResp.ok) {
            const betalingen = await betalingResp.json();
            if (betalingen && betalingen.length > 0) {
              bedrag = (betalingen[0].bedrag_cents || 0) / 100; // Cents naar euros
            }
          }
        } catch (err) {
          console.warn(`⚠️ [aanvraagService.reject] Could not fetch payment amount [${correlationId}]`, err.message);
        }

        const adminEmailHtml = matchAfgewezenAdmin({
          klantNaam: `${aanvraag.voornaam || ''} ${aanvraag.achternaam || ''}`.trim() || 'Onbekende klant',
          klantEmail: aanvraag.email || 'geen email',
          plaats: aanvraag.plaats || 'onbekend',
          uren: aanvraag.uren || 4,
          dagdelen: Object.keys(dagdelen).length > 0 ? dagdelen : {},
          startdatum: aanvraag.startdatum || abonnement.startdatum,
          aantalPogingen: excludeSchoonmakerIds.length,
          bedrag: bedrag,
          aanvraagId: aanvraag.id
        });

        await sendEmail({
          to: emailConfig.notificationsEmail,
          subject: `⚠️ Geen Match Gevonden - Actie Vereist - ${aanvraag.voornaam || 'Klant'} (${aanvraag.plaats || 'onbekend'})`,
          html: adminEmailHtml
        }, correlationId);

        console.log(`✅ [aanvraagService.reject] Admin email sent to: ${emailConfig.notificationsEmail} [${correlationId}]`);
      } catch (emailError) {
        console.error(`⚠️ [aanvraagService.reject] Admin email failed (non-critical) [${correlationId}]`, {
          error: emailError.message
        });
      }

      // B2: Email naar klant (sorry, geen schoonmaker beschikbaar)
      try {
        const klantEmailHtml = geenSchoonmakerBeschikbaarKlant({
          klantNaam: `${aanvraag.voornaam || ''} ${aanvraag.achternaam || ''}`.trim() || 'Beste klant',
          plaats: aanvraag.plaats || 'jouw regio',
          startdatum: aanvraag.startdatum || abonnement.startdatum,
          uren: aanvraag.uren || 4,
          dagdelen: Object.keys(dagdelen).length > 0 ? dagdelen : {},
          aanvraagId: aanvraag.id
        });

        await sendEmail({
          to: aanvraag.email,
          subject: 'We Zoeken Een Geschikte Schoonmaker - Heppy',
          html: klantEmailHtml
        }, correlationId);

        console.log(`✅ [aanvraagService.reject] Klant email sent to: ${aanvraag.email} [${correlationId}]`);
      } catch (emailError) {
        console.error(`⚠️ [aanvraagService.reject] Klant email failed (non-critical) [${correlationId}]`, {
          error: emailError.message
        });
      }
    }

    console.log(`[aanvraagService.reject] SUCCESS [${correlationId}]`);

    // Return complete result
    return {
      aanvraag: {
        id: aanvraag.id,
        status: newMatch ? 'betaald' : 'afgewezen'
      },
      rejectedMatch: {
        id: match.id,
        status: 'geweigerd',
        reden: reden || null
      },
      newMatch: newMatch ? {
        id: newMatch.id,
        schoonmaker_id: newMatch.schoonmaker_id,
        status: 'open',
        schoonmaker_naam: newSchoonmaker?.voornaam || null
      } : null
    };
  }
};
