import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@/lib/db/client";
import { requireAuth, requireWorkspaceAccess } from "@/lib/auth/guards";
import { convertFromMarkdown, type ConvertibleFormat } from "@/lib/documents/converter";
import { generateArtifactStorageKey } from "@/lib/utils/files";
import { createArtifact } from "@/lib/db/queries/artifacts";
import { getPresignedDownloadUrl } from "@/lib/storage/presigned";
import { conversionQueue } from "@/lib/queue/queues";
import { saveFile } from "@/lib/storage/operations";
import { getStorageMode } from "@/lib/storage/client";
import { AppError, AuthorizationError, NotFoundError, formatErrorResponse, toAppError } from "@/lib/utils/errors";
import type { ArtifactType } from "@prisma/client";


const convertRequestSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  targetFormat: z.enum(["markdown", "html", "pdf", "docx", "csv", "xlsx"]),
  messageId: z.string().optional(),
  conversationId: z.string().optional(),
});

function handleApiError(error: unknown) {
  if (error instanceof z.ZodError) {
    const issues = error.issues.map((i) => i.message).join(", ");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: issues || "Invalid conversion request",
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

function resolveArtifactType(format: ConvertibleFormat): ArtifactType {
  switch (format) {
    case "markdown":
      return "MARKDOWN";
    case "csv":
    case "xlsx":
      return "SPREADSHEET";
    case "docx":
    case "pdf":
    case "html":
    default:
      return "DOCUMENT";
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const json = await req.json();
    const body = convertRequestSchema.parse(json);

    const doc = await db.document.findUnique({
      where: { id: body.documentId },
      include: {
        chunks: {
          orderBy: { index: "asc" },
        },
      },
    });

    if (!doc) {
      throw new NotFoundError("Document", body.documentId);
    }

    try {
      await requireWorkspaceAccess(doc.workspaceId, "MEMBER");
    } catch (authErr) {
      if (authErr instanceof AuthorizationError && authErr.message === "You do not have access to this workspace.") {
        throw new NotFoundError("Document", body.documentId);
      }
      throw authErr;
    }

    // Ensure parent message and conversation strictly belong to doc.workspaceId
    let messageId = body.messageId;
    if (messageId) {
      const msg = await db.message.findFirst({
        where: {
          id: messageId,
          conversation: { workspaceId: doc.workspaceId },
        },
      });
      if (!msg) {
        throw new NotFoundError("Message", messageId);
      }
    } else {
      let conversationId = body.conversationId;
      if (conversationId) {
        const conv = await db.conversation.findFirst({
          where: {
            id: conversationId,
            workspaceId: doc.workspaceId,
          },
        });
        if (!conv) {
          throw new NotFoundError("Conversation", conversationId);
        }
      } else {
        const conv = await db.conversation.create({
          data: {
            title: `Conversion: ${doc.name}`,
            model: "gemini-1.5-flash",
            workspaceId: doc.workspaceId,
            userId: user.id,
            documents: {
              create: { documentId: doc.id },
            },
          },
        });
        conversationId = conv.id;
      }

      const msg = await db.message.create({
        data: {
          conversationId,
          role: "SYSTEM",
          content: `Document conversion requested for "${doc.name}" to format ${body.targetFormat.toUpperCase()}`,
        },
      });
      messageId = msg.id;
    }

    // Direct synchronous conversion for formats supported in-memory (markdown, html)
    if (body.targetFormat === "markdown" || body.targetFormat === "html") {
      const markdownContent =
        doc.chunks.length > 0
          ? doc.chunks.map((c) => c.content).join("\n\n")
          : doc.name;

      const converted = await convertFromMarkdown(markdownContent, body.targetFormat);

      const artifactId = randomUUID();
      const baseName = doc.name.replace(/\.[^.]+$/, "");
      const artifactFileName = `${baseName}${converted.extension}`;
      const storageKey = generateArtifactStorageKey(
        doc.workspaceId,
        artifactId,
        artifactFileName
      );

      await saveFile(storageKey, converted.buffer, converted.mimeType);

      const artifact = await createArtifact({
        name: artifactFileName,
        type: resolveArtifactType(body.targetFormat),
        mimeType: converted.mimeType,
        storageKey,
        messageId,
        sizeBytes: converted.buffer.length,
        metadata: {
          sourceDocumentId: doc.id,
          targetFormat: body.targetFormat,
          directConversion: true,
        },
      });

      let downloadUrl = `/api/artifacts/${artifact.id}/download`;
      if (getStorageMode() !== "local") {
        try {
          const presigned = await getPresignedDownloadUrl(storageKey);
          downloadUrl = presigned.url;
        } catch {
          // Fall back to direct application download route
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          artifactId: artifact.id,
          downloadUrl,
          name: artifact.name,
          mimeType: artifact.mimeType,
          status: "READY",
        },
      });
    }

    // For other formats (pdf, docx, csv, xlsx), enqueue conversion job to BullMQ
    try {
      await conversionQueue.add(
        "convert-document",
        {
          documentId: doc.id,
          targetFormat: body.targetFormat,
          workspaceId: doc.workspaceId,
        },
        {
          jobId: `conv-${doc.id}-${body.targetFormat}-${Date.now()}`,
        }
      );

      return NextResponse.json({
        success: true,
        data: {
          documentId: doc.id,
          targetFormat: body.targetFormat,
          messageId,
          status: "PROCESSING",
          mode: "async",
        },
      });
    } catch (queueErr) {
      console.warn("Conversion queue unavailable:", queueErr);
      throw new AppError(
        `Conversion to ${body.targetFormat.toUpperCase()} could not be queued. Background queue service is unavailable.`,
        "QUEUE_UNAVAILABLE",
        503
      );
    }
  } catch (error) {
    return handleApiError(error);
  }
}
