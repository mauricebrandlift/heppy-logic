// api/utils/errorHandler.js
/**
 * Standaardiseert foutafhandeling voor API routes.
 */

/**
 * Verstuurt een gestandaardiseerde JSON error response.
 * @param {object} res Het Express response object (of vergelijkbaar).
 * @param {Error} error Het error object.
 * @param {number} [defaultStatusCode=500] De status code om te gebruiken als error.code niet bestaat.
 * @param {string} [correlationId] Optionele correlation ID.
 */
export function handleErrorResponse(res, error, defaultStatusCode = 500, correlationId) {
  // Support both error.code and error.statusCode
  const statusCode = error.statusCode || (typeof error.code === 'number' ? error.code : defaultStatusCode);
  const message = error.message || 'An unexpected error occurred.';

  // Log de error server-side (uitgebreider dan wat naar client gaat)
  console.error(JSON.stringify({
    correlationId,
    level: 'ERROR',
    message: `API Error Response: ${message}`,
    statusCode,
    errorDetails: {
      name: error.name,
      message: error.message,
      // stack: error.stack, // Overweeg stack alleen in dev of specifieke scenario's te loggen
      code: error.code,
      statusCode: error.statusCode,
      // ...andere custom error properties
    },
    path: res.req?.originalUrl || res.req?.url, // Express vs Vercel
  }));

  res.status(statusCode).json({
    correlationId,
    error: message,
    // Je kunt hier extra details toevoegen afhankelijk van de error en je policy
    details: error.details || {}
  });
}
