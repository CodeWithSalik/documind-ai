"use client";

import * as React from "react";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  FileCode,
  File,
  Download,
  Copy,
  Check,
  Search,
  Layers,
  Info,
  Eye,
  Sparkles,
  MessageSquareX,
  Calendar,
  X,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  DocumentData,
  DocumentChunkData,
  SupportedMimeType,
} from "@/types/documents";

export interface DocumentViewerProps {
  document: DocumentData | null;
  isOpen?: boolean;
  onClose?: () => void;
  chunks?: DocumentChunkData[];
  extractedText?: string;
  downloadUrl?: string;
  onDownload?: (document: DocumentData) => void;
  onToggleChatContext?: (documentId: string, inContext: boolean) => void;
  isInChatContext?: boolean;
  className?: string;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMimeIcon(mimeType: SupportedMimeType | string) {
  if (mimeType === "application/pdf") {
    return <FileText className="size-5 text-red-500" />;
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return <FileText className="size-5 text-blue-500" />;
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "text/csv"
  ) {
    return <FileSpreadsheet className="size-5 text-emerald-500" />;
  }
  if (mimeType.startsWith("image/")) {
    return <FileImage className="size-5 text-purple-500" />;
  }
  if (
    mimeType === "text/markdown" ||
    mimeType === "text/plain" ||
    mimeType === "text/html" ||
    mimeType === "application/json"
  ) {
    return <FileCode className="size-5 text-amber-500" />;
  }
  return <File className="size-5 text-muted-foreground" />;
}

export function DocumentViewer({
  document,
  isOpen = true,
  onClose,
  chunks = [],
  extractedText = "",
  downloadUrl,
  onDownload,
  onToggleChatContext,
  isInChatContext = false,
  className,
}: DocumentViewerProps) {
  const [copied, setCopied] = React.useState(false);
  const [chunkCopiedIndex, setChunkCopiedIndex] = React.useState<number | null>(null);
  const [chunkSearch, setChunkSearch] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<string>("text");

  if (!document) {
    return null;
  }

  const handleCopyText = async () => {
    if (!extractedText) return;
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyChunk = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setChunkCopiedIndex(index);
      setTimeout(() => setChunkCopiedIndex(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadOriginal = () => {
    if (onDownload) {
      onDownload(document);
    } else if (downloadUrl) {
      const a = window.document.createElement("a");
      a.href = downloadUrl;
      a.download = document.name;
      a.target = "_blank";
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
    }
  };

  const filteredChunks = chunks.filter((c) =>
    chunkSearch
      ? c.content.toLowerCase().includes(chunkSearch.toLowerCase())
      : true
  );

  const canEmbedRaw =
    Boolean(downloadUrl) &&
    (document.mimeType === "application/pdf" ||
      document.mimeType.startsWith("image/") ||
      document.mimeType === "text/html");

  const viewerContent = (
    <div className={cn("flex flex-col h-full max-h-[85vh] text-left", className)}>
      {/* Viewer Header */}
      <div className="flex flex-col gap-3 border-b border-border/80 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 border border-border">
              {getMimeIcon(document.mimeType)}
            </div>
            <div className="min-w-0">
              <h2
                className="truncate font-heading text-base font-semibold text-foreground"
                title={document.name}
              >
                {document.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{formatBytes(document.sizeBytes)}</span>
                {document.pageCount && (
                  <>
                    <span>•</span>
                    <span>
                      {document.pageCount}{" "}
                      {document.pageCount === 1 ? "page" : "pages"}
                    </span>
                  </>
                )}
                {document.wordCount && (
                  <>
                    <span>•</span>
                    <span>{document.wordCount.toLocaleString()} words</span>
                  </>
                )}
                <span>•</span>
                <span className="capitalize">{document.status.toLowerCase()}</span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleChatContext && (
              <Button
                variant={isInChatContext ? "secondary" : "outline"}
                size="xs"
                onClick={() => onToggleChatContext(document.id, !isInChatContext)}
                className="gap-1.5"
              >
                {isInChatContext ? (
                  <>
                    <MessageSquareX className="size-3.5 text-amber-500" />
                    <span>In Chat</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5 text-primary" />
                    <span>Add to Chat</span>
                  </>
                )}
              </Button>
            )}

            {(downloadUrl || onDownload) && (
              <Button
                variant="outline"
                size="xs"
                onClick={handleDownloadOriginal}
                className="gap-1.5"
                title="Download original document"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            )}

            {extractedText && (
              <Button
                variant="outline"
                size="xs"
                onClick={handleCopyText}
                className="gap-1.5"
                title="Copy all extracted text"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span>Copy Text</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0 pt-3"
      >
        <TabsList className="mb-3 w-fit">
          <TabsTrigger value="text" className="gap-1.5 text-xs">
            <FileText className="size-3.5" />
            Extracted Text
          </TabsTrigger>
          <TabsTrigger value="chunks" className="gap-1.5 text-xs">
            <Layers className="size-3.5" />
            Chunks ({chunks.length})
          </TabsTrigger>
          {canEmbedRaw && (
            <TabsTrigger value="preview" className="gap-1.5 text-xs">
              <Eye className="size-3.5" />
              Preview Frame
            </TabsTrigger>
          )}
          <TabsTrigger value="metadata" className="gap-1.5 text-xs">
            <Info className="size-3.5" />
            Metadata
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Extracted Text Content */}
        <TabsContent value="text" className="flex-1 min-h-0 mt-0">
          <div className="flex flex-col h-full rounded-xl border border-border/80 bg-muted/20">
            <ScrollArea className="flex-1 p-4">
              {extractedText ? (
                <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-mono text-foreground/90 select-text">
                  {extractedText}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <FileText className="size-8 stroke-[1.5] text-muted-foreground/60" />
                  <p className="mt-2 text-xs">No extracted text available</p>
                  {document.status === "PROCESSING" && (
                    <p className="text-[11px] text-blue-500">
                      Document extraction is currently in progress...
                    </p>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </TabsContent>

        {/* Tab 2: Paginated RAG Chunks Viewer */}
        <TabsContent value="chunks" className="flex-1 min-h-0 mt-0">
          <div className="flex flex-col h-full space-y-3">
            {/* Search chunks */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={chunkSearch}
                onChange={(e) => setChunkSearch(e.target.value)}
                placeholder="Search extracted chunks..."
                className="h-8 pl-8 text-xs"
              />
            </div>

            <ScrollArea className="flex-1 pr-2">
              {filteredChunks.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredChunks.map((chunk, idx) => (
                    <div
                      key={chunk.id || idx}
                      className="rounded-lg border border-border/80 bg-card p-3 text-xs transition-colors hover:border-primary/30"
                    >
                      <div className="mb-2 flex items-center justify-between border-b border-border/50 pb-1.5">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="font-mono text-[10px]"
                          >
                            Chunk #{chunk.index + 1}
                          </Badge>
                          {chunk.pageNumber && (
                            <span className="text-[11px] text-muted-foreground">
                              Page {chunk.pageNumber}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground/70">
                            ~{Math.round(chunk.content.length / 4)} tokens
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleCopyChunk(chunk.content, idx)}
                          title="Copy chunk text"
                        >
                          {chunkCopiedIndex === idx ? (
                            <Check className="size-3 text-emerald-500" />
                          ) : (
                            <Copy className="size-3 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                      <p className="whitespace-pre-wrap font-sans text-xs text-foreground/90 leading-relaxed select-text">
                        {chunk.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Layers className="size-8 stroke-[1.5] text-muted-foreground/60" />
                  <p className="mt-2 text-xs">
                    {chunkSearch
                      ? "No chunks matched your search"
                      : "No chunks generated yet for this document"}
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        </TabsContent>

        {/* Tab 3: Raw Preview Frame (PDF / Image / HTML) */}
        {canEmbedRaw && (
          <TabsContent value="preview" className="flex-1 min-h-0 mt-0">
            <div className="h-full min-h-[450px] overflow-hidden rounded-xl border border-border bg-muted/30">
              {document.mimeType === "application/pdf" ? (
                <iframe
                  src={downloadUrl}
                  title="PDF Document Preview"
                  className="size-full min-h-[450px] border-0"
                />
              ) : document.mimeType.startsWith("image/") ? (
                <div className="flex size-full items-center justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={downloadUrl}
                    alt={document.name}
                    className="max-h-full max-w-full rounded-lg object-contain shadow-xs"
                  />
                </div>
              ) : (
                <iframe
                  src={downloadUrl}
                  sandbox="allow-same-origin"
                  title="Document Preview"
                  className="size-full min-h-[450px] border-0"
                />
              )}
            </div>
          </TabsContent>
        )}

        {/* Tab 4: Metadata Viewer */}
        <TabsContent value="metadata" className="flex-1 min-h-0 mt-0">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="divide-y divide-border/60 text-xs">
              <div className="grid grid-cols-3 px-4 py-2.5">
                <span className="font-medium text-muted-foreground">Document ID</span>
                <span className="col-span-2 font-mono text-[11px] text-foreground select-all">
                  {document.id}
                </span>
              </div>
              <div className="grid grid-cols-3 px-4 py-2.5">
                <span className="font-medium text-muted-foreground">MIME Type</span>
                <span className="col-span-2 font-mono text-[11px] text-foreground">
                  {document.mimeType}
                </span>
              </div>
              <div className="grid grid-cols-3 px-4 py-2.5">
                <span className="font-medium text-muted-foreground">File Size</span>
                <span className="col-span-2 text-foreground">
                  {formatBytes(document.sizeBytes)} ({document.sizeBytes.toLocaleString()} bytes)
                </span>
              </div>
              <div className="grid grid-cols-3 px-4 py-2.5">
                <span className="font-medium text-muted-foreground">Pages</span>
                <span className="col-span-2 text-foreground">
                  {document.pageCount ?? "N/A"}
                </span>
              </div>
              <div className="grid grid-cols-3 px-4 py-2.5">
                <span className="font-medium text-muted-foreground">Word Count</span>
                <span className="col-span-2 text-foreground">
                  {document.wordCount ? document.wordCount.toLocaleString() : "N/A"}
                </span>
              </div>
              <div className="grid grid-cols-3 px-4 py-2.5">
                <span className="font-medium text-muted-foreground">Storage Key</span>
                <span className="col-span-2 font-mono text-[11px] text-muted-foreground truncate select-all">
                  {document.storageKey}
                </span>
              </div>
              <div className="grid grid-cols-3 px-4 py-2.5">
                <span className="font-medium text-muted-foreground">Created At</span>
                <span className="col-span-2 text-foreground">
                  {formatDate(document.createdAt)}
                </span>
              </div>
              <div className="grid grid-cols-3 px-4 py-2.5">
                <span className="font-medium text-muted-foreground">Last Updated</span>
                <span className="col-span-2 text-foreground">
                  {formatDate(document.updatedAt)}
                </span>
              </div>
              {document.metadata && Object.keys(document.metadata).length > 0 && (
                <div className="grid grid-cols-3 px-4 py-2.5">
                  <span className="font-medium text-muted-foreground">
                    Additional Metadata
                  </span>
                  <div className="col-span-2 space-y-1 font-mono text-[11px]">
                    {Object.entries(document.metadata).map(([key, val]) => (
                      <div key={key} className="truncate">
                        <span className="text-muted-foreground">{key}: </span>
                        <span>{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  // If used in a modal / dialog context with onClose
  if (onClose) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl sm:max-w-4xl h-[90vh] flex flex-col p-6">
          <DialogHeader className="sr-only">
            <DialogTitle>{document.name}</DialogTitle>
          </DialogHeader>
          {viewerContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Standalone inline rendering
  return viewerContent;
}
