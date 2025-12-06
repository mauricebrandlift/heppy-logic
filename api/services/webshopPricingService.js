// api/services/webshopPricingService.js
/**
 * Webshop Pricing Service
 * 
 * Valideert en berekent prijzen voor webshop bestellingen
 * - Haalt prijzen uit database (producten tabel)
 * - Fallback naar Stripe Price API als product niet in DB
 * - Berekent totalen inclusief verzendkosten en BTW
 */

import { stripeConfig, supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

const VERZENDKOSTEN_CENTS = 595; // €5.95 vaste verzendkosten
const BTW_PERCENTAGE = 21; // 21% BTW

/**
 * Valideer cart items tegen database en/of Stripe API
 * 
 * @param {Array} items - Cart items [{id: 'price_xxx', quantity: 1, price: 12.95, name: '...'}]
 * @param {string} correlationId - Voor logging
 * @returns {Promise<Object>} Gevalideerde pricing met correcte bedragen
 */
export async function validateAndCalculateWebshopPricing(items, correlationId) {
  console.log(JSON.stringify({
    level: 'INFO',
    correlationId,
    service: 'webshopPricingService',
    action: 'validate_start',
    itemCount: items.length
  }));

  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Items array is verplicht en mag niet leeg zijn');
    err.code = 400;
    throw err;
  }

  // Stap 1: Verzamel alle Stripe Price IDs
  const stripePriceIds = items.map(item => item.id).filter(Boolean);
  
  if (stripePriceIds.length !== items.length) {
    const err = new Error('Alle items moeten een geldige Stripe Price ID hebben');
    err.code = 400;
    throw err;
  }

  // Stap 2: Haal prijzen op uit database
  const dbPrices = await fetchPricesFromDatabase(stripePriceIds, correlationId);
  
  // Stap 3: Check welke prijzen ontbreken in DB
  const missingPriceIds = stripePriceIds.filter(id => !dbPrices[id]);
  
  // Stap 4: Haal ontbrekende prijzen op van Stripe API
  let stripePrices = {};
  if (missingPriceIds.length > 0) {
    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      service: 'webshopPricingService',
      action: 'fetch_missing_from_stripe',
      missingCount: missingPriceIds.length,
      missingIds: missingPriceIds
    }));
    
    stripePrices = await fetchPricesFromStripe(missingPriceIds, correlationId);
  }

  // Stap 5: Combineer DB en Stripe prijzen
  const allPrices = { ...dbPrices, ...stripePrices };

  // Stap 6: Valideer elk item
  const validatedItems = [];
  let subtotalCents = 0;

  for (const item of items) {
    const serverPrice = allPrices[item.id];
    
    if (!serverPrice) {
      const err = new Error(`Price niet gevonden voor product: ${item.id}`);
      err.code = 400;
      throw err;
    }

    // Valideer dat client price matched met server price (met kleine margin voor floating point)
    const clientPriceCents = Math.round(item.price * 100);
    const priceDifference = Math.abs(clientPriceCents - serverPrice.unit_amount);
    
    if (priceDifference > 1) { // Max 1 cent verschil toegestaan (floating point rounding)
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        service: 'webshopPricingService',
        action: 'price_mismatch',
        itemId: item.id,
        itemName: item.name,
        clientPriceCents,
        serverPriceCents: serverPrice.unit_amount,
        difference: priceDifference
      }));
      
      const err = new Error(`Prijs mismatch voor ${item.name}: client €${item.price}, server €${(serverPrice.unit_amount / 100).toFixed(2)}`);
      err.code = 400;
      err.details = {
        itemId: item.id,
        clientPrice: clientPriceCents,
        serverPrice: serverPrice.unit_amount
      };
      throw err;
    }

    // Bereken item totaal
    const itemSubtotalCents = serverPrice.unit_amount * item.quantity;
    subtotalCents += itemSubtotalCents;

    validatedItems.push({
      id: item.id,
      name: serverPrice.product_name || item.name,
      quantity: item.quantity,
      unit_price_cents: serverPrice.unit_amount,
      subtotal_cents: itemSubtotalCents,
      source: serverPrice.source // 'database' of 'stripe_api'
    });
  }

  // Stap 7: Bereken totalen
  const verzendkostenCents = VERZENDKOSTEN_CENTS;
  const totalCents = subtotalCents + verzendkostenCents;
  const btwCents = Math.round((totalCents * BTW_PERCENTAGE) / (100 + BTW_PERCENTAGE)); // BTW uit totaal

  console.log(JSON.stringify({
    level: 'INFO',
    correlationId,
    service: 'webshopPricingService',
    action: 'validation_complete',
    itemCount: validatedItems.length,
    subtotalCents,
    verzendkostenCents,
    btwCents,
    totalCents
  }));

  return {
    items: validatedItems,
    subtotal_cents: subtotalCents,
    verzendkosten_cents: verzendkostenCents,
    btw_cents: btwCents,
    total_cents: totalCents,
    validation_source: 'server-validated'
  };
}

