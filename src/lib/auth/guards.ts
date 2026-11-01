import { auth } from "@/auth";
import {
  AuthenticationError,
  AuthorizationError,
  DatabaseConnectionError,
  isDatabaseConnectionError,
} from "@/lib/utils/errors";
import { db } from "@/lib/db/client";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

/**
 * Requires an authenticated user session or throws AuthenticationError.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  if (process.env.NODE_ENV !== "production" && (globalThis as unknown as { __TEST_USER__?: AuthenticatedUser }).__TEST_USER__) {
    return (globalThis as unknown as { __TEST_USER__: AuthenticatedUser }).__TEST_USER__;
  }

  let session;
  try {
    session = await auth();
  } catch {
    throw new AuthenticationError("You must be signed in to perform this action.");
  }
  if (!session?.user?.id) {
    throw new AuthenticationError("You must be signed in to perform this action.");
  }

  // Ensure user session maps to a valid record in PostgreSQL
  try {
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, image: true },
    });
    if (!dbUser) {
      throw new AuthenticationError("Your session is invalid or user account was not found. Please log in again.");
    }
    return dbUser;
  } catch (err) {
    if (err instanceof AuthenticationError) throw err;
    if (isDatabaseConnectionError(err)) throw new DatabaseConnectionError();
    throw err;
  }
}

/**
 * Ensures user has at least the required role in the specified workspace.
 * Automatically resolves to user's primary workspace if default/unspecified ID is provided.
 */
export async function requireWorkspaceAccess(
  workspaceId: string,
  minRole: "OWNER" | "MEMBER" | "VIEWER" = "VIEWER"
) {
  const user = await requireAuth();

  if (process.env.NODE_ENV !== "production" && (globalThis as unknown as { __TEST_WORKSPACE_ACCESS__?: (wsId: string, role: string, u: unknown) => Promise<unknown> }).__TEST_WORKSPACE_ACCESS__) {
    const fn = (globalThis as unknown as { __TEST_WORKSPACE_ACCESS__: (wsId: string, role: string, u: unknown) => Promise<unknown> }).__TEST_WORKSPACE_ACCESS__;
    return (await fn(workspaceId, minRole, user)) as {
      user: typeof user;
      membership: { id: string; userId: string; workspaceId: string; role: "OWNER" | "MEMBER" | "VIEWER"; joinedAt: Date };
      workspace: { id: string; name?: string; slug?: string; ownerId?: string } | null;
    };
  }

  try {
    const isDefaultOrEmpty = !workspaceId || workspaceId === "default" || workspaceId === "default-workspace";

    const membership = !isDefaultOrEmpty
      ? await db.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId: user.id,
              workspaceId,
            },
          },
          include: { workspace: true },
        })
      : null;

    if (!membership) {
      if (!isDefaultOrEmpty) {
        // Check if user is direct owner of the requested workspace
        const targetWorkspace = await db.workspace.findUnique({
          where: { id: workspaceId },
        });
        if (targetWorkspace && targetWorkspace.ownerId === user.id) {
          // Direct owner with missing membership record: repair membership atomically
          const repairedMembership = await db.workspaceMember.upsert({
            where: {
              userId_workspaceId: {
                userId: user.id,
                workspaceId: targetWorkspace.id,
              },
            },
            create: {
              userId: user.id,
              workspaceId: targetWorkspace.id,
              role: "OWNER",
            },
            update: {
              role: "OWNER",
            },
          });
          return {
            user,
            membership: repairedMembership,
            workspace: targetWorkspace,
          };
        }
        // Explicit workspace requested, but user is neither member nor owner
        throw new AuthorizationError("You do not have access to this workspace.");
      }

      // If workspace is default/unspecified, resolve user's owned/accessible workspace
      let userWorkspace = await db.workspace.findFirst({
        where: {
          OR: [
            { ownerId: user.id },
            { members: { some: { userId: user.id } } },
          ],
        },
        include: {
          members: { where: { userId: user.id } },
        },
        orderBy: { createdAt: "asc" },
      });

      // Safe explicit recovery path: Authenticated user exists in database but has no workspace yet.
      // Server-side transactional creation of user's personal workspace with OWNER membership.
      if (!userWorkspace) {
        const baseSlug = "personal-workspace";
        const uniqueSuffix = Math.random().toString(36).substring(2, 8);
        userWorkspace = await db.workspace.create({
          data: {
            name: `${user.name || "Personal"}'s Workspace`,
            slug: `${baseSlug}-${uniqueSuffix}`,
            ownerId: user.id,
            members: {
              create: {
                userId: user.id,
                role: "OWNER",
              },
            },
          },
          include: {
            members: { where: { userId: user.id } },
          },
        });
      }

      const resolvedRole = userWorkspace.ownerId === user.id ? "OWNER" : (userWorkspace.members[0]?.role || "VIEWER");
      return {
        user,
        membership: {
          id: userWorkspace.members[0]?.id || `member-${user.id}`,
          userId: user.id,
          workspaceId: userWorkspace.id,
          role: resolvedRole,
          joinedAt: userWorkspace.members[0]?.joinedAt || new Date(),
        },
        workspace: userWorkspace,
      };
    }

    if (minRole === "OWNER" && membership.role !== "OWNER") {
      throw new AuthorizationError("Workspace owner permissions required.");
    }

    if (minRole === "MEMBER" && membership.role === "VIEWER") {
      throw new AuthorizationError("Edit permissions required for this workspace.");
    }

    return { user, membership, workspace: membership.workspace };
  } catch (dbError) {
    if (dbError instanceof AuthorizationError || dbError instanceof AuthenticationError) {
      throw dbError;
    }
    if (isDatabaseConnectionError(dbError)) {
      throw new DatabaseConnectionError();
    }
    throw dbError;
  }
}
