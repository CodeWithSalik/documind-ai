import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireAuth, requireWorkspaceAccess } from "@/lib/auth/guards";
import { documentUpdateSchema } from "@/lib/validators/documents";
import { deleteFile } from "@/lib/storage/operations";
import { AppError, AuthorizationError, NotFoundError, formatErrorResponse, toAppError } from "@/lib/utils/errors";


interface RouteContext {
  params: Promise<{ id: string }>;
}

function handleApiError(error: unknown) {
  if (error instanceof z.ZodError) {
    const issues = error.issues.map((i) => i.message).join(", ");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: issues || "Invalid update data",
          details: error.flatten(),
        },
      },
      { status: 400 }
    );
  }

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

    const document = await db.document.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
        chunks: {
          orderBy: { index: "asc" },
        },
      },
    });

    if (!document) {
      throw new NotFoundError("Document", id);
    }

    try {
      await requireWorkspaceAccess(document.workspaceId, "VIEWER");
    } catch (authErr) {
      if (authErr instanceof AuthorizationError) {
        throw new NotFoundError("Document", id);
      }
      throw authErr;
    }

    return NextResponse.json({
      success: true,
      data: document,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireAuth();

    const json = await req.json();
    const body = documentUpdateSchema.parse(json);

    const existing = await db.document.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError("Document", id);
    }

    try {
      await requireWorkspaceAccess(existing.workspaceId, "MEMBER");
    } catch (authErr) {
      if (authErr instanceof AuthorizationError && authErr.message === "You do not have access to this workspace.") {
        throw new NotFoundError("Document", id);
      }
      throw authErr;
    }

    if (body.folderId) {
      const folder = await db.folder.findFirst({
        where: { id: body.folderId, workspaceId: existing.workspaceId },
      });
      if (!folder) {
        throw new NotFoundError("Folder", body.folderId);
      }
    }

    const updated = await db.document.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            chunks: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireAuth();

    const existing = await db.document.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError("Document", id);
    }

    try {
      await requireWorkspaceAccess(existing.workspaceId, "MEMBER");
    } catch (authErr) {
      if (authErr instanceof AuthorizationError && authErr.message === "You do not have access to this workspace.") {
        throw new NotFoundError("Document", id);
      }
      throw authErr;
    }

    // Coordinate storage removal (local or remote object storage)
    let storageDeleted = true;
    try {
      await deleteFile(existing.storageKey);
    } catch (storageError) {
      storageDeleted = false;
      console.warn(
        `Warning: Storage object cleanup failed for key "${existing.storageKey}". Proceeding with database cascade deletion to avoid leaving orphaned workspace state:`,
        storageError
      );
    }

    // Cascade delete in Prisma deletes chunks and conversation links
    await db.document.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: {
        id,
        deleted: true,
        storageDeleted,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
