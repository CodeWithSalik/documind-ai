import { z } from "zod";
import { getModelDefinition } from "@/lib/ai/models";

export const chatRequestSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(100_000, "Message too long"),
  conversationId: z.string().optional(),
  modelId: z
    .string()
    .refine(
      (id) => {
        try {
          return !!getModelDefinition(id);
        } catch {
          return false;
        }
      },
      "Invalid model ID",
    ),
  documentIds: z.array(z.string()).optional().default([]),
  workspaceId: z.string().min(1, "Workspace ID is required"),
});

export const conversationCreateSchema = z.object({
  title: z.string().max(200).optional(),
  model: z.string(),
  workspaceId: z.string().min(1),
});

export const conversationUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  model: z.string().optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ConversationCreate = z.infer<typeof conversationCreateSchema>;
export type ConversationUpdate = z.infer<typeof conversationUpdateSchema>;
