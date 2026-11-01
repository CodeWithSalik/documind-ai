import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireAuth, requireWorkspaceAccess } from "@/lib/auth/guards";
import { AppError, ValidationError, formatErrorResponse, toAppError } from "@/lib/utils/errors";
import type { DocumentStatus, Prisma } from "@prisma/client";


const registerDocumentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(255).optional(),
  fileName: z.string().min(1).max(255).optional(),
  mimeType: z.string().min(1, "MIME type is required"),
  sizeBytes: z.number().int().positive("File size must be positive"),
  storageKey: z.string().min(1, "Storage key is required"),
  workspaceId: z.string().min(1, "Workspace ID is required"),
  folderId: z.string().nullable().optional(),
  pageCount: z.number().int().optional(),
  wordCount: z.number().int().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function handleApiError(error: unknown) {
  if (error instanceof z.ZodError) {
    const issues = error.issues.map((i) => i.message).join(", ");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: issues || "Invalid request payload",
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

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);

    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) {
      throw new ValidationError("workspaceId query parameter is required");
    }

    await requireWorkspaceAccess(workspaceId, "VIEWER");

    const folderId = searchParams.get("folderId");
    const status = searchParams.get("status") as DocumentStatus | null;
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

    const where: Prisma.DocumentWhereInput = {
      workspaceId,
      ...(folderId === "root" || folderId === "null"
        ? { folderId: null }
        : folderId
          ? { folderId }
          : {}),
      ...(status ? { status } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };

    const [total, items] = await Promise.all([
      db.document.count({ where }),
      db.document.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
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
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const json = await req.json();
    const body = registerDocumentSchema.parse(json);

    const documentName = body.name || body.fileName;
    if (!documentName) {
      throw new ValidationError("Document name is required");
    }

    await requireWorkspaceAccess(body.workspaceId, "MEMBER");

    // Strict storage key prefix and path verification
    const expectedPrefix = `workspaces/${body.workspaceId}/`;
    if (!body.storageKey.startsWith(expectedPrefix)) {
      throw new ValidationError(`Invalid storage key: must begin with authorized workspace prefix "${expectedPrefix}"`);
    }

    // Verify no cross-tenant collision exists for storageKey or explicit ID
    const existingByStorageKey = await db.document.findUnique({
      where: { storageKey: body.storageKey },
    });
    if (existingByStorageKey && existingByStorageKey.workspaceId !== body.workspaceId) {
      throw new ValidationError("Storage key collision or access denied");
    }

    if (body.id) {
      const existingById = await db.document.findUnique({
        where: { id: body.id },
      });
      if (existingById && existingById.workspaceId !== body.workspaceId) {
        throw new ValidationError("Document ID collision or access denied");
      }
    }

    // If folderId is provided, verify it belongs to this workspace
    if (body.folderId) {
      const folder = await db.folder.findFirst({
        where: { id: body.folderId, workspaceId: body.workspaceId },
      });
      if (!folder) {
        throw new ValidationError(`Folder not found: ${body.folderId}`);
      }
    }

    const document = await db.document.upsert({
      where: { storageKey: body.storageKey },
      create: {
        ...(body.id ? { id: body.id } : {}),
        name: documentName,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        storageKey: body.storageKey,
        workspaceId: body.workspaceId,
        uploadedById: user.id,
        folderId: body.folderId ?? null,
        status: "PENDING",
        pageCount: body.pageCount,
        wordCount: body.wordCount,
        metadata: body.metadata as Prisma.InputJsonValue,
      },
      update: {
        name: documentName,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        folderId: body.folderId ?? null,
        ...(body.pageCount !== undefined ? { pageCount: body.pageCount } : {}),
        ...(body.wordCount !== undefined ? { wordCount: body.wordCount } : {}),
        ...(body.metadata !== undefined ? { metadata: body.metadata as Prisma.InputJsonValue } : {}),
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

    return NextResponse.json({ success: true, data: document }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
