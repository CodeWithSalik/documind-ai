import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guards";
import { getUserWorkspaces, createWorkspace } from "@/lib/db/queries/workspaces";
import { AppError, formatErrorResponse, toAppError } from "@/lib/utils/errors";

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "Workspace name must be at least 2 characters").max(50, "Workspace name must be at most 50 characters"),
});

function handleApiError(error: unknown) {
  if (error instanceof z.ZodError) {
    const issues = error.issues.map((i) => i.message).join(", ");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: issues || "Invalid workspace parameters",
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

/**
 * GET /api/workspaces
 * Retrieves all authorized workspaces for the authenticated user.
 * If user has no workspaces, triggers server-side recovery to provision their primary workspace.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    let workspaces = await getUserWorkspaces(user.id);

    // Explicit recovery path: If existing user has no workspace, provision one atomically
    if (workspaces.length === 0) {
      await createWorkspace(user.id, `${user.name || "Personal"}'s Workspace`);
      workspaces = await getUserWorkspaces(user.id);
    }

    const items = workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      plan: w.plan,
      role: w.ownerId === user.id ? ("OWNER" as const) : (w.members[0]?.role || "VIEWER"),
      documentCount: w._count?.documents ?? 0,
      conversationCount: w._count?.conversations ?? 0,
      memberCount: w._count?.members ?? 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        items,
        activeWorkspaceId: items[0]?.id || null,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/workspaces
 * Creates a new workspace and sets the authenticated user as OWNER.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const validated = createWorkspaceSchema.parse(body);

    const workspace = await createWorkspace(user.id, validated.name);

    return NextResponse.json(
      {
        success: true,
        data: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          role: "OWNER",
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
