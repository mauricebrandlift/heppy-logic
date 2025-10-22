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
  if (req.method === 'OPTIONS') {
    console.log('🔄 [Stripe Webhook] OPTIONS preflight');
    return res.status(200).end();
  }
  if (req.method !== 'POST'){ 
    console.warn(`⚠️ [Stripe Webhook] Method ${req.method} not allowed`);
    res.setHeader('Allow','POST, OPTIONS'); 
    return res.status(405).json({ message:'Method not allowed' }); 
  }
  const correlationId = req.headers['x-correlation-id'] || `wh_${Date.now()}`;
  
  console.log(`🎣 [Stripe Webhook] ========== WEBHOOK ONTVANGEN ========== [${correlationId}]`);
  
  try {
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      console.error(`❌ [Stripe Webhook] Missing Stripe-Signature header [${correlationId}]`);
      return res.status(400).json({ correlationId, message:'Missing Stripe-Signature' });
    }
    
    if (!stripeConfig.webhookSecret) {
      console.error(`❌ [Stripe Webhook] Webhook secret not configured [${correlationId}]`);
      return res.status(500).json({ correlationId, message:'Webhook not configured' });
    }
    
    console.log(`🔐 [Stripe Webhook] Verifying signature... [${correlationId}]`);
    const raw = await readRawBody(req);
    const ok = verifySignature(raw, sig, stripeConfig.webhookSecret);
    
    if (!ok) {
      console.error(`❌ [Stripe Webhook] Invalid signature [${correlationId}]`);
      return res.status(400).json({ correlationId, message:'Invalid signature' });
    }
    
    console.log(`✅ [Stripe Webhook] Signature verified [${correlationId}]`);
    
    let event; 
    try { 
      event = JSON.parse(raw.toString('utf8')); 
    } catch { 
      console.error(`❌ [Stripe Webhook] Invalid JSON payload [${correlationId}]`);
      return res.status(400).json({ correlationId, message:'Invalid JSON' }); 
    }
    
    console.log(`📦 [Stripe Webhook] Event type: ${event.type} [${correlationId}]`);
    console.log(`📦 [Stripe Webhook] Event ID: ${event.id} [${correlationId}]`);
    
    let result;
    try {
      result = await dispatchStripeEvent({ event, correlationId });
      console.log(`✅ [Stripe Webhook] Event processed successfully [${correlationId}]`, result);
      return res.status(200).json({ received:true, ...result });
    } catch (dispatchError) {
      // Dispatch error - deze zou in Vercel logs moeten verschijnen
      console.error(`🔥 [Stripe Webhook] ========== DISPATCH FAILURE ========== [${correlationId}]`);
      console.error(`🔥 [Stripe Webhook] Event type: ${event.type}`);
      console.error(`🔥 [Stripe Webhook] Event ID: ${event.id}`);
      console.error(`🔥 [Stripe Webhook] Error message: ${dispatchError.message}`);
      console.error(`🔥 [Stripe Webhook] Stack trace:`, dispatchError.stack);
      console.error(`🔥 [Stripe Webhook] Full event data:`, JSON.stringify(event, null, 2));
      
      // Return 500 zodat Stripe het opnieuw probeert
      return res.status(500).json({ 
        correlationId, 
        message: 'Event processing failed',
        error: dispatchError.message,
        eventType: event.type,
        eventId: event.id
      });
    }
  } catch (e){
    // Top-level error (signature, parsing, etc)
    console.error(`🔥 [Stripe Webhook] ========== CRITICAL ERROR ========== [${correlationId}]`);
    console.error(`🔥 [Stripe Webhook] Error message: ${e.message}`);
    console.error(`🔥 [Stripe Webhook] Stack trace:`, e.stack);
    console.error(JSON.stringify({ level:'ERROR', correlationId, msg:'stripe_webhook_error', error:e.message, stack: e.stack }));
    return res.status(500).json({ correlationId, message:'Internal webhook error', error: e.message });
  }
}
