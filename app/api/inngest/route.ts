/**
 * Inngest webhook handler.
 *
 * The Inngest SDK automatically verifies INNGEST_SIGNING_KEY on every request.
 * Never process Inngest events without this route — direct calls would bypass auth.
 */
import { serve } from "inngest/next";
import { inngest } from "@/lib/jobs/client";
import { processSource } from "@/lib/jobs/process-source";

// Node.js runtime is required for HMAC signature verification (crypto module).
// force-dynamic prevents static optimisation so PUT syncs and POST webhooks
// execute on every request rather than being cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Anchor function registration to the canonical Vercel production URL so that
// all deployments (production + preview) appear as the same app in the Inngest
// dashboard. Without this, each deployment URL creates a new "unattached sync."
// VERCEL_PROJECT_PRODUCTION_URL is set automatically by Vercel for all envs.
const serveOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processSource,
    // Add more job functions here as they are created:
    // generatePodcast,
  ],
  ...(serveOrigin ? { serveOrigin } : {}),
});
