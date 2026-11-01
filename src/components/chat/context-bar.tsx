"use client";

import * as React from "react";
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  Image as ImageIcon,
  Plus,
  X,
  Sparkles,
  AlertTriangle,
  Search,
  Check,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface ContextDocument {
  id: string;
  name: string;
  mimeType?: string;
  tokenCount?: number;
  sizeBytes?: number;
  pageCount?: number;
}

export interface ContextBarProps {
  documents: ContextDocument[];
  availableDocuments?: ContextDocument[];
  onRemoveDocument: (documentId: string) => void;
  onAddDocuments?: (documents: ContextDocument[]) => void;
  onOpenDocumentPicker?: () => void;
  maxContextTokens?: number;
  estimatedTokens?: number;
  className?: string;
}

/**
 * Returns an appropriate Lucide icon and color scheme based on MIME type or file extension.
 */
function getDocumentIcon(mimeType?: string, fileName?: string) {
  const ext = fileName?.split(".").pop()?.toLowerCase() || "";
  const mime = mimeType?.toLowerCase() || "";

  if (mime.includes("pdf") || ext === "pdf") {
    return {
      icon: FileText,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-500/10 border-rose-500/20",
    };
  }
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime.includes("csv") ||
    ext === "xlsx" ||
    ext === "xls" ||
    ext === "csv"
  ) {
    return {
      icon: FileSpreadsheet,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    };
  }
  if (
    mime.includes("word") ||
    mime.includes("document") ||
    ext === "docx" ||
    ext === "doc"
  ) {
    return {
      icon: FileText,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    };
  }
  if (
    mime.includes("code") ||
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    mime.includes("json") ||
    ["ts", "tsx", "js", "jsx", "json", "py", "html", "css"].includes(ext)
  ) {
    return {
      icon: FileCode,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    };
  }
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext)) {
    return {
      icon: ImageIcon,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20",
    };
  }

  return {
    icon: File,
    color: "text-muted-foreground",
    bg: "bg-muted border-border",
  };
}

/**
 * Format token count with comma or K/M abbreviations.
 */
