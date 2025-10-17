// api/services/pricingCalculator.js
// Bevat server-side herberekeningen voor prijzen op basis van configuratie.

/**
 * Parseer een mogelijke numerieke invoer.
 * @param {string|number|null|undefined} value
 * @returns {number}
 */
function toNumber(value) {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Rond uren naar boven af op halve uren, met een minimum.
 * @param {number} hours
 * @param {number} minHours
 * @returns {number}
 */
function roundHoursUp(hours, minHours) {
  const safeMin = Number.isFinite(minHours) && minHours > 0 ? minHours : 0;
  const base = Number.isFinite(hours) && hours > 0 ? hours : 0;
  const rounded = Math.ceil(base * 2) / 2;
  return Math.max(rounded, safeMin);
}

/**
 * Normaliseer uren naar halve uur stappen.
 * @param {number} hours
 * @returns {number}
 */
function normaliseHalfHour(hours) {
  if (!Number.isFinite(hours)) return 0;
  return Math.round(hours * 2) / 2;
}

/**
 * Bereken het aantal benodigde schoonmaakuren op basis van invoer.
 * @param {object} input
 * @param {number} input.m2
 * @param {number} input.toilets
 * @param {number} input.bathrooms
 * @param {object} config
 * @returns {number}
 */
export function calculateCleaningHours({ m2 = 0, toilets = 0, bathrooms = 0 }, config = {}) {
  const minutesPer10m2 = toNumber(config.timePer10m2 ?? config.timePerM2 ?? 0);
  const minutesPerToilet = toNumber(config.timePerToilet ?? 0);
  const minutesPerBathroom = toNumber(config.timePerBathroom ?? 0);

  const totalMinutes = ((toNumber(m2) / 10) * minutesPer10m2)
    + (toNumber(toilets) * minutesPerToilet)
    + (toNumber(bathrooms) * minutesPerBathroom);

  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return 0;
  }

  return totalMinutes / 60;
}

/**
 * Berekent de prijsdetails voor de abonnement-flow.
 * @param {object} context
 * @param {string} context.frequentie
 * @param {string|number} [context.abb_m2]
 * @param {string|number} [context.abb_toiletten]
 * @param {string|number} [context.abb_badkamers]
 * @param {string|number} [context.requestedHours]
 * @param {object} pricingConfig
 * @returns {object}
 */
export function calculateAbonnementPricing(context = {}, pricingConfig = {}) {
  const pricePerHour = toNumber(pricingConfig.pricePerHour);
  if (!Number.isFinite(pricePerHour) || pricePerHour <= 0) {
    const error = new Error('Prijsconfiguratie mist een geldig uurtarief.');
    error.code = 500;
    throw error;
  }

  const minHoursConfig = toNumber(pricingConfig.minHours) || 0;

  const baseHours = calculateCleaningHours({
    m2: context.abb_m2,
    toilets: context.abb_toiletten,
    bathrooms: context.abb_badkamers,
  }, pricingConfig);

  const minConfigured = minHoursConfig > 0 ? minHoursConfig : 3;
  const minComputedHours = roundHoursUp(baseHours, minConfigured);
  const minFromContext = normaliseHalfHour(toNumber(context.abb_min_uren));
  const effectiveMinHours = Math.max(minConfigured, minComputedHours, minFromContext || 0);

  let requestedHours = toNumber(context.requestedHours);
  if (!requestedHours || requestedHours < effectiveMinHours) {
    requestedHours = effectiveMinHours;
  }
  requestedHours = normaliseHalfHour(requestedHours);

  if (requestedHours < effectiveMinHours) {
    const error = new Error('Gekozen uren zijn lager dan toegestaan minimum.');
    error.code = 400;
    throw error;
  }

  const pricePerSession = requestedHours * pricePerHour;
  if (!Number.isFinite(pricePerSession) || pricePerSession <= 0) {
    const error = new Error('Kon prijs per sessie niet berekenen.');
    error.code = 500;
    throw error;
  }

  let sessionsPerCycle;
  switch (context.frequentie) {
    case 'perweek':
      sessionsPerCycle = 4;
      break;
    case 'pertweeweek':
      sessionsPerCycle = 2;
      break;
    default:
      sessionsPerCycle = 4;
      break;
  }

  const bundleAmount = pricePerSession * sessionsPerCycle;
  const bundleAmountCents = Math.round(bundleAmount * 100);

  if (!Number.isInteger(bundleAmountCents) || bundleAmountCents <= 0) {
    const error = new Error('Ongeldig totaalbedrag berekend voor betaling.');
    error.code = 500;
    throw error;
  }

  return {
    baseHours,
    minHours: effectiveMinHours,
    requestedHours,
    pricePerHour,
    pricePerSession,
    sessionsPerCycle,
    bundleAmount,
    bundleAmountCents,
  };
}

export const pricingUtils = {
  toNumber,
  roundHoursUp,
  normaliseHalfHour,
};
