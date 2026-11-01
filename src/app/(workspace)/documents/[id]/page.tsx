"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  FileImage,
  ArrowLeft,
  MessageSquare,
  Download,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Search,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "@/components/shared/toast-provider";

interface ChunkItem {
  id: string;
  index: number;
  content: string;
  pageNumber: number | null;
  metadata?: { tokenCount?: number };
}

interface DocumentDetail {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  status: "PENDING" | "PROCESSING" | "READY" | "ERROR";
  pageCount: number | null;
  wordCount: number | null;
  errorMessage?: string | null;
  createdAt: string;
  processedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  chunks: ChunkItem[];
  uploadedBy?: {
    id: string;
    name?: string | null;
    email: string;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getDocIcon(mime: string) {
  if (mime === "application/pdf") {
    return <FileText className="size-7 text-red-500" />;
  }
  if (mime.includes("spreadsheet") || mime === "text/csv") {
    return <FileSpreadsheet className="size-7 text-emerald-500" />;
  }
  if (mime.includes("wordprocessing")) {
    return <FileText className="size-7 text-blue-500" />;
  }
  if (mime.startsWith("image/")) {
    return <FileImage className="size-7 text-purple-500" />;
  }
  return <FileCode className="size-7 text-amber-500" />;
}

function DocumentDetailPageInner() {
  const router = useRouter();
  const params = useParams();
  const docId = (params?.id as string) || "";

  const { addContextDocument } = useWorkspaceStore();
  const [doc, setDoc] = React.useState<DocumentDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [activeTab, setActiveTab] = React.useState<"content" | "chunks" | "metadata">("content");
  const [copiedChunkId, setCopiedChunkId] = React.useState<string | null>(null);
  const [searchChunkQuery, setSearchChunkQuery] = React.useState("");

  React.useEffect(() => {
    if (!docId) return;

    let isMounted = true;
    async function loadDoc() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`);
        if (!res.ok) {
          throw new Error(`Failed to load document (${res.status} ${res.statusText})`);
        }
        const json = await res.json();
        if (json.success && json.data && isMounted) {
          setDoc(json.data);
        } else {
          throw new Error(json.error?.message || "Document not found");
        }
      } catch (err) {
        if (isMounted) {
          setLoadError(err instanceof Error ? err.message : "Failed to load document details");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDoc();
    return () => {
      isMounted = false;
    };
  }, [docId]);

  const handleOpenInChat = () => {
    if (!doc) return;
    addContextDocument(doc.id);
    toast.success("Document added to chat context", {
      description: `Starting conversation with ${doc.name}`,
    });
    router.push("/chat");
  };

  const handleCopyChunk = (chunkId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChunkId(chunkId);
    toast.info("Chunk copied to clipboard");
    setTimeout(() => setCopiedChunkId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-xs text-muted-foreground space-y-3">
        <Loader2 className="size-6 text-primary animate-spin" />
        <span>Loading document details and vector chunks...</span>
      </div>
    );
  }

  if (loadError || !doc) {
    return (
      <div className="p-6 max-w-2xl mx-auto my-12 rounded-2xl border border-destructive/30 bg-destructive/5 text-center space-y-4">
        <AlertCircle className="size-10 text-destructive mx-auto" />
        <h2 className="text-lg font-bold text-foreground">Document Not Found</h2>
        <p className="text-xs text-muted-foreground">{loadError || "The requested document could not be retrieved."}</p>
        <Link href="/documents">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="size-4" />
            Back to Document Library
          </Button>
        </Link>
      </div>
    );
  }

  const chunks = doc.chunks || [];
  const filteredChunks = chunks.filter((c) =>
    c.content.toLowerCase().includes(searchChunkQuery.toLowerCase())
  );

  const fullContent = chunks.map((c) => c.content).join("\n\n");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Breadcrumb customTitle={doc.name} />
        <Link href="/documents">
          <Button variant="ghost" size="xs" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" />
            Back to Documents
          </Button>
        </Link>
      </div>

      {/* Document Header Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
              {getDocIcon(doc.mimeType)}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold font-heading text-foreground">
                  {doc.name}
                </h1>
                <Badge
                  variant={doc.status === "READY" ? "secondary" : doc.status === "ERROR" ? "destructive" : "default"}
                  className="flex items-center gap-1 text-xs"
                >
                  {doc.status === "READY" ? (
                    <>
                      <CheckCircle2 className="size-3 text-emerald-500" />
                      Ready
                    </>
                  ) : doc.status === "ERROR" ? (
                    <>
                      <AlertCircle className="size-3" />
                      Failed
                    </>
                  ) : (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      {doc.status}
                    </>
                  )}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>{formatBytes(doc.sizeBytes)}</span>
                {doc.pageCount && <span>• {doc.pageCount} pages</span>}
                {doc.wordCount && <span>• {doc.wordCount.toLocaleString()} words</span>}
                <span>• {chunks.length} chunks</span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {new Date(doc.createdAt).toLocaleDateString()}
                </span>
              </div>
              {doc.errorMessage && (
                <p className="text-xs text-destructive font-medium mt-1">
                  Error: {doc.errorMessage}
                </p>
              )}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5">
            <Button
              onClick={handleOpenInChat}
              disabled={doc.status !== "READY"}
              className="gap-2 shadow-xs bg-primary text-primary-foreground font-semibold"
            >
              <MessageSquare className="size-4" />
              Open in Chat
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open(`/api/documents/${doc.id}/download`, "_blank");
                toast.success("Download started", { description: doc.name });
              }}
              className="gap-1.5 border-border/80"
            >
              <Download className="size-4" />
              Download
            </Button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-border/60 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("content")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "content"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Extracted Content Preview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("chunks")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "chunks"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Vector Chunks
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {chunks.length}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("metadata")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "metadata"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Document Metadata
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs min-h-[400px]">
        {activeTab === "content" && (
          <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Full Document Text Stream
              </span>
              <span className="text-xs text-muted-foreground">
                Total Words: {doc.wordCount?.toLocaleString() || fullContent.split(/\s+/).filter(Boolean).length.toLocaleString()}
              </span>
            </div>

            {fullContent.trim() ? (
              <div className="prose dark:prose-invert max-w-none text-sm space-y-4 leading-relaxed font-sans whitespace-pre-wrap">
                {fullContent}
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-muted-foreground">
                No extracted text available for this document.
              </div>
            )}
          </div>
        )}

        {activeTab === "chunks" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchChunkQuery}
                  onChange={(e) => setSearchChunkQuery(e.target.value)}
                  placeholder="Filter chunks..."
                  className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1 text-xs outline-none focus:border-primary"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {chunks.length} chunks persisted with page references
              </span>
            </div>

            {filteredChunks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                {searchChunkQuery ? `No chunks matching "${searchChunkQuery}"` : "No chunks available"}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredChunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2.5 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          Chunk #{chunk.index}
                        </Badge>
                        {chunk.pageNumber && (
                          <span className="text-muted-foreground">Page {chunk.pageNumber}</span>
                        )}
                        {chunk.metadata?.tokenCount && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <span className="font-mono text-[11px] text-primary">
                              {chunk.metadata.tokenCount} tokens
                            </span>
                          </>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleCopyChunk(chunk.id, chunk.content)}
                        title="Copy chunk text"
                      >
                        {copiedChunkId === chunk.id ? (
                          <Check className="size-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="size-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    </div>

                    <pre className="whitespace-pre-wrap font-sans text-xs text-foreground/90 leading-relaxed bg-background/60 p-3 rounded-lg border border-border/50">
                      {chunk.content}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "metadata" && (
          <div className="space-y-6 max-w-3xl">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Document Storage & Extraction Metadata</h3>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 font-mono text-xs text-muted-foreground space-y-1.5">
                <div>document_id: &quot;{doc.id}&quot;</div>
                <div>file_name: &quot;{doc.name}&quot;</div>
                <div>mime_type: &quot;{doc.mimeType}&quot;</div>
                <div>size_bytes: {doc.sizeBytes} ({formatBytes(doc.sizeBytes)})</div>
                <div>storage_key: &quot;{doc.storageKey}&quot;</div>
                <div>status: &quot;{doc.status}&quot;</div>
                <div>page_count: {doc.pageCount ?? "N/A"}</div>
                <div>word_count: {doc.wordCount ?? "N/A"}</div>
                <div>created_at: &quot;{doc.createdAt}&quot;</div>
                <div>processed_at: &quot;{doc.processedAt || "N/A"}&quot;</div>
                <div>uploader: &quot;{doc.uploadedBy?.email || "N/A"}&quot;</div>
              </div>
            </div>

            {doc.metadata && Object.keys(doc.metadata).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Extracted Properties</h3>
                <pre className="rounded-xl border border-border/70 bg-muted/20 p-4 font-mono text-xs text-muted-foreground overflow-x-auto">
                  {JSON.stringify(doc.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DocumentDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground animate-pulse p-10">
          <FileText className="size-4 text-primary mr-2" />
          <span>Loading document details...</span>
        </div>
      }
    >
      <DocumentDetailPageInner />
    </React.Suspense>
  );
}
