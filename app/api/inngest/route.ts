/**
 * Inngest webhook handler.
 *
 * The Inngest SDK automatically verifies INNGEST_SIGNING_KEY on every request.
 * Never process Inngest events without this route — direct calls would bypass auth.
 */
import { serve } from "inngest/next";
import { inngest } from "@/lib/jobs/client";
import { processSource } from "@/lib/jobs/process-source";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processSource,
    // Add more job functions here as they are created:
    // generatePodcast,
  ],
});
