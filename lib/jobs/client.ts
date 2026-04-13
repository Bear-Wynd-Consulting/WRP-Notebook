/**
 * Inngest client — shared across all job definitions.
 * Signing key is verified by the SDK on every webhook call.
 */
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "wrp-notebook",
  signingKey: process.env.INNGEST_SIGNING_KEY,
  eventKey: process.env.INNGEST_EVENT_KEY,
});
