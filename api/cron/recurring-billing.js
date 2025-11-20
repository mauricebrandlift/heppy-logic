/**
 * Vercel Cron Job: Recurring Billing
 * 
 * Draait dagelijks om 02:00 (configuratie in vercel.json)
 * Checked welke abonnementen vandaag gefactureerd moeten worden
 * 
 * Vercel Cron Documentation:
 * https://vercel.com/docs/cron-jobs
 */

import { processAllRecurringBillings } from '../services/recurringBillingService.js';

export default async function handler(req, res) {
  // Vercel cron jobs gebruiken GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Vercel cron secret verificatie (optioneel maar aanbevolen)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('⚠️ [Cron] Unauthorized request to recurring billing cron');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const correlationId = `cron_${Date.now()}`;
  
  console.log(`⏰ [Cron] ========== RECURRING BILLING CRON TRIGGERED ========== [${correlationId}]`);
  console.log(`⏰ [Cron] Timestamp: ${new Date().toISOString()}`);

  try {
    const result = await processAllRecurringBillings(correlationId);

    console.log(`✅ [Cron] Cron job completed [${correlationId}]`, result);

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      correlationId,
      ...result,
    });

  } catch (error) {
    console.error(`❌ [Cron] Cron job failed [${correlationId}]`, {
      error: error.message,
      stack: error.stack,
    });

    // Return 500 zodat Vercel het als failure logt
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      correlationId,
    });
  }
}