function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`;
  }
  return tokens.toLocaleString();
}

/**
 * ContextBar component displaying documents attached to the active AI session,
 * token utilization meter, warning indicator, and document selector modal.
 */
export function ContextBar({
  documents = [],
  availableDocuments = [],
  onRemoveDocument,
  onAddDocuments,
  onOpenDocumentPicker,
  maxContextTokens = 1_048_576, // Default Gemini 2.5 Flash / Pro limit
  estimatedTokens,
  className,
}: ContextBarProps) {
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedDocIds, setSelectedDocIds] = React.useState<Set<string>>(
    new Set()
  );

  // Compute total tokens: sum of document tokenCounts or provided estimate
  const totalTokens = React.useMemo(() => {
    if (typeof estimatedTokens === "number") return estimatedTokens;
    return documents.reduce((acc, doc) => acc + (doc.tokenCount || 1200), 0);
  }, [documents, estimatedTokens]);

  const tokenUsagePercent = Math.min(
    100,
    Math.round((totalTokens / maxContextTokens) * 100)
  );
  const isApproachingLimit = tokenUsagePercent >= 80;
  const isNearLimit = tokenUsagePercent >= 95;

  const handleOpenPicker = () => {
    if (onOpenDocumentPicker) {
      onOpenDocumentPicker();
    } else {
      setSelectedDocIds(new Set(documents.map((d) => d.id)));
      setIsPickerOpen(true);
    }
  };

  const filteredAvailableDocs = React.useMemo(() => {
    if (!searchQuery.trim()) return availableDocuments;
    const query = searchQuery.toLowerCase();
    return availableDocuments.filter((doc) =>
      doc.name.toLowerCase().includes(query)
    );
  }, [availableDocuments, searchQuery]);

  const toggleSelectDoc = (docId: string) => {
    const next = new Set(selectedDocIds);
    if (next.has(docId)) {
      next.delete(docId);
    } else {
      next.add(docId);
    }
    setSelectedDocIds(next);
  };

  const handleConfirmPicker = () => {
    if (onAddDocuments) {
      const selectedDocs = availableDocuments.filter((d) =>
        selectedDocIds.has(d.id)
      );
      onAddDocuments(selectedDocs);
    }
    setIsPickerOpen(false);
  };

  if (documents.length === 0 && !onAddDocuments && !onOpenDocumentPicker) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border/70 bg-card/70 p-2.5 backdrop-blur-xs transition-colors",
        isApproachingLimit && "border-amber-500/40 bg-amber-500/5",
        isNearLimit && "border-rose-500/40 bg-rose-500/5",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Context Summary Label & Add Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            <span>AI Context ({documents.length})</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleOpenPicker}
            className="h-6 gap-1 rounded-md border-dashed text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="size-3" />
            Add documents
          </Button>
        </div>

        {/* Right: Token Usage & Warning Indicator */}
        <div className="flex items-center gap-2">
          {isApproachingLimit && (
            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                isNearLimit
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 animate-pulse"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              )}
              title={`${tokenUsagePercent}% of context limit used`}
            >
              <AlertTriangle className="size-3 shrink-0" />
              <span>
                {isNearLimit
                  ? "Context near limit!"
                  : `Context limit: ${tokenUsagePercent}%`}
              </span>
            </div>
          )}

          <Badge
            variant="secondary"
            className={cn(
              "h-5 gap-1 font-mono text-[11px] font-normal tracking-tight",
              isApproachingLimit &&
                "bg-amber-500/10 text-amber-700 dark:text-amber-300",
              isNearLimit && "bg-rose-500/10 text-rose-700 dark:text-rose-300"
            )}
          >
            <span className="font-semibold">{formatTokenCount(totalTokens)}</span>
            <span className="text-muted-foreground">
              / {formatTokenCount(maxContextTokens)} tokens
            </span>
          </Badge>
        </div>
      </div>

      {/* Selected Document Chips */}
      {documents.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {documents.map((doc) => {
            const { icon: DocIcon, color, bg } = getDocumentIcon(
              doc.mimeType,
              doc.name
            );

            return (
              <div
                key={doc.id}
                className={cn(
                  "group inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium shadow-2xs transition-all",
                  bg,
                  "hover:border-primary/40 hover:bg-card"
                )}
                title={`${doc.name} (${doc.tokenCount ? formatTokenCount(doc.tokenCount) + " tokens" : "context active"})`}
              >
                <DocIcon className={cn("size-3.5 shrink-0", color)} />
                <span className="max-w-[140px] truncate text-foreground sm:max-w-[200px]">
                  {doc.name}
                </span>

                {doc.tokenCount ? (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    ~{formatTokenCount(doc.tokenCount)}
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={() => onRemoveDocument(doc.id)}
                  className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label={`Remove ${doc.name} from context`}
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Document Picker Dialog */}
      <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="size-5 text-primary" />
              Add Documents to AI Context
            </DialogTitle>
            <DialogDescription>
              Select workspace documents to ground the AI with exact citations
              and reference data.
            </DialogDescription>
          </DialogHeader>

          {/* Search bar */}
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filter workspace documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          {/* Document list */}
          <ScrollArea className="mt-3 h-64 rounded-lg border border-border/60 bg-muted/20 p-2">
            {filteredAvailableDocs.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center text-sm text-muted-foreground">
                <File className="mb-2 size-8 text-muted-foreground/40" />
                <p>No documents found</p>
                {searchQuery && (
                  <p className="text-xs">Try a different search term</p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredAvailableDocs.map((doc) => {
                  const isSelected = selectedDocIds.has(doc.id);
                  const { icon: DocIcon, color } = getDocumentIcon(
                    doc.mimeType,
                    doc.name
                  );

                  return (
                    <div
                      key={doc.id}
                      onClick={() => toggleSelectDoc(doc.id)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-md p-2 text-sm transition-colors",
                        isSelected
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <DocIcon className={cn("size-4 shrink-0", color)} />
                        <div className="truncate">
                          <p className="truncate text-xs font-medium sm:text-sm">
                            {doc.name}
                          </p>
                          {doc.pageCount ? (
                            <p className="text-[11px] text-muted-foreground">
                              {doc.pageCount} pages •{" "}
                              {doc.tokenCount
                                ? `~${formatTokenCount(doc.tokenCount)} tokens`
                                : "ready"}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {isSelected && <Check className="size-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {selectedDocIds.size} document
              {selectedDocIds.size === 1 ? "" : "s"} selected
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPickerOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmPicker}
              >
                Apply Context
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
