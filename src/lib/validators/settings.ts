import { z } from "zod";

export const workspaceCreateSchema = z.object({
  name: z
    .string()
    .min(2, "Workspace name must be at least 2 characters")
    .max(50, "Workspace name too long"),
});

export const workspaceUpdateSchema = z.object({
  name: z.string().min(2).max(50).optional(),
});

export const userProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["MEMBER", "VIEWER"]),
  workspaceId: z.string().min(1),
});

export type WorkspaceCreate = z.infer<typeof workspaceCreateSchema>;
export type WorkspaceUpdate = z.infer<typeof workspaceUpdateSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type InviteMember = z.infer<typeof inviteMemberSchema>;
