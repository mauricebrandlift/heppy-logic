// api/routes/stripe/get-invoice-url.js
/**
 * Haal Stripe Invoice hosted URL op
 * 
 * GET/POST /api/routes/stripe/get-invoice-url
 * 
 * Body/Query:
 * - invoiceId: Stripe Invoice ID (in_xxx)
 * 
 * Returns:
 * - hostedInvoiceUrl: URL naar Stripe hosted invoice page
 * - invoicePdf: Direct PDF download URL
 */

import { stripeConfig } from '../../config/index.js';
import { handleErrorResponse } from '../../utils/errorHandler.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const correlationId = req.headers['x-correlation-id'] || `inv-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ correlationId, message: 'Method not allowed' });
  }

  try {
    // Haal invoice ID op uit body of query params
    const invoiceId = req.method === 'POST' 
      ? req.body?.invoiceId 
      : req.query?.invoiceId;

    if (!invoiceId) {
      return res.status(400).json({
        correlationId,
        message: 'Invoice ID is required'
      });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'stripe/get-invoice-url',
      action: 'fetch_invoice',
      invoiceId
    }));

    // Haal invoice op van Stripe
    const response = await fetch(
      `https://api.stripe.com/v1/invoices/${encodeURIComponent(invoiceId)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stripeConfig.secretKey}`
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        route: 'stripe/get-invoice-url',
        action: 'stripe_fetch_failed',
        invoiceId,
        status: response.status,
        error: errorData?.error?.message
      }));

      return res.status(response.status).json({
        correlationId,
        message: `Stripe error: ${errorData?.error?.message || 'Unknown error'}`
      });
    }

    const invoice = await response.json();

    // Valideer dat invoice een hosted URL heeft
    if (!invoice.hosted_invoice_url) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'stripe/get-invoice-url',
        action: 'no_hosted_url',
        invoiceId,
        status: invoice.status
      }));

      return res.status(404).json({
        correlationId,
        message: 'Invoice heeft geen hosted URL (mogelijk nog niet gefinaliseerd)'
      });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'stripe/get-invoice-url',
      action: 'invoice_fetched',
      invoiceId,
      status: invoice.status,
      hasHostedUrl: !!invoice.hosted_invoice_url,
      hasPdfUrl: !!invoice.invoice_pdf
    }));

    // Return URLs
    return res.status(200).json({
      correlationId,
      invoiceId: invoice.id,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      status: invoice.status,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency
    });

  } catch (error) {
    return handleErrorResponse(error, res, correlationId);
  }
}
