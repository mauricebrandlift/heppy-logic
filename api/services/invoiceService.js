/**
 * Invoice Service
 * 
 * Herbruikbare service voor het aanmaken van Stripe Invoices.
 * BELANGRIJK: Deze invoices worden NIET gebruikt voor betaling, maar voor factuurbeheer.
 * 
 * Flow:
 * 1. Klant betaalt via Payment Intent (Stripe Elements)
 * 2. Na succesvolle betaling: maak "paid" invoice aan
 * 3. Invoice dient als factuur PDF voor klant
 * 
 * Voordelen:
 * - Automatische PDF generatie door Stripe
 * - Consistente factuur ervaring
 * - Custom teksten per flow (webshop, abonnement, eenmalige opdracht)
 */

import { stripeConfig } from '../config/index.js';

/**
 * Maak een "paid" Stripe Invoice (NA succesvolle betaling)
 * 
 * @param {Object} params
 * @param {string} params.customerId - Stripe Customer ID (vereist)
 * @param {string} params.paymentIntentId - Payment Intent ID waarmee al betaald is
 * @param {Array} params.lineItems - Line items voor de invoice
 * @param {string} params.lineItems[].description - Omschrijving (bijv. "Heppy Stofzuiger Premium XL")
 * @param {number} params.lineItems[].quantity - Aantal
 * @param {number} params.lineItems[].unit_amount - Prijs per stuk in cents (incl. BTW)
 * @param {Object} params.metadata - Metadata voor tracking
 * @param {string} [params.description] - Optionele invoice omschrijving
 * @param {Object} [params.customText] - Custom teksten voor header/footer/notes
 * @param {string} [params.customText.header] - Header tekst (max 500 chars)
 * @param {string} [params.customText.footer] - Footer tekst (max 500 chars)
 * @param {string} [params.customText.notes] - Notes tekst (max 500 chars)
 * @param {string} correlationId - Correlation ID voor logging
 * @returns {Promise<Object>} Invoice object met invoice_pdf URL
 * 
 * @example
 * const invoice = await createPaidInvoice({
 *   customerId: 'cus_xxx',
 *   paymentIntentId: 'pi_xxx',
 *   lineItems: [
 *     { description: 'Stofzuiger XL', quantity: 2, unit_amount: 4995 }
 *   ],
 *   metadata: { order_id: 'uuid', flow: 'webshop' },
 *   customText: {
 *     footer: 'Betaling reeds ontvangen via iDEAL'
 *   }
 * }, correlationId);
 */
