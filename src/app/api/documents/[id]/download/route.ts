import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { requireAuth, requireWorkspaceAccess } from "@/lib/auth/guards";
import { downloadFile } from "@/lib/storage/operations";
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

function sanitizeFilename(name: string): string {
  return name.replace(/["\r\n\t]/g, "_").trim() || "document";
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireAuth();

    const document = await db.document.findUnique({
      where: { id },
    });

    if (!document) {
      throw new NotFoundError("Document", id);
    }

    // Enforce workspace tenant access with anti-enumeration uniform 404
    try {
      await requireWorkspaceAccess(document.workspaceId, "VIEWER");
    } catch (authErr) {
      if (authErr instanceof AuthorizationError) {
        throw new NotFoundError("Document", id);
      }
      throw authErr;
    }

    // Download buffer from storage (local or remote object storage)
    const fileBuffer = await downloadFile(document.storageKey);

    const { searchParams } = new URL(req.url);
    const inline = searchParams.get("inline") === "true";
    const dispositionType = inline ? "inline" : "attachment";
    const safeName = sanitizeFilename(document.name);

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Length": fileBuffer.length.toString(),
        "Content-Disposition": `${dispositionType}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
