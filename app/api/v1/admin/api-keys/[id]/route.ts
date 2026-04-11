/**
 * DELETE /api/v1/admin/api-keys/:id — revoke an API key (ADMIN only)
 *
 * Soft revocation — sets revokedAt, key is rejected immediately on next use.
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { handleApiError, apiError } from "@/lib/api/error-response";
import { createAuditLog } from "@/lib/db/scoped-queries";
import { NotFoundError } from "@/lib/auth/authorize";
import { prisma } from "@/lib/db/client";
import type { RouteCtx } from '@/lib/types/route-context';

export async function DELETE(
  req: NextRequest,
  ctx: RouteCtx<{ id: string }>
) {
  try {
    const { id } = await ctx.params;
    const apiCtx = await authenticateApiKey(req);

    if (apiCtx.scope !== "ADMIN") {
      return apiError("Admin access required", "FORBIDDEN", 403);
    }

    const existing = await prisma.apiKey.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("API key not found");

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    await createAuditLog({
      action: "api_key.revoke",
      actorType: "api_key",
      actorId: apiCtx.id,
      resource: `api_key:${id}`,
      metadata: { name: existing.name },
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err, "DELETE /api/v1/admin/api-keys/[id]");
  }
}
