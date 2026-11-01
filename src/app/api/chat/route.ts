import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireAuth, requireWorkspaceAccess } from "@/lib/auth/guards";
import { chatRequestSchema } from "@/lib/validators/chat";
import { createChatStream } from "@/lib/ai/stream";
import { getModelDefinition } from "@/lib/ai/models";
import { isProviderConfigured } from "@/lib/ai/providers";
import { createConversation, addMessage } from "@/lib/db/queries/conversations";
import { estimateTokenCount } from "@/lib/utils/format";
import { AppError, formatErrorResponse, toAppError } from "@/lib/utils/errors";
import { searchDocumentChunks } from "@/lib/documents/retrieval";
import type { DocumentChunkData } from "@/types/documents";
import type { Citation } from "@/types/chat";

function handleApiError(error: unknown) {
  if (error instanceof z.ZodError) {
    const issues = error.issues.map((i) => i.message).join(", ");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: issues || "Invalid request body",
          details: error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const msg = error instanceof Error ? error.message : String(error);
  const status =
    (error as { statusCode?: number; status?: number })?.statusCode ||
    (error as { statusCode?: number; status?: number })?.status;
  if (
    status === 429 ||
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("rate-limits")
  ) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "QUOTA_EXHAUSTED",
          message: "Google Gemini quota exhausted (HTTP 429). Please retry later or update your API key in settings.",
        },
      },
      { status: 429 }
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
    const user = await requireAuth();
    const json = await req.json();
    const body = chatRequestSchema.parse(json);

    // 1. Verify model & provider configuration
    const modelDef = getModelDefinition(body.modelId);
    if (!isProviderConfigured(modelDef.provider)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PROVIDER_NOT_CONFIGURED",
            message: "Google Gemini API key is not configured. Please set GOOGLE_GENERATIVE_AI_API_KEY in your environment variables.",
          },
        },
        { status: 400 }
      );
    }

    // 2. Validate workspace access (with auto-resolution for default IDs)
    const { workspace } = await requireWorkspaceAccess(body.workspaceId, "VIEWER");
    const activeWorkspaceId = workspace ? workspace.id : body.workspaceId;

    // Strict tenant isolation: pre-verify that client-submitted document IDs actually belong to activeWorkspaceId
    const verifiedDocs = body.documentIds && body.documentIds.length > 0
      ? await db.document.findMany({
          where: {
            id: { in: body.documentIds },
            workspaceId: activeWorkspaceId,
          },
          select: { id: true },
        })
      : [];
    const safeDocumentIds = verifiedDocs.map((d) => d.id);

    // 3. Resolve or create conversation
    let conversationId = body.conversationId;
    if (conversationId && conversationId !== "default" && conversationId !== "chat-101") {
      const existing = await db.conversation.findFirst({
        where: { id: conversationId, workspaceId: activeWorkspaceId },
      });
      if (existing) {
        conversationId = existing.id;
        // Persist any newly attached documents to the existing conversation
        if (safeDocumentIds.length > 0) {
          try {
            const linkedDocs = await db.conversationDocument.findMany({
              where: { conversationId: existing.id },
              select: { documentId: true },
            });
            const linkedSet = new Set(linkedDocs.map((d) => d.documentId));
            const newDocIds = safeDocumentIds.filter((id) => !linkedSet.has(id));
            if (newDocIds.length > 0) {
              await db.conversationDocument.createMany({
                data: newDocIds.map((docId) => ({
                  conversationId: existing.id,
                  documentId: docId,
                })),
                skipDuplicates: true,
              });
            }
          } catch (linkErr) {
            console.warn("Failed to link new documents to existing conversation:", linkErr);
          }
        }
      } else {
        const title = body.message.slice(0, 60).trim() || "New Chat";
        const created = await createConversation({
          title,
          model: body.modelId,
          workspaceId: activeWorkspaceId,
          userId: user.id,
          documentIds: safeDocumentIds,
        });
        conversationId = created.id;
      }
    } else {
      const title = body.message.slice(0, 60).trim() || "New Chat";
      const created = await createConversation({
        title,
        model: body.modelId,
        workspaceId: activeWorkspaceId,
        userId: user.id,
        documentIds: safeDocumentIds,
      });
      conversationId = created.id;
    }

    // 4. Load previous conversation history for context
    let previousMessages: Array<{ role: string; content: string }> = [];
    if (conversationId) {
      const dbMessages = await db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        take: 30,
      });
      previousMessages = dbMessages.map((m) => ({
        role: m.role.toLowerCase() as "user" | "assistant" | "system",
        content: m.content,
      }));
    }

    const formattedMessages = previousMessages.map((m) => ({
      role: m.role.toLowerCase() as "user" | "assistant" | "system",
      content: m.content,
    }));

    // Add current user prompt
    formattedMessages.push({
      role: "user",
      content: body.message,
    });

    // 5. Persist user message in DB
    try {
      await addMessage({
        conversationId,
        role: "USER",
        content: body.message,
        model: body.modelId,
        tokenCount: estimateTokenCount(body.message),
      });
    } catch (dbErr) {
      console.warn("Failed to save user message to DB:", dbErr);
    }

    // 6. Resolve all candidate documents (from payload + conversation links)
    const conversationDocs = conversationId
      ? await db.conversationDocument.findMany({
          where: { conversationId },
          select: { documentId: true },
        })
      : [];
    const linkedDocIds = conversationDocs.map((cd) => cd.documentId);

    const candidateDocIds = Array.from(
      new Set([...safeDocumentIds, ...linkedDocIds])
    );

    // Strict tenant isolation: verify authorized documents belonging to this workspace
    const authorizedDocuments = candidateDocIds.length > 0
      ? await db.document.findMany({
          where: {
            id: { in: candidateDocIds },
            workspaceId: activeWorkspaceId,
          },
          select: {
            id: true,
            name: true,
            status: true,
            _count: { select: { chunks: true } },
          },
        })
      : [];
    const authorizedDocIds = authorizedDocuments.map((d) => d.id);

    // 7. Perform retrieval on authorized documents
    const documentChunks: DocumentChunkData[] = [];
    const documentNames = new Map<string, string>();
    let citations: Citation[] = [];
    let noEvidenceFound = false;
    let retrievalMode: "lexical" | "attached_fallback" | "empty" | "none" = "none";

    let unreadyDocumentNotice: string | undefined;

    if (authorizedDocIds.length > 0) {
      const readyDocsWithChunks = authorizedDocuments.filter(
        (d) => d.status === "READY" && d._count.chunks > 0
      );

      if (readyDocsWithChunks.length > 0) {
        const retrieval = await searchDocumentChunks({
          query: body.message,
          workspaceId: activeWorkspaceId,
          documentIds: readyDocsWithChunks.map((d) => d.id),
          maxTokens: 4000,
          topK: 8,
          minScoreThreshold: 1.0,
        });

        retrievalMode = retrieval.mode ?? "none";

        if (retrieval.hasRelevantEvidence && retrieval.chunks.length > 0) {
          for (const chunk of retrieval.chunks) {
            documentNames.set(chunk.documentId, chunk.documentName);
            documentChunks.push({
              id: chunk.id,
              documentId: chunk.documentId,
              index: chunk.chunkIndex,
              content: chunk.content,
              pageNumber: chunk.pageNumber,
              metadata: { score: chunk.score },
            });
            citations.push(chunk.citation);
          }
        } else {
          // Document(s) attached/linked, but no relevant excerpts found
          noEvidenceFound = true;
          citations = [];
        }
      } else {
        // Document(s) attached/linked, but none have extractable chunks (status ERROR or 0 chunks)
        const unreadyNames = authorizedDocuments.map((d) => d.name).join(", ");
        console.warn(`[Chat] Attached document(s) have 0 chunks or are unready: ${unreadyNames}`);
        unreadyDocumentNotice = `The attached document(s) ("${unreadyNames}") could not be read or contain no extractable text chunks.`;
      }
    } else if (candidateDocIds.length > 0) {
      // Client submitted document IDs, but none are authorized in this workspace
      console.warn(`[Chat] Candidate document IDs submitted but unauthorized in workspace ${activeWorkspaceId}`);
      unreadyDocumentNotice = "The requested document(s) could not be found or access is unauthorized for this workspace.";
    }

    // Diagnostics Boundary
    const approxTokens = documentChunks.reduce(
      (acc, c) => acc + (Number(c.metadata?.tokenCount) || estimateTokenCount(c.content)),
      0
    );
    const approxChars = documentChunks.reduce((acc, c) => acc + c.content.length, 0);

    console.log("[Chat Diagnostics]", {
      conversationId,
      workspaceId: activeWorkspaceId,
      receivedDocIdCount: body.documentIds?.length ?? 0,
      linkedConvDocIdCount: linkedDocIds.length,
      candidateDocIdCount: candidateDocIds.length,
      authorizedDocCount: authorizedDocIds.length,
      retrievedChunkCount: documentChunks.length,
      contextTokenCount: approxTokens,
      contextCharCount: approxChars,
      contextAddedToPrompt: documentChunks.length > 0,
      retrievalMode,
    });

    // 8. Create AI chat stream with retrieved context
    const result = await createChatStream({
      modelId: body.modelId,
      messages: formattedMessages,
      documentChunks,
      documentNames,
      noEvidenceFound,
      unreadyDocumentNotice,
    });

    // 9. Stream response to client and persist assistant message on completion
    const encoder = new TextEncoder();
    const isSse = req.headers.get("accept")?.includes("text/event-stream");
    const activeConversationId = conversationId;

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponseText = "";
        try {
          for await (const chunk of result.textStream) {
            fullResponseText += chunk;
            if (isSse) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
            } else {
              controller.enqueue(encoder.encode(chunk));
            }
          }

          if (isSse) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          }
          controller.close();

          try {
            const usage = await Promise.resolve(result.usage).catch(() => null);
            await addMessage({
              conversationId: activeConversationId,
              role: "ASSISTANT",
              content: fullResponseText,
              model: body.modelId,
              tokenCount: usage?.totalTokens ?? estimateTokenCount(fullResponseText),
              metadata: JSON.parse(
                JSON.stringify({
                  citations,
                  tokenUsage: usage,
                }),
              ),
            });
          } catch (dbErr) {
            console.warn("Failed to save assistant response to DB:", dbErr);
          }
        } catch (streamErr) {
          console.error("AI stream transmission error:", streamErr);
          const errorMsg = streamErr instanceof Error ? streamErr.message : "AI streaming failed";
          const isQuotaError =
            errorMsg.includes("quota") ||
            errorMsg.includes("RESOURCE_EXHAUSTED") ||
            errorMsg.includes("429") ||
            (streamErr as { statusCode?: number })?.statusCode === 429;

          if (isQuotaError) {
            console.warn("[DocuMind] Gemini quota exhausted (HTTP 429).");

            if (documentChunks.length > 0) {
              const docList =
                Array.from(documentNames.values()).join(", ") || "Attached Documents";
              const keyPoints = documentChunks
                .map((c, i) => `• **[Source ${i + 1}]** *(Page ${c.pageNumber ?? 1})*:\n  "${c.content.trim()}"`)
                .join("\n\n");

              const excerptResponse = `> ⚠️ **Google Gemini Free Tier Quota Exhausted (HTTP 429)**\n> *Live AI reasoning is temporarily paused because Google Gemini free-tier daily requests are exhausted.*\n> *Below is a local excerpt review displaying verbatim text retrieved from your workspace documents:*\n\n### [Local Retrieved Document Excerpts]\n\n**Sources:** ${docList}\n\n${keyPoints}\n\n---\n*Note: To restore live frontier AI streaming, set an active \`GOOGLE_GENERATIVE_AI_API_KEY\` in your \`.env\` file or [Model Settings](/settings/models).*`;

              // Stream excerpt response to the client
              const words = excerptResponse.split(" ");
              for (let i = 0; i < words.length; i += 3) {
                const chunk = words.slice(i, i + 3).join(" ") + " ";
                if (isSse) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
                  );
                } else {
                  controller.enqueue(encoder.encode(chunk));
                }
              }

              if (isSse) {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
              controller.close();

              try {
                await addMessage({
                  conversationId: activeConversationId,
                  role: "ASSISTANT",
                  content: excerptResponse,
                  model: body.modelId,
                  tokenCount: estimateTokenCount(excerptResponse),
                  metadata: JSON.parse(
                    JSON.stringify({
                      citations,
                      isLocalExcerptReview: true,
                    })
                  ),
                });
              } catch (dbErr) {
                console.warn("Failed to save assistant excerpt review to DB:", dbErr);
              }
              return;
            } else {
              // No documents attached: Return clear, actionable error. Do NOT fabricate AI chat responses.
              const quotaPayload = {
                code: "QUOTA_EXHAUSTED",
                message: "Google Gemini quota exhausted (HTTP 429). Daily free-tier request limit reached. Please retry later or update your API key in .env or settings.",
              };

              if (isSse) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ error: quotaPayload })}\n\n`)
                );
              } else {
                controller.enqueue(
                  encoder.encode(`\n\n[Error: ${quotaPayload.code} - ${quotaPayload.message}]`)
                );
              }
              controller.close();
              return;
            }
          }

          if (isSse) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`)
            );
          } else {
            controller.enqueue(encoder.encode(`\n\n[Error: ${errorMsg}]`));
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": isSse ? "text/event-stream; charset=utf-8" : "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Conversation-Id": conversationId,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_PARAM", message: "conversationId is required" } },
        { status: 400 }
      );
    }

    const conversation = await db.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { userId: user.id },
          { workspace: { members: { some: { userId: user.id } } } },
        ],
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
        documents: {
          include: {
            document: {
              select: {
                id: true,
                name: true,
                mimeType: true,
                sizeBytes: true,
                pageCount: true,
                wordCount: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