export async function createPaidInvoice({
  customerId,
  paymentIntentId,
  lineItems,
  metadata = {},
  description = null,
  customText = {},
}, correlationId) {
  console.log(`📄 [InvoiceService] Creating PAID invoice for customer ${customerId} [${correlationId}]`);
  console.log(`📄 [InvoiceService] Payment Intent: ${paymentIntentId} [${correlationId}]`);

  // Validatie
  if (!customerId) {
    throw new Error('customerId is verplicht voor invoice aanmaken');
  }

  if (!paymentIntentId) {
    throw new Error('paymentIntentId is verplicht (betaling moet al afgerond zijn)');
  }

  if (!lineItems || lineItems.length === 0) {
    throw new Error('Minimaal 1 line item is vereist');
  }

  try {
    // Stap 1: Maak Invoice aan (draft)
    console.log(`📝 [InvoiceService] Creating draft invoice... [${correlationId}]`);
    
    const createParams = new URLSearchParams();
    createParams.set('customer', customerId);
    createParams.set('collection_method', 'charge_automatically');
    createParams.set('auto_advance', 'false'); // We finaliseren handmatig
    
    if (description) {
      createParams.set('description', description);
    }

    // Custom teksten toevoegen
    if (customText.header) {
      createParams.set('custom_fields[0][name]', 'Informatie');
      createParams.set('custom_fields[0][value]', customText.header.substring(0, 500));
    }
    
    if (customText.footer) {
      createParams.set('footer', customText.footer.substring(0, 500));
    }

    // Metadata toevoegen
    for (const [key, value] of Object.entries(metadata)) {
      createParams.set(`metadata[${key}]`, String(value));
    }

    const createResponse = await fetch('https://api.stripe.com/v1/invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeConfig.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: createParams.toString(),
    });

    const invoice = await createResponse.json();

    if (!createResponse.ok) {
      console.error(`❌ [InvoiceService] Invoice creation failed [${correlationId}]`, invoice);
      const err = new Error(invoice?.error?.message || 'Stripe Invoice aanmaken mislukt');
      err.code = 'INVOICE_CREATE_FAILED';
      throw err;
    }

    console.log(`✅ [InvoiceService] Draft invoice created: ${invoice.id} [${correlationId}]`);

    // Stap 2: Voeg line items toe
    console.log(`📦 [InvoiceService] Adding ${lineItems.length} line items... [${correlationId}]`);
    
    for (const item of lineItems) {
      const itemParams = new URLSearchParams();
      itemParams.set('customer', customerId);
      itemParams.set('invoice', invoice.id);
      itemParams.set('description', item.description);
      itemParams.set('quantity', String(item.quantity));
      itemParams.set('unit_amount', String(item.unit_amount));
      itemParams.set('currency', 'eur');

      const itemResponse = await fetch('https://api.stripe.com/v1/invoiceitems', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeConfig.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: itemParams.toString(),
      });

      if (!itemResponse.ok) {
        const itemError = await itemResponse.json();
        console.error(`❌ [InvoiceService] Line item failed: ${item.description} [${correlationId}]`, itemError);
        throw new Error(`Line item toevoegen mislukt: ${itemError?.error?.message}`);
      }

      console.log(`✅ [InvoiceService] Line item added: ${item.description} [${correlationId}]`);
    }

    // Stap 3: Finaliseer invoice
    console.log(`🔒 [InvoiceService] Finalizing invoice... [${correlationId}]`);
    
    const finalizeResponse = await fetch(`https://api.stripe.com/v1/invoices/${invoice.id}/finalize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeConfig.secretKey}`,
      },
    });

    const finalizedInvoice = await finalizeResponse.json();

    if (!finalizeResponse.ok) {
      console.error(`❌ [InvoiceService] Finalize failed [${correlationId}]`, finalizedInvoice);
      throw new Error(`Invoice finaliseren mislukt: ${finalizedInvoice?.error?.message}`);
    }

    // Stap 4: Markeer invoice als PAID (betaling is al gedaan via Payment Intent)
    console.log(`💳 [InvoiceService] Marking invoice as paid (external payment) [${correlationId}]`);
    
    const payParams = new URLSearchParams();
    payParams.set('paid_out_of_band', 'true'); // Betaling buiten Stripe invoice om (via Payment Intent)

    const payResponse = await fetch(`https://api.stripe.com/v1/invoices/${finalizedInvoice.id}/pay`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeConfig.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payParams.toString(),
    });

    const paidInvoice = await payResponse.json();

    if (!payResponse.ok) {
      console.error(`❌ [InvoiceService] Mark as paid failed [${correlationId}]`, paidInvoice);
      throw new Error(`Invoice als betaald markeren mislukt: ${paidInvoice?.error?.message}`);
    }

    console.log(`✅ [InvoiceService] Invoice marked as PAID: ${paidInvoice.id} [${correlationId}]`);
    console.log(`📄 [InvoiceService] PDF URL: ${paidInvoice.invoice_pdf} [${correlationId}]`);

    // Return invoice met belangrijke URLs
    return {
      id: paidInvoice.id,
      number: paidInvoice.number, // Invoice nummer van Stripe
      invoice_pdf: paidInvoice.invoice_pdf, // PDF download
      hosted_invoice_url: paidInvoice.hosted_invoice_url, // View page
      status: paidInvoice.status, // Zou 'paid' moeten zijn
      amount_paid: paidInvoice.amount_paid,
      metadata: paidInvoice.metadata,
    };

  } catch (error) {
    console.error(`❌ [InvoiceService] Fatal error [${correlationId}]`, {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Haal een Stripe Invoice op
 * 
 * @param {string} invoiceId - Stripe Invoice ID
 * @param {string} correlationId
 * @returns {Promise<Object>} Invoice object
 */
export async function getInvoice(invoiceId, correlationId) {
  console.log(`🔍 [InvoiceService] Retrieving invoice ${invoiceId} [${correlationId}]`);

  const response = await fetch(`https://api.stripe.com/v1/invoices/${invoiceId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${stripeConfig.secretKey}`,
    },
  });

  const invoice = await response.json();

  if (!response.ok) {
    console.error(`❌ [InvoiceService] Retrieve failed [${correlationId}]`, invoice);
    throw new Error(invoice?.error?.message || 'Invoice ophalen mislukt');
  }

  return invoice;
}

/**
 * Void (annuleer) een Stripe Invoice
 * Gebruik dit om een invoice te annuleren voordat deze betaald is
 * 
 * @param {string} invoiceId - Stripe Invoice ID
 * @param {string} correlationId
 * @returns {Promise<Object>} Gevoide invoice
 */
export async function voidInvoice(invoiceId, correlationId) {
  console.log(`🚫 [InvoiceService] Voiding invoice ${invoiceId} [${correlationId}]`);

  const response = await fetch(`https://api.stripe.com/v1/invoices/${invoiceId}/void`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeConfig.secretKey}`,
    },
  });

  const invoice = await response.json();

  if (!response.ok) {
    console.error(`❌ [InvoiceService] Void failed [${correlationId}]`, invoice);
    throw new Error(invoice?.error?.message || 'Invoice annuleren mislukt');
  }

  console.log(`✅ [InvoiceService] Invoice voided: ${invoice.id} [${correlationId}]`);
  return invoice;
}
