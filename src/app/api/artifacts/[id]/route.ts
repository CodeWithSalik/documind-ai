import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireWorkspaceAccess } from "@/lib/auth/guards";
import { getArtifactById } from "@/lib/db/queries/artifacts";
import { AppError, AuthorizationError, NotFoundError, formatErrorResponse, toAppError } from "@/lib/utils/errors";


interface RouteContext {
  params: Promise<{ id: string }>;
}

function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
  }

  const appErr = toAppError(error);
  return NextResponse.json(formatErrorResponse(appErr), { status: appErr.statusCode });
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireAuth();

    const artifact = await getArtifactById(id);
    if (!artifact) {
      throw new NotFoundError("Artifact", id);
    }

    const workspaceId = artifact.message.conversation.workspaceId;
    try {
      await requireWorkspaceAccess(workspaceId, "VIEWER");
    } catch (authErr) {
      if (authErr instanceof AuthorizationError) {
        throw new NotFoundError("Artifact", id);
      }
      throw authErr;
    }

    return NextResponse.json({
      success: true,
      data: artifact,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
