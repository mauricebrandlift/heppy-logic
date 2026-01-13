// public/utils/api/index.js
/**
 * Exporteert alle publieke API client functies en gerelateerde utilities.
 * Dit bestand dient als het hoofd-exportpunt voor de api-module aan de client-zijde.
 */

// Exporteer de generieke apiClient en ApiError class voor eventueel direct gebruik
// of voor gebruik in andere specifieke api modules.
export { apiClient, ApiError } from './client.js';

// Exporteer specifieke API functies
export { fetchAddressDetails } from './address.js';
export { fetchCoverageStatus } from './coverage.js';
export { fetchPricingConfiguration } from './pricing.js';
export { fetchAvailableCleaners } from './cleaners.js';
export { submitSollicitatie } from './sollicitatie.js';
export { submitWaitlistEntry } from './waitlist.js';
export { fetchMatchDetails, approveMatch, rejectMatch } from './match.js';

// Voeg hier exports toe voor andere API modules als die worden gemaakt, bijv.:
// export { fetchSomeOtherData } from './someOtherModule.js';
