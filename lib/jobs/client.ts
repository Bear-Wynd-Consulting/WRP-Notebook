/**
 * Inngest client — shared across all job definitions.
 *
 * The SDK reads INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY from process.env
 * on its own; passing them explicitly here would forward `undefined` when a
 * key is missing and mask the real problem. We only warn on startup.
 */
import { Inngest } from "inngest";

if (!process.env.INNGEST_SIGNING_KEY || !process.env.INNGEST_EVENT_KEY) {
  console.warn(
    "[inngest] INNGEST_SIGNING_KEY and/or INNGEST_EVENT_KEY are not set — background jobs will not work"
  );
}

export const inngest = new Inngest({ id: "wrp-notebook" });
