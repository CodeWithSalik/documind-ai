import { db } from "@/lib/db/client";

/**
 * Retrieves all workspaces where the user is a member.
 */
export async function getUserWorkspaces(userId: string) {
  return db.workspace.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    include: {
      members: {
        where: { userId },
        select: {
          role: true,
          joinedAt: true,
        },
      },
      _count: {
        select: {
          documents: true,
          conversations: true,
          members: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Retrieves a workspace by its unique URL slug.
 */
export async function getWorkspaceBySlug(slug: string) {
  return db.workspace.findUnique({
    where: { slug },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      _count: {
        select: {
          documents: true,
          conversations: true,
          members: true,
        },
      },
    },
  });
}

/**
 * Retrieves a workspace by its unique ID.
 */
export async function getWorkspaceById(id: string) {
  return db.workspace.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      _count: {
        select: {
          documents: true,
          conversations: true,
          members: true,
        },
      },
    },
  });
}

/**
 * Creates a new workspace and sets the creator as OWNER.
 */
export async function createWorkspace(userId: string, name: string) {
  const baseSlug =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "workspace";
  const uniqueSuffix = Math.random().toString(36).substring(2, 8);
  const slug = `${baseSlug}-${uniqueSuffix}`;

  return db.workspace.create({
    data: {
      name,
      slug,
      ownerId: userId,
      members: {
        create: {
          userId,
          role: "OWNER",
        },
      },
    },
    include: {
      members: true,
    },
  });
}

/**
 * Gets or creates the default workspace for a user.
 */
export async function getDefaultWorkspace(userId: string) {
  // First try to find a workspace owned by the user
  let workspace = await db.workspace.findFirst({
    where: {
      ownerId: userId,
    },
    include: {
      members: {
        where: { userId },
        select: { role: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // If not owner of any, find any workspace user belongs to
  if (!workspace) {
    workspace = await db.workspace.findFirst({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  // If user has no workspaces at all, create a default workspace
  if (!workspace) {
    workspace = await createWorkspace(userId, "My Workspace");
  }

  return workspace;
}
