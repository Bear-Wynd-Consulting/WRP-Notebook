/**
 * GET  /api/v1/admin/api-keys — list all API keys (ADMIN only)
 * POST /api/v1/admin/api-keys — create an API key (ADMIN only)
 *
 * The full plaintext key is returned ONCE at creation and never stored.
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { handleApiError, apiError } from "@/lib/api/error-response";
import { toPublicApiKey } from "@/lib/api/response-filters";
import { createAuditLog } from "@/lib/db/scoped-queries";
import { createApiKeySchema } from "@/lib/validation/schemas";
import { generateApiKey } from "@/lib/auth/api-keys";
import { prisma } from "@/lib/db/client";

export async function GET(req: NextRequest) {
  try {
    const apiCtx = await authenticateApiKey(req);

    if (apiCtx.scope !== "ADMIN") {
      return apiError("Admin access required", "FORBIDDEN", 403);
    }

    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: "desc" },
    });

    return Response.json({
      data: keys.map(toPublicApiKey), // keyHash never returned
    });
  } catch (err) {
    return handleApiError(err, "GET /api/v1/admin/api-keys");
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiCtx = await authenticateApiKey(req);

    if (apiCtx.scope !== "ADMIN") {
      return apiError("Admin access required", "FORBIDDEN", 403);
    }

    const body = await req.json();
    const data = createApiKeySchema.parse(body);

    // Generate key — only time the plaintext is available
    const { key, hash, prefix } = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        name: data.name,
        keyHash: hash,
        keyPrefix: prefix,
        scope: data.scope,
        permissions: data.permissions,
        notebookIds: data.notebookIds,
        ownerId: apiCtx.id,
        rateLimit: data.rateLimit,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
    });

    await createAuditLog({
      action: "api_key.create",
      actorType: "api_key",
      actorId: apiCtx.id,
      resource: `api_key:${apiKey.id}`,
      metadata: { name: data.name, scope: data.scope },
    });

    return Response.json(
      {
        data: {
          ...toPublicApiKey(apiKey),
          // Return full key ONCE — never stored or returned again
          key,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err, "POST /api/v1/admin/api-keys");
  }
}
