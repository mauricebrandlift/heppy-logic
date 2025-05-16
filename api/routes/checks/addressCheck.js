// api/routes/checks/addressCheck.js

/**
 * HTTP-route handler voor POST /api/checks/addressCheck
 * 
 * Delegates naar de business logic in checks/addressCheck.js
 *
 * @module api/routes/checks/addressCheck
 * @version 1.0.0
 */
import { addressCheck } from '../../../checks/addressCheck.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const result = await addressCheck(req.body);
    return res.status(200).json(result);
  } catch (err) {
    console.error('AddressCheck error:', err);
    const statusCode = err.code || 500;
    return res.status(statusCode).json({ message: err.message || 'Internal server error' });
  }
}
