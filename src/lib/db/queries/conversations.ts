import { db } from "@/lib/db/client";
import type { MessageRole, Prisma } from "@prisma/client";

export interface CreateConversationInput {
  title?: string;
  model: string;
  workspaceId: string;
  userId: string;
  documentIds?: string[];
}

export interface AddMessageInput {
  conversationId: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | MessageRole;
  content: string;
  model?: string;
  tokenCount?: number;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Retrieves all conversations in a workspace for a specific user, sorted by most recently updated.
 */
export async function getWorkspaceConversations(workspaceId: string, userId: string) {
  return db.conversation.findMany({
    where: {
      workspaceId,
      userId,
    },
    orderBy: { updatedAt: "desc" },
    include: {
      documents: {
        include: {
          document: {
            select: {
              id: true,
              name: true,
              mimeType: true,
              sizeBytes: true,
              status: true,
            },
          },
        },
      },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
    },
  });
}

/**
 * Retrieves a single conversation by ID within a workspace, including its attached documents and messages.
 */
export async function getConversationById(id: string, workspaceId: string) {
  return db.conversation.findFirst({
    where: {
      id,
      workspaceId,
    },
    include: {
      documents: {
        include: {
          document: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          artifacts: true,
        },
      },
    },
  });
}

/**
 * Creates a new conversation with optional attached documents.
 */
export async function createConversation(data: CreateConversationInput) {
  return db.conversation.create({
    data: {
      title: data.title ?? "New Conversation",
      model: data.model,
      workspaceId: data.workspaceId,
      userId: data.userId,
      ...(data.documentIds && data.documentIds.length > 0
        ? {
            documents: {
              create: data.documentIds.map((docId) => ({
                documentId: docId,
              })),
            },
          }
        : {}),
    },
    include: {
      documents: {
        include: {
          document: true,
        },
      },
    },
  });
}

/**
 * Adds a new message to a conversation and updates the conversation's updatedAt timestamp.
 */
export async function addMessage(data: AddMessageInput) {
  const [message] = await db.$transaction([
    db.message.create({
      data: {
        conversationId: data.conversationId,
        role: data.role as MessageRole,
        content: data.content,
        model: data.model,
        tokenCount: data.tokenCount,
        metadata: data.metadata,
      },
      include: {
        artifacts: true,
      },
    }),
    db.conversation.update({
      where: { id: data.conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return message;
}

/**
 * Retrieves all messages for a specific conversation in chronological order.
 */
export async function getConversationMessages(conversationId: string) {
  return db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    include: {
      artifacts: true,
    },
  });
}

/**
 * Deletes a conversation if it belongs to the given workspace.
 */
export async function deleteConversation(id: string, workspaceId: string) {
  const conversation = await db.conversation.findFirst({
    where: { id, workspaceId },
  });

  if (!conversation) {
    return null;
  }

  return db.conversation.delete({
    where: { id },
  });
}
