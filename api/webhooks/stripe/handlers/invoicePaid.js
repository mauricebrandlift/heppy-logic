// Handler: invoice.paid
// Routes invoice payments to appropriate flow based on metadata.flow
// Supports: webshop, abonnement, eenmalige_opdracht (dieptereiniging, verhuis, etc.)

import { processWebshopInvoice } from '../../../flows/payment/processWebshopInvoice.js';

export async function handleInvoicePaid(event, correlationId) {
  const invoice = event.data.object;
  const metadata = invoice.metadata || {};
  
  console.log(`💳 [InvoicePaid] ========== START ========== [${correlationId}]`);
  console.log(`💳 [InvoicePaid] Invoice ID: ${invoice.id}`);
  console.log(`💳 [InvoicePaid] Amount: ${invoice.amount_paid} ${invoice.currency}`);
  console.log(`💳 [InvoicePaid] Metadata:`, JSON.stringify(metadata, null, 2));
  
  // Detect flow type from metadata
  const flow = metadata.flow;
  
  if (!flow) {
    console.error(`❌ [InvoicePaid] Missing metadata.flow - cannot route payment [${correlationId}]`);
    return { 
      handled: false, 
      error: 'missing_flow_metadata',
      message: 'Invoice metadata moet flow veld bevatten (webshop/abonnement/eenmalige_opdracht)'
    };
  }

  console.log(`📦 [InvoicePaid] Detected flow: ${flow} [${correlationId}]`);

  // Route naar juiste flow handler
  try {
    switch (flow) {
      case 'webshop':
        console.log(`🛒 [InvoicePaid] Routing to webshop flow [${correlationId}]`);
        return await processWebshopInvoice({ invoice, metadata, correlationId, event });

      case 'abonnement':
        console.log(`📅 [InvoicePaid] Routing to abonnement flow [${correlationId}]`);
        // TODO: Implementeer processAbonnementInvoice voor eerste betaling
        // Voor nu: throw error om te voorkomen dat het stilletjes faalt
        throw new Error('Abonnement invoice flow nog niet geïmplementeerd');

      case 'eenmalige_opdracht':
        console.log(`🧹 [InvoicePaid] Routing to eenmalige opdracht flow [${correlationId}]`);
        // TODO: Implementeer processEenmaligeOpdrachtInvoice
        // Voor nu: throw error om te voorkomen dat het stilletjes faalt
        throw new Error('Eenmalige opdracht invoice flow nog niet geïmplementeerd');

      default:
        console.error(`❌ [InvoicePaid] Unknown flow type: ${flow} [${correlationId}]`);
        return {
          handled: false,
          error: 'unknown_flow_type',
          flow,
          message: `Flow type '${flow}' wordt niet ondersteund`
        };
    }
  } catch (error) {
    console.error(`❌ [InvoicePaid] Flow handler failed [${correlationId}]`, {
      error: error.message,
      stack: error.stack,
      flow,
      invoiceId: invoice.id
    });

    return {
      handled: false,
      error: 'flow_handler_failed',
      flow,
      message: error.message
    };
  }
}
