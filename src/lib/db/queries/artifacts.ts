import { db } from "@/lib/db/client";
import type { ArtifactType, Prisma } from "@prisma/client";

export interface CreateArtifactInput {
  name: string;
  type: ArtifactType | "DOCUMENT" | "SPREADSHEET" | "CODE" | "CHART" | "MARKDOWN" | "OTHER";
  mimeType: string;
  storageKey: string;
  messageId: string;
  sizeBytes?: number;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Retrieves all artifacts generated in conversations belonging to a specific workspace.
 */
export async function getWorkspaceArtifacts(workspaceId: string) {
  return db.artifact.findMany({
    where: {
      message: {
        conversation: {
          workspaceId,
        },
      },
    },
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
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Retrieves a single artifact by its ID with parent message and conversation details.
 */
export async function getArtifactById(id: string) {
  return db.artifact.findUnique({
    where: { id },
    include: {
      message: {
        include: {
          conversation: {
            select: {
              id: true,
              title: true,
              workspaceId: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Creates a new artifact record linked to an AI assistant message.
 */
export async function createArtifact(data: CreateArtifactInput) {
  return db.artifact.create({
    data: {
      name: data.name,
      type: data.type as ArtifactType,
      mimeType: data.mimeType,
      storageKey: data.storageKey,
      messageId: data.messageId,
      sizeBytes: data.sizeBytes,
      metadata: data.metadata,
    },
  });
}

/**
 * Deletes an artifact by its ID.
 */
export async function deleteArtifact(id: string) {
  return db.artifact.delete({
    where: { id },
  });
}
