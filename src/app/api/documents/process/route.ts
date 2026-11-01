import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireAuth, requireWorkspaceAccess } from "@/lib/auth/guards";
import { updateDocumentStatus, saveDocumentChunks } from "@/lib/db/queries/documents";
import { documentProcessingQueue } from "@/lib/queue/queues";
import { downloadFile } from "@/lib/storage/operations";
import { processDocument } from "@/lib/documents/processor";
import { chunkText } from "@/lib/documents/chunker";
import {
  AppError,
  AuthorizationError,
  DocumentProcessingError,
  NotFoundError,
  formatErrorResponse,
  toAppError,
} from "@/lib/utils/errors";
import type { Prisma } from "@prisma/client";


const processRequestSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  storageKey: z.string().optional(),
});

function handleApiError(error: unknown) {
  if (error instanceof z.ZodError) {
    const issues = error.issues.map((i) => i.message).join(", ");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: issues || "Invalid process request",
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

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const json = await req.json();
    const body = processRequestSchema.parse(json);

    const document = await db.document.findUnique({
      where: { id: body.documentId },
    });

    if (!document) {
      throw new NotFoundError("Document", body.documentId);
    }

    try {
      await requireWorkspaceAccess(document.workspaceId, "MEMBER");
    } catch (authErr) {
      if (authErr instanceof AuthorizationError && authErr.message === "You do not have access to this workspace.") {
        throw new NotFoundError("Document", body.documentId);
      }
      throw authErr;
    }

    // Never trust client-supplied storageKey; strictly use the database record's storageKey
    const storageKey = document.storageKey;

    // Transition document to PROCESSING state
    await updateDocumentStatus(document.id, "PROCESSING");

    // Attempt to queue the job via BullMQ
    let queued = false;
    try {
      await documentProcessingQueue.add(
        "process-document",
        {
          documentId: document.id,
          storageKey,
          mimeType: document.mimeType,
          workspaceId: document.workspaceId,
        },
        {
          jobId: `doc-${document.id}`,
        }
      );
      queued = true;
    } catch (queueError) {
      console.warn(
        "BullMQ or Redis unavailable. Falling back to synchronous processing:",
        queueError
      );
    }

    // Graceful synchronous execution fallback for local dev when Redis is not running
    if (!queued) {
      try {
        const fileBuffer = await downloadFile(storageKey);
        const extraction = await processDocument(fileBuffer, document.mimeType, document.name);
        const chunks = chunkText(extraction.text, {}, extraction.pages);

        await saveDocumentChunks(
          document.id,
          chunks.map((c) => ({
            index: c.index,
            content: c.content,
            pageNumber: c.pageNumber,
            metadata: { tokenCount: c.tokenCount },
          }))
        );

        const updatedDoc = await updateDocumentStatus(document.id, "READY", {
          pageCount: extraction.pageCount,
          wordCount: extraction.wordCount,
          metadata: extraction.metadata as Prisma.InputJsonValue,
          processedAt: new Date(),
        });

        return NextResponse.json({
          success: true,
          data: {
            documentId: document.id,
            status: updatedDoc.status,
            mode: "sync",
            pageCount: extraction.pageCount,
            wordCount: extraction.wordCount,
            chunkCount: chunks.length,
          },
        });
      } catch (syncError) {
        const errorMessage = (syncError as Error).message || "Synchronous processing failed";
        const errorCode =
          syncError instanceof DocumentProcessingError
            ? syncError.documentErrorCode
            : "PROCESSING_ERROR";
        const statusCode =
          syncError instanceof AppError
            ? syncError.statusCode
            : 422;

        await updateDocumentStatus(document.id, "ERROR", {
          errorMessage,
        });

        throw new AppError(
          errorMessage,
          errorCode,
          statusCode
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        documentId: document.id,
        status: "PROCESSING",
        mode: "async",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
