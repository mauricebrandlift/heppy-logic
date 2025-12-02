// api/routes/config/public.js
/**
 * Public configuration endpoint
 * Returns client-safe config like Stripe publishable key
 */

export default async function handler(req, res) {
  // Set CORS headers for ALL responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID');

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Echo correlationId if provided
  const correlationId = req.headers['x-correlation-id'];
  if (correlationId) {
    res.setHeader('X-Correlation-ID', correlationId);
  }

  // Only allow GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      correlationId: correlationId || 'not-provided',
      message: 'Method Not Allowed. Only GET requests are accepted.'
    });
  }

  try {
    console.log('🔧 [Config API] Returning public configuration');
    
    // Return public configuration
    const config = {
      stripePublicKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      environment: process.env.NODE_ENV || 'development'
    };

    if (!config.stripePublicKey) {
      console.warn('⚠️ [Config API] STRIPE_PUBLISHABLE_KEY not configured');
    }

    return res.status(200).json(config);

  } catch (error) {
    console.error('❌ [Config API] Error:', error);
    return res.status(500).json({
      error: 'Er is een probleem opgetreden',
      code: 'CONFIG_ERROR'
    });
  }
}
