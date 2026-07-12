/**
 * POST /api/notebooks/:id/api-keys
 *
 * Session-authenticated (NextAuth) endpoint for minting an API key restricted
 * to a single notebook — used by the "Generate API Key" form on the notebook
 * detail page. Admin-only: mirrors the role check on /settings/api-keys.
 *
 * The full plaintext key is returned ONCE at creation and never stored.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-config";
import {
  getNotebookByIdAdmin,
  createNotebookApiKey,
  createAuditLog,
} from "@/lib/db/scoped-queries";
import { createNotebookApiKeySchema } from "@/lib/validation/schemas";
import { generateApiKey } from "@/lib/auth/api-keys";
import { toPublicApiKey } from "@/lib/api/response-filters";
import type { RouteCtx } from "@/lib/types/route-context";

export async function POST(req: NextRequest, ctx: RouteCtx<{ id: string }>) {
  const { id } = await ctx.params;

  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required", code: "FORBIDDEN" }, { status: 403 });
  }

  const notebook = await getNotebookByIdAdmin(id);
  if (!notebook) {
    return NextResponse.json({ error: "Notebook not found", code: "NOT_FOUND" }, { status: 404 });
  }

  let data;
  try {
    data = createNotebookApiKeySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  const { key, hash, prefix } = generateApiKey();

  const apiKey = await createNotebookApiKey({
    name: data.name,
    keyHash: hash,
    keyPrefix: prefix,
    scope: data.scope,
    notebookId: id,
    rateLimit: data.rateLimit,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    ownerId: session.user.id,
  });

  await createAuditLog({
    action: "api_key.create",
    actorType: "user",
    actorId: session.user.id,
    resource: `api_key:${apiKey.id}`,
    metadata: { name: data.name, scope: data.scope, notebookId: id },
  });

  return NextResponse.json(
    {
      data: {
        ...toPublicApiKey(apiKey),
        // Return full key ONCE — never stored or returned again
        key,
      },
    },
    { status: 201 }
  );
}
