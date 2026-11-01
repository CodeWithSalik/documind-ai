import { z } from "zod";
import { SUPPORTED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/types/documents";

export const uploadRequestSchema = z
  .object({
    fileName: z
      .string()
      .min(1, "File name is required")
      .max(255, "File name too long")
      .refine(
        (name) => !/[/\\<>:"|?*]/.test(name),
        "File name contains invalid characters",
      )
      .optional(),
    name: z
      .string()
      .min(1, "File name is required")
      .max(255, "File name too long")
      .refine(
        (name) => !/[/\\<>:"|?*]/.test(name),
        "File name contains invalid characters",
      )
      .optional(),
    mimeType: z
      .string()
      .refine(
        (type) => (SUPPORTED_MIME_TYPES as string[]).includes(type),
        "Unsupported file type",
      ),
    sizeBytes: z
      .number()
      .int()
      .positive("File size must be positive")
      .max(MAX_FILE_SIZE_BYTES, `File size exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit`),
    workspaceId: z.string().min(1, "Workspace ID is required"),
    folderId: z.string().optional(),
  })
  .refine((data) => Boolean(data.fileName || data.name), {
    message: "File name is required",
    path: ["fileName"],
  });

export const documentIdSchema = z.object({
  id: z.string().min(1, "Document ID is required"),
});

export const documentUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  folderId: z.string().nullable().optional(),
});

export const folderCreateSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(100),
  workspaceId: z.string().min(1),
  parentId: z.string().optional(),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;
export type DocumentUpdate = z.infer<typeof documentUpdateSchema>;
export type FolderCreate = z.infer<typeof folderCreateSchema>;
