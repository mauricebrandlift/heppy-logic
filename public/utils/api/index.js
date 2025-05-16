/**
 * Central API facade exporting all domain-specific modules and HTTP methods.
 *
 * @module public/utils/api/index
 * @version 1.0.0
 */

// HTTP methods
export { get, post, put, remove } from './client.js';

// Domain-specific API modules
export { getAddressInfo } from './checks/address.js';

// export other modules as needed, e.g.:
// export { createSubscription, cancelSubscription } from './subscription.js';
