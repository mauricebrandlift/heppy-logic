// public/utils/api/waitlist.js
// Client helper voor wachtlijst aanvragen.

import { apiClient } from './client.js';

/**
 * Verstuur een wachtlijst aanvraag naar de backend.
 * @param {object} payload
 * @param {string} payload.naam
 * @param {string} payload.emailadres
 * @param {string} payload.plaats
 * @param {string} payload.straat
 */
export async function submitWaitlistEntry({ naam, emailadres, plaats, straat }) {
  const body = {
    naam,
    email: emailadres,
    plaats,
    straat,
  };

  return apiClient('/routes/wachtlijst', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
