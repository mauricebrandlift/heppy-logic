// api/webhooks/stripe.js
// Stripe webhook endpoint: verifieert signatures (zonder externe dep) en handelt events af

import crypto from 'crypto';
import { stripeConfig } from '../config/index.js';

// Lees raw body als Buffer (nodig voor signature verificatie)
async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseStripeSignatureHeader(sigHeader) {
  // Voorbeeld: t=1492774577,v1=5257a869e7...,v0=...
  const parts = (sigHeader || '').split(',').map(p => p.trim());
  const sig = { t: null, v1: [] };
  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === 't') sig.t = v;
    if (k === 'v1') sig.v1.push(v);
  }
  return sig;
}

function timingSafeEqualHex(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyStripeSignature(rawBody, sigHeader, secret) {
  const parsed = parseStripeSignatureHeader(sigHeader);
  if (!parsed.t || !parsed.v1.length) return false;
  const signedPayload = `${parsed.t}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return parsed.v1.some(sig => timingSafeEqualHex(expected, sig));
}

export default async function handler(req, res) {
  // Stripe webhooks zijn server-to-server; CORS is niet vereist
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const correlationId = req.headers['x-correlation-id'] || `wh_${Date.now()}`;
  const { webhookSecret } = stripeConfig || {};

  if (!webhookSecret) {
    console.error(`[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET; cannot verify signatures`);
    return res.status(500).json({ correlationId, message: 'Webhook not configured' });
  }
  // Geen externe Stripe SDK nodig; we verifieren zelf met HMAC

  let event;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ correlationId, message: 'Missing Stripe-Signature header' });
    }

    const ok = verifyStripeSignature(rawBody, signature, webhookSecret);
    if (!ok) {
      return res.status(400).json({ correlationId, message: 'Invalid signature' });
    }

    // Signature geldig: parse event body
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    console.error(`[stripe-webhook] Signature verification failed: ${err.message}`);
    return res.status(400).json({ correlationId, message: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        console.log(JSON.stringify({
          correlationId,
          level: 'INFO',
          message: 'PaymentIntent succeeded',
          id: pi.id,
          amount: pi.amount,
          currency: pi.currency,
          metadata: pi.metadata || {},
        }));
        // TODO: Trigger post-payment flow (DB updates, mail, etc.)
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        console.warn(JSON.stringify({
          correlationId,
          level: 'WARN',
          message: 'PaymentIntent failed',
          id: pi.id,
          last_payment_error: pi.last_payment_error?.message,
          metadata: pi.metadata || {},
        }));
        break;
      }
      default: {
        console.log(JSON.stringify({ correlationId, level: 'DEBUG', message: `Unhandled event`, type: event.type }));
      }
    }

    // Stuur 200 terug zodat Stripe weet dat het event is verwerkt
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(`[stripe-webhook] Handler error: ${err.message}`);
    return res.status(500).json({ correlationId, message: 'Internal webhook processing error' });
  }
}
