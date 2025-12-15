// api/utils/errorHandler.js
/**
 * Standaardiseert foutafhandeling voor API routes.
 */

/**
 * Verstuurt een gestandaardiseerde JSON error response.
 * @param {Error} error Het error object.
 * @param {object} res Het Express response object (of vergelijkbaar).
 * @param {string} [correlationId] Optionele correlation ID.
 */
export function handleErrorResponse(error, res, correlationId) {
  // Support error.status (primary), error.statusCode, and error.code
  const statusCode = error.status || error.statusCode || (typeof error.code === 'number' ? error.code : 500);
  const message = error.message || 'An unexpected error occurred.';

  // Log de error server-side (uitgebreider dan wat naar client gaat)
  console.error(JSON.stringify({
    level: 'ERROR',
    message: `API Error Response: ${message}`,
    correlationId,
    statusCode,
    errorDetails: {
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
      statusCode: error.statusCode,
    },
    path: res.req?.originalUrl || res.req?.url,
  }));

  return res.status(statusCode).json({
    correlationId,
    error: message,
    details: error.details || {}
  });
}
