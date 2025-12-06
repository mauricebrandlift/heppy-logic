// Flow: processWebshopInvoice
// Verwerkt webshop bestellingen na invoice.paid webhook
// Maakt bestelling aan in database na succesvolle betaling

import { supabaseConfig } from '../../config/index.js';
import { httpClient } from '../../utils/apiClient.js';
import { sendEmail } from '../../services/emailService.js';
import { emailConfig } from '../../config/index.js';

export async function processWebshopInvoice({ invoice, metadata, correlationId, event }) {
  console.log(`🛒 [ProcessWebshopInvoice] ========== START ========== [${correlationId}]`);
  console.log(`🛒 [ProcessWebshopInvoice] Invoice ID: ${invoice.id}`);
  console.log(`🛒 [ProcessWebshopInvoice] Amount: ${invoice.amount_paid} (${invoice.currency})`);
  console.log(`🛒 [ProcessWebshopInvoice] Metadata:`, JSON.stringify(metadata, null, 2));

  try {
    // Parse metadata
    const bestellingId = metadata.entity_id;
    const klantEmail = metadata.customer_email;

    if (!bestellingId) {
      throw new Error('Missing metadata.entity_id (bestelling_id)');
    }

    // Check of bestelling al bestaat en betaald is (idempotency)
    console.log(`🔍 [ProcessWebshopInvoice] Checking bestelling ${bestellingId}... [${correlationId}]`);
    
    const checkUrl = `${supabaseConfig.url}/rest/v1/bestellingen?id=eq.${bestellingId}&select=id,betaal_status,stripe_invoice_id`;
    
    const checkResponse = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!checkResponse.ok) {
      throw new Error(`Bestelling ophalen mislukt: ${checkResponse.status}`);
    }

    const bestellingen = await checkResponse.json();
    const bestelling = bestellingen[0];

    if (!bestelling) {
      throw new Error(`Bestelling ${bestellingId} niet gevonden in database`);
    }

    if (bestelling.betaal_status === 'paid' && bestelling.stripe_invoice_id) {
      console.log(`⚠️ [ProcessWebshopInvoice] Bestelling al betaald, skipping (idempotency) [${correlationId}]`);
      return {
        handled: true,
        duplicate: true,
        bestellingId: bestelling.id,
      };
    }

    // Update bestelling: betaal_status = paid, stripe_invoice_id
    console.log(`💳 [ProcessWebshopInvoice] Updating bestelling to paid... [${correlationId}]`);
    
    const updateUrl = `${supabaseConfig.url}/rest/v1/bestellingen?id=eq.${bestellingId}`;
    
    const updateData = {
      betaal_status: 'paid',
      betaald_op: new Date().toISOString(),
      stripe_invoice_id: invoice.id,
    };

    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.error(`❌ [ProcessWebshopInvoice] Update failed [${correlationId}]`, errorData);
      throw new Error(`Bestelling update mislukt: ${updateResponse.status}`);
    }

    console.log(`✅ [ProcessWebshopInvoice] Bestelling ${bestellingId} marked as paid [${correlationId}]`);

    // Verstuur bevestigingsmail naar klant
    if (klantEmail) {
      console.log(`📧 [ProcessWebshopInvoice] Sending confirmation email to ${klantEmail}... [${correlationId}]`);
      
      try {
        await sendEmail({
          to: klantEmail,
          subject: '✅ Bestelling Ontvangen - Heppy',
          html: `
            <h2>Bedankt voor je bestelling!</h2>
            <p>Je betaling is succesvol ontvangen.</p>
            <p><strong>Bestelnummer:</strong> ${bestelling.bestel_nummer || bestellingId}</p>
            <p><strong>Bedrag:</strong> €${(invoice.amount_paid / 100).toFixed(2)}</p>
            ${invoice.invoice_pdf ? `<p><a href="${invoice.invoice_pdf}">Download factuur (PDF)</a></p>` : ''}
            <p>Je bestelling wordt zo snel mogelijk verwerkt en verzonden.</p>
            <p>Met vriendelijke groet,<br>Team Heppy</p>
          `,
        }, correlationId);
        
        console.log(`✅ [ProcessWebshopInvoice] Confirmation email sent [${correlationId}]`);
      } catch (emailError) {
        console.error(`⚠️ [ProcessWebshopInvoice] Email failed (non-critical) [${correlationId}]`, emailError.message);
      }
    }

    console.log(`🎉 [ProcessWebshopInvoice] ========== SUCCESS ========== [${correlationId}]`);

    return {
      handled: true,
      bestellingId: bestelling.id,
      invoiceId: invoice.id,
    };

  } catch (error) {
    console.error(`❌ [ProcessWebshopInvoice] FAILED [${correlationId}]`, {
      error: error.message,
      stack: error.stack,
      invoiceId: invoice.id,
    });

    // Verstuur error email naar admin
    try {
      await sendEmail({
        to: emailConfig.notificationsEmail,
        subject: '⚠️ Webshop Invoice Processing Failed',
        html: `
          <h2>Invoice Processing Error</h2>
          <p><strong>Invoice ID:</strong> ${invoice.id}</p>
          <p><strong>Error:</strong> ${error.message}</p>
          <p><strong>Correlation ID:</strong> ${correlationId}</p>
          <p>Actie vereist: Check logs en verwerk handmatig.</p>
        `,
      }, correlationId);
    } catch (emailError) {
      console.error(`❌ [ProcessWebshopInvoice] Admin email failed [${correlationId}]`, emailError.message);
    }

    throw error;
  }
}
