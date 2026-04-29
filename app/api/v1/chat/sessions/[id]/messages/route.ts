/**
 * GET /api/v1/chat/sessions/:id/messages — list messages in a chat session
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { authorizeChatSessionAccess } from "@/lib/auth/authorize";
import { handleApiError } from "@/lib/api/error-response";
import { toPublicChatMessage } from "@/lib/api/response-filters";
import { getChatMessagesForSession } from "@/lib/db/scoped-queries";
import { paginationSchema } from "@/lib/validation/schemas";
import type { RouteCtx } from '@/lib/types/route-context';

export async function GET(
  req: NextRequest,
  ctx: RouteCtx<{ id: string }>
) {
  try {
    const { id } = await ctx.params;
    const apiCtx = await authenticateApiKey(req);
    await authorizeChatSessionAccess(id, apiCtx);

    const { searchParams } = req.nextUrl;
    const { limit, offset } = paginationSchema.parse({
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    });

    const messages = await getChatMessagesForSession(id);
    const page = messages.slice(offset, offset + limit);

    return Response.json({
      data: page.map(toPublicChatMessage),
      meta: { total: messages.length, limit, offset },
    });
  } catch (err) {
    return handleApiError(err, "GET /api/v1/chat/sessions/[id]/messages");
  }
}
