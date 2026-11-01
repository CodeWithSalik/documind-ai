import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireAuth, requireWorkspaceAccess } from "@/lib/auth/guards";
import { AppError, ValidationError, formatErrorResponse, toAppError } from "@/lib/utils/errors";
import type { ArtifactType, Prisma } from "@prisma/client";


function handleApiError(error: unknown) {
  if (error instanceof z.ZodError) {
    const issues = error.issues.map((i) => i.message).join(", ");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: issues || "Invalid query parameters",
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

    const type = searchParams.get("type") as ArtifactType | null;
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

    const where: Prisma.ArtifactWhereInput = {
      message: {
        conversation: {
          workspaceId,
        },
      },
      ...(type ? { type } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };

    const [total, items] = await Promise.all([
      db.artifact.count({ where }),
      db.artifact.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          message: {
            select: {
              id: true,
              conversationId: true,
              createdAt: true,
              conversation: {
                select: {
                  id: true,
                  title: true,
                },
              },
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
