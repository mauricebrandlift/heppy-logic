// api/routes/dashboard/schoonmaker/stripe-connect-link.js
/**
 * Generate Stripe Connect login link voor schoonmaker
 * 
 * GET /api/routes/dashboard/schoonmaker/stripe-connect-link
 * 
 * Returns:
 * - loginLink: Stripe login link URL
 * 
 * Note: Vereist dat schoonmaker een Stripe Connect account heeft
 */

import { supabaseConfig } from '../../../config/index.js';
import { httpClient } from '../../../utils/apiClient.js';
import { handleErrorResponse } from '../../../utils/errorHandler.js';
import { verifyAuth } from '../../../checks/authCheck.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const correlationId = req.headers['x-correlation-id'] || `stripe-connect-${Date.now()}`;
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ correlationId, message: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ correlationId, message: 'Authenticatie vereist' });
    }
    const token = authHeader.split(' ')[1];
    const user = await verifyAuth(token);

    if (!user.stripe_customer_id) {
      return res.status(400).json({
        correlationId,
        message: 'Schoonmaker heeft geen Stripe account'
      });
    }

    // Create Stripe login link via API
    const loginLinkResponse = await httpClient(
      `https://api.stripe.com/v1/accounts/${user.stripe_customer_id}/login_links`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: ''
      }
    );

    if (!loginLinkResponse.ok) {
      const error = await loginLinkResponse.text();
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        route: 'dashboard/schoonmaker/stripe-connect-link',
        error
      }));
      throw new Error('Kon Stripe login link niet genereren');
    }

    const loginLinkData = await loginLinkResponse.json();

    console.log('✅ [Stripe Connect] Login link gegenereerd voor user:', user.id);

    return res.status(200).json({
      loginLink: loginLinkData.url
    });

  } catch (error) {
    console.error('❌ [Stripe Connect] Error:', error);
    return handleErrorResponse(error, res, correlationId);
  }
}
