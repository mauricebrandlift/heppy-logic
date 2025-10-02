// Entry point: Stripe webhook – raw body + signature verify + dispatch
// Implementation to be filled. Keeps transport concerns only.

export async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

import { verifySignature } from './signature.js';
import { dispatchStripeEvent } from './dispatcher.js';
import { stripeConfig } from '../../config/index.js';

export default async function handler(req, res){
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST'){ res.setHeader('Allow','POST, OPTIONS'); return res.status(405).json({ message:'Method not allowed' }); }
  const correlationId = req.headers['x-correlation-id'] || `wh_${Date.now()}`;
  try {
    const sig = req.headers['stripe-signature'];
    if (!sig) return res.status(400).json({ correlationId, message:'Missing Stripe-Signature' });
    if (!stripeConfig.webhookSecret) return res.status(500).json({ correlationId, message:'Webhook not configured' });
    const raw = await readRawBody(req);
    const ok = verifySignature(raw, sig, stripeConfig.webhookSecret);
    if (!ok) return res.status(400).json({ correlationId, message:'Invalid signature' });
    let event; try { event = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ correlationId, message:'Invalid JSON' }); }
    const result = await dispatchStripeEvent({ event, correlationId });
    return res.status(200).json({ received:true, ...result });
  } catch (e){
    console.error(JSON.stringify({ level:'ERROR', correlationId, msg:'stripe_webhook_error', error:e.message }));
    return res.status(500).json({ correlationId, message:'Internal webhook error' });
  }
}
