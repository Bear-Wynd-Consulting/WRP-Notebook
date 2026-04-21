/**
 * Inngest webhook handler.
 *
 * The Inngest SDK automatically verifies INNGEST_SIGNING_KEY on every request.
 * Never process Inngest events without this route — direct calls would bypass auth.
 */
import { serve } from "inngest/next";
import { inngest } from "@/lib/jobs/client";
import { processSource } from "@/lib/jobs/process-source";

// Inngest requires Node.js crypto for HMAC signature verification, and the
// route must be fully dynamic so PUT-based function registration and POST
// webhook delivery execute per request (not statically optimized).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processSource,
    // Add more job functions here as they are created:
    // generatePodcast,
  ],
});