/**
 * Haal prijzen op uit database (producten tabel)
 * 
 * @param {Array<string>} stripePriceIds - Array van Stripe Price IDs
 * @param {string} correlationId
 * @returns {Promise<Object>} Map van price_id -> {unit_amount, product_name, source}
 */
async function fetchPricesFromDatabase(stripePriceIds, correlationId) {
  if (stripePriceIds.length === 0) return {};

  console.log(JSON.stringify({
    level: 'INFO',
    correlationId,
    service: 'webshopPricingService',
    action: 'fetch_db_prices',
    priceIds: stripePriceIds
  }));

  try {
    const response = await httpClient(
      `${supabaseConfig.url}/rest/v1/producten?stripe_price_id=in.(${stripePriceIds.join(',')})&select=stripe_price_id,prijs_cents,naam`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
        }
      }
    );

    if (!response.ok) {
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        service: 'webshopPricingService',
        action: 'db_fetch_failed',
        status: response.status
      }));
      return {};
    }

    const products = await response.json();

    const priceMap = {};
    for (const product of products) {
      priceMap[product.stripe_price_id] = {
        unit_amount: product.prijs_cents,
        product_name: product.naam,
        source: 'database'
      };
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      service: 'webshopPricingService',
      action: 'db_prices_fetched',
      foundCount: products.length
    }));

    return priceMap;
  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      correlationId,
      service: 'webshopPricingService',
      action: 'db_fetch_error',
      error: error.message
    }));
    return {};
  }
}

/**
 * Haal prijzen op van Stripe API (fallback)
 * Ondersteunt zowel Price IDs (price_xxx) als Product IDs (prod_xxx)
 * Voor Product IDs wordt de default price opgehaald
 * 
 * @param {Array<string>} stripeIds - Array van Stripe Price of Product IDs
 * @param {string} correlationId
 * @returns {Promise<Object>} Map van id -> {unit_amount, product_name, source}
 */
async function fetchPricesFromStripe(stripeIds, correlationId) {
  if (stripeIds.length === 0) return {};

  const priceMap = {};

  for (const id of stripeIds) {
    try {
      // Check of het een Product ID of Price ID is
      const isProductId = id.startsWith('prod_');
      
      console.log(JSON.stringify({
        level: 'INFO',
        correlationId,
        service: 'webshopPricingService',
        action: 'fetch_stripe_price',
        id,
        type: isProductId ? 'product' : 'price'
      }));

      let priceData;
      let productName;

      if (isProductId) {
        // Haal product op met default_price expanded
        const productResponse = await fetch(
          `https://api.stripe.com/v1/products/${encodeURIComponent(id)}?expand[]=default_price`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${stripeConfig.secretKey}`
            }
          }
        );

        if (!productResponse.ok) {
          const errorData = await productResponse.json();
          console.error(JSON.stringify({
            level: 'ERROR',
            correlationId,
            service: 'webshopPricingService',
            action: 'stripe_product_fetch_failed',
            productId: id,
            status: productResponse.status,
            error: errorData?.error?.message
          }));
          
          const err = new Error(`Stripe Product API error voor ${id}: ${errorData?.error?.message || 'Unknown error'}`);
          err.code = 400;
          throw err;
        }

        const productData = await productResponse.json();
        priceData = productData.default_price;
        productName = productData.name;

        if (!priceData || typeof priceData !== 'object') {
          const err = new Error(`Product ${id} heeft geen default_price ingesteld`);
          err.code = 400;
          throw err;
        }

      } else {
        // Haal price op met product expanded
        const priceResponse = await fetch(
          `https://api.stripe.com/v1/prices/${encodeURIComponent(id)}?expand[]=product`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${stripeConfig.secretKey}`
            }
          }
        );

        if (!priceResponse.ok) {
          const errorData = await priceResponse.json();
          console.error(JSON.stringify({
            level: 'ERROR',
            correlationId,
            service: 'webshopPricingService',
            action: 'stripe_price_fetch_failed',
            priceId: id,
            status: priceResponse.status,
            error: errorData?.error?.message
          }));
          
          const err = new Error(`Stripe Price API error voor ${id}: ${errorData?.error?.message || 'Unknown error'}`);
          err.code = 400;
          throw err;
        }

        priceData = await priceResponse.json();
        productName = priceData.product?.name;
      }

      priceMap[id] = {
        unit_amount: priceData.unit_amount,
        product_name: productName || 'Unknown Product',
        source: 'stripe_api'
      };

      console.log(JSON.stringify({
        level: 'INFO',
        correlationId,
        service: 'webshopPricingService',
        action: 'stripe_price_fetched',
        id,
        type: isProductId ? 'product' : 'price',
        unitAmount: priceData.unit_amount,
        productName
      }));

    } catch (error) {
      console.error(JSON.stringify({
        level: 'ERROR',
        correlationId,
        service: 'webshopPricingService',
        action: 'stripe_fetch_error',
        id,
        error: error.message
      }));
      throw error; // Re-throw om validatie te laten falen
    }
  }

  return priceMap;
}
