/**
 * Billing Constants
 * Central configuration for the credits/wallet billing system
 */

/** Markup percentage applied on top of provider costs (e.g., 0.05 = 5%) */
export const BILLING_MARKUP_PERCENT = 0.05;

/** Minimum top-up amount in USD */
export const MIN_TOPUP_AMOUNT_USD = 10;

/** Preset top-up amounts shown on the billing page */
export const PRESET_TOPUP_AMOUNTS_USD = [10, 25, 50, 100] as const;

/** Default auto-top-up threshold in USD (user-configurable) */
export const DEFAULT_AUTO_TOPUP_THRESHOLD_USD = 5;

/** Default auto-top-up recharge amount in USD (user-configurable) */
export const DEFAULT_AUTO_TOPUP_AMOUNT_USD = 25;

/**
 * Apply markup to a raw provider cost
 * @param rawCostUsd - The raw cost from the provider (OpenRouter, Fal.ai)
 * @returns The cost with markup applied
 */
export function applyMarkup(rawCostUsd: number): number {
  return rawCostUsd * (1 + BILLING_MARKUP_PERCENT);
}
