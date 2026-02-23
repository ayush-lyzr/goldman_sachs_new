/**
 * Client-side API config (e.g. for WebSocket to Lyzr metrics).
 * Use NEXT_PUBLIC_ so the key is available in the browser.
 * Fallback hardcoded so WebSocket URL always has x-api-key when env is missing.
 */
const LYZR_API_KEY_ENV =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_LYZR_API_KEY
    : process.env.NEXT_PUBLIC_LYZR_API_KEY;

export const API_KEY: string =
  LYZR_API_KEY_ENV && LYZR_API_KEY_ENV.trim() !== ""
    ? LYZR_API_KEY_ENV
    : "sk-default-PnO8PLVxE8ukLHaAVFQPbnlUYmkkEfXs";
