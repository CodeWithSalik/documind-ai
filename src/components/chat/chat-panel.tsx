"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Trash2,
  ArrowDown,
  Bot,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput, type ComposerAttachment } from "@/components/chat/chat-input";
import { ContextBar, type ContextDocument } from "@/components/chat/context-bar";
import { StreamingIndicator } from "@/components/chat/streaming-indicator";
import { ModelSelector } from "@/components/chat/model-selector";
import { DEFAULT_MODEL_ID, type ModelId, getModelDefinition } from "@/lib/ai/models";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast-provider";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { MAX_FILE_SIZE_BYTES, SUPPORTED_MIME_TYPES, type SupportedMimeType } from "@/types/documents";
import type { MessageData, Citation } from "@/types/chat";

export interface ChatPanelProps {
  conversationId?: string;
  conversationTitle?: string;
  workspaceId?: string;
  initialMessages?: MessageData[];
  initialDocuments?: ContextDocument[];
  availableDocuments?: ContextDocument[];
  onTitleChange?: (newTitle: string) => void;
  onClearConversation?: () => void;
  onViewArtifact?: (artifactIdOrName: string) => void;
  className?: string;
}

/**
 * Main ChatPanel component coordinating messages, model selection, document context,
 * in-composer document attachments, streaming API communication, and response rendering.
 */
