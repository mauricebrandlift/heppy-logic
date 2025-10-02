// Signature verification helpers (no Stripe SDK)
import crypto from 'crypto';

export function parseStripeSignatureHeader(sigHeader){
  const parts = (sigHeader || '').split(',').map(p => p.trim());
  const sig = { t:null, v1:[] };
  for (const part of parts){
    const [k,v] = part.split('=');
    if (k==='t') sig.t=v; if (k==='v1') sig.v1.push(v);
  }
  return sig;
}
export function timingSafeEqualHex(a,b){
  const A = Buffer.from(a,'hex');
  const B = Buffer.from(b,'hex');
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A,B);
}
export function verifySignature(rawBody, sigHeader, secret){
  const parsed = parseStripeSignatureHeader(sigHeader);
  if (!parsed.t || !parsed.v1.length) return false;
  const signedPayload = `${parsed.t}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return parsed.v1.some(sig => timingSafeEqualHex(expected, sig));
}
