/**
 * Inngest client — shared across all job definitions.
 *
 * Passing signingKey and eventKey explicitly guards against timing issues where
 * the SDK's per-request env refresh hasn't occurred yet (e.g. cold starts on
 * Vercel). The SDK still falls back to process.env if these are undefined, so
 * passing undefined here is safe — it just makes the "key missing" error
 * visible at the serve layer rather than silently in the SDK internals.
 */
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "wrp-notebook",
  signingKey: process.env.INNGEST_SIGNING_KEY,
  eventKey: process.env.INNGEST_EVENT_KEY,
});
