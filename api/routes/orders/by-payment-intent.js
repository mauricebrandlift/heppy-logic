// api/routes/orders/by-payment-intent.js
/**
 * Haal bestelling op via Stripe Payment Intent ID
 * Gebruikt voor success pagina om order details te tonen
 */

import { supabaseConfig } from '../../config/index.js';
import { httpClient } from '../../utils/apiClient.js';
import { handleErrorResponse } from '../../utils/errorHandler.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const correlationId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Get payment_intent_id from query params
    const { payment_intent_id } = req.query;

    if (!payment_intent_id) {
      return res.status(400).json({
        correlationId,
        error: 'payment_intent_id is required'
      });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'orders/by-payment-intent',
      action: 'fetch_order',
      paymentIntentId: payment_intent_id
    }));

    // Fetch order from database
    const orderResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/bestellingen?stripe_payment_intent_id=eq.${encodeURIComponent(payment_intent_id)}&select=*`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`
        }
      }
    );

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        route: 'orders/by-payment-intent',
        action: 'fetch_order_failed',
        status: orderResponse.status,
        error: errorText
      }));
      return res.status(500).json({
        correlationId,
        error: 'Failed to fetch order'
      });
    }

    const orders = await orderResponse.json();

    if (!orders || orders.length === 0) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'orders/by-payment-intent',
        action: 'order_not_found',
        paymentIntentId: payment_intent_id
      }));
      return res.status(404).json({
        correlationId,
        error: 'Order not found'
      });
    }

    const order = orders[0];

    // Fetch order items
    const itemsResponse = await httpClient(
      `${supabaseConfig.url}/rest/v1/bestelling_items?bestelling_id=eq.${order.id}&select=*`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`
        }
      }
    );

    let items = [];
    if (itemsResponse.ok) {
      items = await itemsResponse.json();
    } else {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        route: 'orders/by-payment-intent',
        action: 'fetch_items_failed',
        orderId: order.id
      }));
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      route: 'orders/by-payment-intent',
      action: 'order_found',
      orderId: order.id,
      bestelNummer: order.bestel_nummer,
      itemCount: items.length
    }));

    // Return order with items
    return res.status(200).json({
      correlationId,
      ...order,
      items
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      route: 'orders/by-payment-intent',
      action: 'unexpected_error',
      error: error.message,
      stack: error.stack
    }));

    return handleErrorResponse(res, error, correlationId);
  }
}