export function ChatPanel({
  conversationId,
  conversationTitle = "DocuMind Research Chat",
  workspaceId = "default-workspace",
  initialMessages = [],
  initialDocuments = [],
  availableDocuments = [],
  onTitleChange,
  onClearConversation,
  onViewArtifact,
  className,
}: ChatPanelProps) {
  const router = useRouter();
  const { setActiveConversationId } = useWorkspaceStore();

  // Conversation state
  const [createdConvId, setCreatedConvId] = React.useState<string | undefined>();
  const activeConvId = conversationId || createdConvId;
  const [messages, setMessages] = React.useState<MessageData[]>(initialMessages);
  const [inputValue, setInputValue] = React.useState("");
  const [selectedModelId, setSelectedModelId] = React.useState<ModelId>(DEFAULT_MODEL_ID);
  const [contextDocuments, setContextDocuments] = React.useState<ContextDocument[]>(initialDocuments);
  const [workspaceDocuments, setWorkspaceDocuments] = React.useState<ContextDocument[]>(availableDocuments);

  // In-composer attachment state
  const [composerAttachments, setComposerAttachments] = React.useState<ComposerAttachment[]>([]);

  // Streaming & Loading state
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [streamingContent, setStreamingContent] = React.useState("");
  const [streamStartTime, setStreamStartTime] = React.useState<number | undefined>();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // UI state
  const [showClearDialog, setShowClearDialog] = React.useState(false);
  const [showScrollBottom, setShowScrollBottom] = React.useState(false);

  // Refs
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const modelDef = React.useMemo(() => {
    try {
      return getModelDefinition(selectedModelId);
    } catch {
      return getModelDefinition(DEFAULT_MODEL_ID);
    }
  }, [selectedModelId]);

  // Auto-scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  React.useEffect(() => {
    scrollToBottom(isStreaming ? "auto" : "smooth");
  }, [messages, streamingContent, isStreaming]);

  // Merge prop documents and fetched/uploaded workspace documents
  const allAvailableDocs = React.useMemo(() => {
    const map = new Map<string, ContextDocument>();
    for (const d of availableDocuments) map.set(d.id, d);
    for (const d of workspaceDocuments) map.set(d.id, d);
    return Array.from(map.values());
  }, [availableDocuments, workspaceDocuments]);

  // Load workspace documents on mount to populate context picker
  React.useEffect(() => {
    let isMounted = true;
    async function loadWorkspaceDocs() {
      try {
        const res = await fetch(`/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data?.items) && isMounted) {
            const docs: ContextDocument[] = json.data.items.map((item: {
              id: string;
              name: string;
              mimeType: string;
              sizeBytes: number;
              pageCount?: number;
            }) => ({
              id: item.id,
              name: item.name,
              mimeType: item.mimeType,
              sizeBytes: item.sizeBytes,
              pageCount: item.pageCount,
              tokenCount: item.pageCount ? item.pageCount * 450 : undefined,
            }));
            setWorkspaceDocuments(docs);
          }
        }
      } catch (err) {
        console.warn("Failed to load workspace documents:", err);
      }
    }
    loadWorkspaceDocs();
    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  // Load existing conversation thread if conversationId is provided
  React.useEffect(() => {
    if (!conversationId || conversationId === "default" || conversationId.startsWith("chat-") || initialMessages.length > 0) return;

    let isMounted = true;
    async function loadConversation() {
      try {
        const res = await fetch(`/api/chat?conversationId=${encodeURIComponent(conversationId!)}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data?.messages && isMounted) {
          const loadedMsgs: MessageData[] = json.data.messages.map((m: {
            id: string;
            conversationId: string;
            role: string;
            content: string;
            model?: string | null;
            createdAt: string;
            metadata?: Record<string, unknown> | null;
          }) => ({
            id: m.id,
            conversationId: m.conversationId,
            role: m.role.toLowerCase() as "user" | "assistant" | "system",
            content: m.content,
            model: m.model || undefined,
            createdAt: new Date(m.createdAt),
            metadata: m.metadata || undefined,
          }));
          setMessages(loadedMsgs);
          if (json.data.title && onTitleChange) {
            onTitleChange(json.data.title);
          }
          if (Array.isArray(json.data.documents) && json.data.documents.length > 0) {
            const loadedDocs: ContextDocument[] = json.data.documents
              .filter((cd: { document?: { id?: string; name?: string } }) => cd.document?.id)
              .map((cd: {
                document: {
                  id: string;
                  name: string;
                  mimeType?: string;
                  sizeBytes?: number;
                  pageCount?: number;
                };
              }) => ({
                id: cd.document.id,
                name: cd.document.name,
                mimeType: cd.document.mimeType || "application/pdf",
                sizeBytes: cd.document.sizeBytes || 0,
                pageCount: cd.document.pageCount || 1,
                tokenCount: (cd.document.pageCount || 1) * 450,
              }));
            setContextDocuments((prev) => {
              const existingIds = new Set(prev.map((d) => d.id));
              const newDocs = loadedDocs.filter((d) => !existingIds.has(d.id));
              return [...prev, ...newDocs];
            });
          }
        }
      } catch (err) {
        console.warn("Failed to load conversation history:", err);
      }
    }

    loadConversation();
    return () => {
      isMounted = false;
    };
  }, [conversationId, initialMessages.length, onTitleChange]);

  // Handle scroll to toggle "Scroll to Bottom" button
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    setShowScrollBottom(!isAtBottom);
  };

  // Add document to context
  const handleAddDocuments = (docs: ContextDocument[]) => {
    setContextDocuments(docs);
  };

  // Remove document from context
  const handleRemoveDocument = (docId: string) => {
    setContextDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  // Handle file addition in composer
  const handleAddFiles = React.useCallback(
    (files: File[]) => {
      for (const file of files) {
        const localId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const ext = file.name.split(".").pop()?.toLowerCase();
        const isSupportedExt =
          ext &&
          ["pdf", "docx", "xlsx", "csv", "txt", "md", "html", "json", "png", "jpg", "jpeg", "webp"].includes(ext);
        const isSupportedMime = SUPPORTED_MIME_TYPES.includes(file.type as SupportedMimeType);

        if (file.size > MAX_FILE_SIZE_BYTES) {
          setComposerAttachments((prev) => [
            ...prev,
            {
              id: localId,
              name: file.name,
              sizeBytes: file.size,
              mimeType: file.type || "application/octet-stream",
              status: "error",
              errorMessage: `Exceeds ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit`,
            },
          ]);
          toast.error(`File exceeds maximum size limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB: ${file.name}`);
          continue;
        }

        if (!isSupportedMime && !isSupportedExt) {
          setComposerAttachments((prev) => [
            ...prev,
            {
              id: localId,
              name: file.name,
              sizeBytes: file.size,
              mimeType: file.type || "application/octet-stream",
              status: "error",
              errorMessage: `Unsupported format (.${ext || "unknown"})`,
            },
          ]);
          toast.error(`Unsupported file format: ${file.name}`);
          continue;
        }

        // Add to composer attachments queue
        const newAttachment: ComposerAttachment = {
          id: localId,
          name: file.name,
          sizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
          status: "uploading",
          progress: 0,
        };
        setComposerAttachments((prev) => [...prev, newAttachment]);

        const uploadDirectly = () => {
          // Direct Multipart Upload for small files (<= 4MB) or local development fallback
          const formData = new FormData();
          formData.append("file", file);
          formData.append("workspaceId", workspaceId);

          const xhr = new XMLHttpRequest();
          activeXhrsRef.current.set(localId, xhr);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.min(95, Math.round((event.loaded / event.total) * 95));
              setComposerAttachments((prev) =>
                prev.map((a) => (a.id === localId ? { ...a, progress: percent } : a))
              );
            }
          };

          xhr.onload = () => {
            activeXhrsRef.current.delete(localId);
            try {
              if (xhr.status >= 200 && xhr.status < 300) {
                const res = JSON.parse(xhr.responseText);
                if (res.success && res.data?.documentId) {
                  const docId = res.data.documentId;
                  const docData = res.data.document;

                  setComposerAttachments((prev) =>
                    prev.map((a) =>
                      a.id === localId
                        ? {
                            ...a,
                            status: "ready",
                            progress: 100,
                            documentId: docId,
                          }
                        : a
                    )
                  );

                  const newContextDoc: ContextDocument = {
                    id: docId,
                    name: docData?.name || file.name,
                    mimeType: docData?.mimeType || file.type,
                    sizeBytes: docData?.sizeBytes || file.size,
                    pageCount: res.data.pageCount || 1,
                    tokenCount: (res.data.pageCount || 1) * 450,
                  };

                  setContextDocuments((prev) =>
                    prev.some((d) => d.id === docId) ? prev : [...prev, newContextDoc]
                  );
                  setWorkspaceDocuments((prev) =>
                    prev.some((d) => d.id === docId) ? prev : [newContextDoc, ...prev]
                  );

                  toast.success(`Attached & Indexed: ${file.name}`, {
                    description: "Ready for AI synthesis with citations.",
                  });
                  return;
                }
              }

              const errorJson = JSON.parse(xhr.responseText);
              const errDetail = errorJson?.error?.message || `Upload failed (${xhr.status})`;
              setComposerAttachments((prev) =>
                prev.map((a) =>
                  a.id === localId
                    ? { ...a, status: "error", errorMessage: errDetail }
                    : a
                )
              );
              toast.error(`Failed to upload ${file.name}: ${errDetail}`);
            } catch {
              setComposerAttachments((prev) =>
                prev.map((a) =>
                  a.id === localId
                    ? { ...a, status: "error", errorMessage: "Failed to parse response" }
                    : a
                )
              );
            }
          };

          xhr.onerror = () => {
            activeXhrsRef.current.delete(localId);
            setComposerAttachments((prev) =>
              prev.map((a) =>
                a.id === localId
                  ? { ...a, status: "error", errorMessage: "Network error" }
                  : a
              )
            );
            toast.error(`Network error while uploading ${file.name}`);
          };

          xhr.onabort = () => {
            activeXhrsRef.current.delete(localId);
          };

          xhr.open("POST", "/api/documents/upload");
          xhr.send(formData);
        };

        const uploadViaPresignedUrl = async () => {
          // Presigned URL flow for large files (> 4MB) to bypass serverless payload limits
          try {
            const presignedRes = await fetch("/api/documents/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                workspaceId,
                fileName: file.name,
                mimeType: file.type || "application/octet-stream",
                sizeBytes: file.size,
              }),
            });

            const presignedData = await presignedRes.json();

            if (!presignedRes.ok || !presignedData.success) {
              const errMsg = presignedData?.error?.message || "Failed to initialize upload";
              // Gracefully fall back to direct upload if presigned URLs are not supported (e.g. local storage mode)
              if (
                errMsg.includes("Presigned URLs are not available in local storage mode") ||
                presignedData?.error?.code === "STORAGE_CONFIGURATION_ERROR"
              ) {
                uploadDirectly();
                return;
              }
              throw new Error(errMsg);
            }

            const { uploadUrl, documentId } = presignedData.data || presignedData;
            if (!uploadUrl || !documentId) {
              throw new Error("Invalid presigned upload response from server");
            }

            // Upload directly to object storage via HTTP PUT
            const putXhr = new XMLHttpRequest();
            activeXhrsRef.current.set(localId, putXhr);

            putXhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const percent = Math.min(90, Math.round((event.loaded / event.total) * 90));
                setComposerAttachments((prev) =>
                  prev.map((a) => (a.id === localId ? { ...a, progress: percent } : a))
                );
              }
            };

            putXhr.onload = async () => {
              activeXhrsRef.current.delete(localId);
              if (putXhr.status >= 200 && putXhr.status < 300) {
                // Update state to processing
                setComposerAttachments((prev) =>
                  prev.map((a) =>
                    a.id === localId
                      ? { ...a, status: "processing", progress: 95, documentId }
                      : a
                  )
                );

                // Trigger document extraction and indexing
                try {
                  const processRes = await fetch("/api/documents/process", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ documentId }),
                  });

                  const processData = await processRes.json();

                  if (!processRes.ok || !processData.success) {
                    throw new Error(processData?.error?.message || "Document processing failed");
                  }

                  setComposerAttachments((prev) =>
                    prev.map((a) =>
                      a.id === localId
                        ? {
                            ...a,
                            status: "ready",
                            progress: 100,
                            documentId,
                          }
                        : a
                    )
                  );

                  const newContextDoc: ContextDocument = {
                    id: documentId,
                    name: file.name,
                    mimeType: file.type || "application/octet-stream",
                    sizeBytes: file.size,
                    pageCount: processData.data?.pageCount || 1,
                    tokenCount: (processData.data?.pageCount || 1) * 450,
                  };

                  setContextDocuments((prev) =>
                    prev.some((d) => d.id === documentId) ? prev : [...prev, newContextDoc]
                  );
                  setWorkspaceDocuments((prev) =>
                    prev.some((d) => d.id === documentId) ? prev : [newContextDoc, ...prev]
                  );

                  toast.success(`Attached & Indexed: ${file.name}`, {
                    description: "Ready for AI synthesis with citations.",
                  });
                } catch (procErr: unknown) {
                  const errMsg = procErr instanceof Error ? procErr.message : "Processing failed";
                  setComposerAttachments((prev) =>
                    prev.map((a) =>
                      a.id === localId
                        ? { ...a, status: "error", errorMessage: errMsg }
                        : a
                    )
                  );
                  toast.error(`Failed to process ${file.name}: ${errMsg}`);
                }
              } else {
                const errMsg = `Storage upload failed (${putXhr.status})`;
                setComposerAttachments((prev) =>
                  prev.map((a) =>
                    a.id === localId
                      ? { ...a, status: "error", errorMessage: errMsg }
                      : a
                    )
                );
                toast.error(`Failed to upload ${file.name}: ${errMsg}`);
              }
            };

            putXhr.onerror = () => {
              activeXhrsRef.current.delete(localId);
              setComposerAttachments((prev) =>
                prev.map((a) =>
                  a.id === localId
                    ? { ...a, status: "error", errorMessage: "Storage network error" }
                    : a
                )
              );
              toast.error(`Storage network error uploading ${file.name}`);
            };

            putXhr.onabort = () => {
              activeXhrsRef.current.delete(localId);
            };

            putXhr.open("PUT", uploadUrl);
            putXhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
            putXhr.send(file);
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "Upload initialization failed";
            setComposerAttachments((prev) =>
              prev.map((a) =>
                a.id === localId
                  ? { ...a, status: "error", errorMessage: errMsg }
                  : a
              )
            );
            toast.error(`Upload error: ${errMsg}`);
          }
        };

        const DIRECT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024; // 4MB threshold for serverless
        if (file.size <= DIRECT_UPLOAD_MAX_BYTES) {
          uploadDirectly();
        } else {
          uploadViaPresignedUrl();
        }
      }
    },
    [workspaceId]
  );

  // Keep track of active XHRs for attachments to support cancellation
  const activeXhrsRef = React.useRef<Map<string, XMLHttpRequest>>(new Map());

  // Remove staged attachment from composer
  const handleRemoveAttachment = React.useCallback((id: string) => {
    const xhr = activeXhrsRef.current.get(id);
    if (xhr) {
      xhr.abort();
      activeXhrsRef.current.delete(id);
    }
    setComposerAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att?.documentId) {
        setContextDocuments((curr) => curr.filter((d) => d.id !== att.documentId));
      }
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  // Stop response generation
  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (streamingContent.trim()) {
      const assistantMsg: MessageData = {
        id: `msg-${Date.now()}`,
        conversationId: conversationId || "default",
        role: "assistant",
        content: streamingContent,
        model: modelDef.displayName,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }

    setIsStreaming(false);
    setStreamingContent("");
  };

  // Clear conversation
  const handleConfirmClear = () => {
    setMessages([]);
    setStreamingContent("");
    setIsStreaming(false);
    setShowClearDialog(false);
    setCreatedConvId(undefined);
    if (onClearConversation) {
      onClearConversation();
    }
  };

  // Send message and stream response from /api/chat
  const handleSendMessage = async (userText: string) => {
    if (!userText.trim() || isStreaming) return;

    // Collect ready attachment IDs
    const readyDocIds = composerAttachments
      .filter((a) => a.status === "ready" && a.documentId)
      .map((a) => a.documentId as string);

    // Merge into effective document IDs
    const effectiveDocIds = Array.from(
      new Set([...contextDocuments.map((d) => d.id), ...readyDocIds])
    );

    const currentThreadId = activeConvId || conversationId;
    setErrorMessage(null);
    const userMessage: MessageData = {
      id: `msg-${Date.now()}`,
      conversationId: currentThreadId || "default",
      role: "user",
      content: userText,
      createdAt: new Date(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInputValue("");
    setComposerAttachments([]); // clear staged attachments

    setIsStreaming(true);
    setStreamingContent("");
    setStreamStartTime(Date.now());

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: abortController.signal,
        body: JSON.stringify({
          message: userText,
          conversationId: currentThreadId,
          modelId: selectedModelId,
          documentIds: effectiveDocIds,
          workspaceId,
        }),
      });

      // Check if conversation ID header is returned for newly created threads
      const returnedConvId = response.headers.get("X-Conversation-Id");
      if (returnedConvId && (!currentThreadId || currentThreadId === "default")) {
        setCreatedConvId(returnedConvId);
        setActiveConversationId(returnedConvId);
        window.history.replaceState(null, "", `/chat/${returnedConvId}`);
      }

      if (!response.ok) {
        let msg = `Error: ${response.status} ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (errJson?.error?.message) {
            msg = errJson.error.message;
          }
        } catch {
          const errorText = await response.text().catch(() => "");
          if (errorText) msg = errorText;
        }
        throw new Error(msg);
      }

      // Handle stream
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          setStreamingContent(accumulated);
        }

        // Finalize message once stream completes
        const assistantMsg: MessageData = {
          id: `msg-${Date.now()}`,
          conversationId: returnedConvId || currentThreadId || "default",
          role: "assistant",
          content: accumulated,
          model: modelDef.displayName,
          createdAt: new Date(),
          metadata: {
            processingTimeMs: streamStartTime ? Date.now() - streamStartTime : undefined,
          },
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setStreamingContent("");
      } else {
        const data = await response.json();
        const assistantMsg: MessageData = {
          id: `msg-${Date.now()}`,
          conversationId: returnedConvId || currentThreadId || "default",
          role: "assistant",
          content: data.content || data.message || "",
          model: modelDef.displayName,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      console.error("Chat streaming error:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to generate AI response. Please try again."
      );
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Retry previous assistant message
  const handleRetry = (messageId: string) => {
    const index = messages.findIndex((m) => m.id === messageId);
    if (index === -1) return;

    let lastUserMessage = "";
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserMessage = messages[i].content;
        break;
      }
    }

    if (lastUserMessage) {
      setMessages((prev) => prev.slice(0, index));
      handleSendMessage(lastUserMessage);
    }
  };

  const handleCitationClick = (citation: Citation) => {
    if (citation.documentId) {
      router.push(`/documents/${citation.documentId}`);
    } else if (onViewArtifact) {
      onViewArtifact(citation.documentName);
    }
  };

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden bg-background",
        className
      )}
    >
      {/* Top Header Bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/70 bg-card/50 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="size-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground leading-none">
              {conversationTitle}
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Powered by {modelDef.displayName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <ModelSelector
            selectedModelId={selectedModelId}
            onSelectModel={setSelectedModelId}
            size="sm"
            showQuickToggle={true}
          />

          {messages.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setShowClearDialog(true)}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Clear conversation"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-8"
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-5">
          {/* Empty Conversation Welcome */}
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3 shadow-xs">
                <Sparkles className="size-6" />
              </div>
              <h2 className="text-lg font-bold font-heading text-foreground">
                Ask anything about your documents
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mt-1 mb-4 leading-relaxed">
                Attach files below using the paperclip or drag-and-drop to extract financial tables, synthesize executive summaries, or draft reports.
              </p>
            </div>
          )}

          {/* Render Message List */}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onRetry={handleRetry}
              onCitationClick={handleCitationClick}
              onViewArtifact={onViewArtifact}
            />
          ))}

          {/* Render Active Streaming Content */}
          {isStreaming && (
            <div className="flex flex-col gap-2 py-3">
              <StreamingIndicator
                modelName={modelDef.displayName}
                provider={modelDef.provider}
                startTime={streamStartTime}
                onStop={handleStopStream}
              />

              {streamingContent && (
                <MessageBubble
                  message={{
                    id: "streaming-in-progress",
                    conversationId: conversationId || "default",
                    role: "assistant",
                    content: streamingContent,
                    model: modelDef.displayName,
                    createdAt: new Date(),
                  }}
                  isStreaming={true}
                  onCitationClick={handleCitationClick}
                  onViewArtifact={onViewArtifact}
                />
              )}
            </div>
          )}

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="my-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setErrorMessage(null)}
                className="h-6"
              >
                Dismiss
              </Button>
            </div>
          )}

          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Scroll to bottom floating button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-32 right-8 flex size-9 items-center justify-center rounded-full border border-border bg-card shadow-lg transition-transform hover:scale-105 hover:bg-muted active:scale-95"
          title="Scroll to latest messages"
        >
          <ArrowDown className="size-4 text-foreground" />
        </button>
      )}

      {/* Bottom Area: Context Bar + Chat Input */}
      <div className="border-t border-border/80 bg-background/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-2.5">
          {/* Document Context Bar (shows active session documents) */}
          <ContextBar
            documents={contextDocuments}
            availableDocuments={allAvailableDocs}
            onRemoveDocument={handleRemoveDocument}
            onAddDocuments={handleAddDocuments}
            maxContextTokens={modelDef.contextWindow}
          />

          {/* Chat Input with In-Composer Attachments */}
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSendMessage}
            attachments={composerAttachments}
            onAddFiles={handleAddFiles}
            onRemoveAttachment={handleRemoveAttachment}
            isLoading={isStreaming}
            onStop={handleStopStream}
            selectedModelId={selectedModelId}
            onSelectModel={setSelectedModelId}
            isConversationEmpty={messages.length === 0}
          />
        </div>
      </div>

      {/* Clear Conversation Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear Conversation?</DialogTitle>
            <DialogDescription>
              This will clear the current message thread and reset the context.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowClearDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmClear}
            >
              Clear Messages
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
