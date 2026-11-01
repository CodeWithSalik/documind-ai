import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireWorkspaceAccess } from "@/lib/auth/guards";
import { getArtifactById } from "@/lib/db/queries/artifacts";
import { getPresignedDownloadUrl } from "@/lib/storage/presigned";
import { downloadFile } from "@/lib/storage/operations";
import { getStorageMode } from "@/lib/storage/client";
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

export async function GET(req: NextRequest, context: RouteContext) {
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

    const mode = getStorageMode();
    const { searchParams } = new URL(req.url);
    const redirectParam = searchParams.get("redirect");
    const streamParam = searchParams.get("stream");
    const shouldRedirect = redirectParam === "true" || redirectParam === "1";
    const shouldStream = streamParam === "true" || shouldRedirect;

    // In local mode, or if explicit stream requested, stream buffer directly
    if (mode === "local" || shouldStream) {
      try {
        const fileBuffer = await downloadFile(artifact.storageKey);
        const safeName = artifact.name.replace(/["\r\n\t]/g, "_").trim() || "artifact";
        return new NextResponse(new Uint8Array(fileBuffer), {
          status: 200,
          headers: {
            "Content-Type": artifact.mimeType || "application/octet-stream",
            "Content-Length": fileBuffer.length.toString(),
            "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (err) {
        if (mode === "local") throw err;
        // In remote mode, proceed to presigned URL if direct fetch fails
      }
    }

    // In remote mode, generate presigned S3/R2 download URL
    const { url: downloadUrl, expiresAt } = await getPresignedDownloadUrl(artifact.storageKey);

    if (shouldRedirect) {
      return NextResponse.redirect(downloadUrl, 307);
    }

    return NextResponse.json({
      success: true,
      data: {
        downloadUrl,
        expiresAt: expiresAt.toISOString(),
        name: artifact.name,
        mimeType: artifact.mimeType,
        sizeBytes: artifact.sizeBytes,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
