"use client";

import * as React from "react";
import {
  X,
  Download,
  Copy,
  Check,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileEdit,
  ExternalLink,
  Search,
  HardDrive,
  Calendar,
  Sparkles,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getArtifactTypeConfig,
  formatBytes,
  formatArtifactDate,
} from "@/components/artifacts/artifact-card";
import { cn } from "@/lib/utils";
import type { ArtifactData } from "@/types/artifacts";

export interface ArtifactViewerProps {
  artifact: ArtifactData | null;
  isOpen: boolean;
  onClose: () => void;
  content?: string;
  onDownload?: (artifact: ArtifactData) => void;
}

/**
 * Parses raw CSV or tabular text into rows & columns for spreadsheet preview.
 */
function parseSpreadsheetData(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.trim().split("\n");
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string) => {
    // Basic comma/tab separator handling
    const delimiter = line.includes("\t") ? "\t" : ",";
    return line.split(delimiter).map((c) => c.replace(/^["']|["']$/g, "").trim());
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

/**
 * ArtifactViewer renders a modal dialog for inspecting generated documents,
 * spreadsheets, markdown, or code artifacts with formatted preview and download controls.
 */
export function ArtifactViewer({
  artifact,
  isOpen,
  onClose,
  content: initialContent,
  onDownload,
}: ArtifactViewerProps) {
  const [copied, setCopied] = React.useState(false);
  const [tableSearch, setTableSearch] = React.useState("");
  const [isFullScreen, setIsFullScreen] = React.useState(false);
  const [fetchedContent, setFetchedContent] = React.useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = React.useState(false);

  // Fetch content if downloadUrl is provided and initialContent is empty
  React.useEffect(() => {
    if (!artifact || initialContent) return;

    let isMounted = true;
    if (artifact.downloadUrl) {
      queueMicrotask(() => {
        if (isMounted) setIsLoadingContent(true);
      });
      fetch(artifact.downloadUrl)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch artifact preview");
          return res.text();
        })
        .then((text) => {
          if (isMounted) setFetchedContent(text);
        })
        .catch(() => {
          // If fetching fails or format is binary, fallback to metadata or placeholder
          if (isMounted) setFetchedContent(null);
        })
        .finally(() => {
          if (isMounted) setIsLoadingContent(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [artifact, initialContent]);

  if (!artifact) return null;

  const content = initialContent || fetchedContent || "";
  const config = getArtifactTypeConfig(artifact.type, artifact.mimeType, artifact.name);
  const TypeIcon = config.icon;

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload(artifact);
    } else if (artifact.downloadUrl) {
      window.open(artifact.downloadUrl, "_blank");
    } else if (content) {
      const blob = new Blob([content], { type: artifact.mimeType || "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = artifact.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Render preview content based on artifact type
  const renderContentPreview = () => {
    if (isLoadingContent) {
      return (
        <div className="flex h-96 flex-col items-center justify-center gap-2 text-muted-foreground">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs">Loading artifact preview...</p>
        </div>
      );
    }

    // SPREADSHEET (CSV / Table)
    if (artifact.type === "SPREADSHEET" || artifact.name.endsWith(".csv")) {
      const { headers, rows } = parseSpreadsheetData(content);
      const filteredRows = tableSearch.trim()
        ? rows.filter((r) =>
            r.some((cell) => cell.toLowerCase().includes(tableSearch.toLowerCase()))
          )
        : rows;

      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search rows in spreadsheet..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {filteredRows.length} rows {headers.length > 0 && `• ${headers.length} columns`}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
            {headers.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/80 bg-muted/60">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="px-3.5 py-2.5 font-semibold text-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {filteredRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="transition-colors hover:bg-muted/40 odd:bg-card even:bg-muted/10"
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3.5 py-2 text-muted-foreground">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No tabular preview available for this spreadsheet. Click download to open in Excel.
              </div>
            )}
          </div>
        </div>
      );
    }

    // CODE / JSON
    if (artifact.type === "CODE" || artifact.name.endsWith(".json")) {
      return (
        <div className="relative overflow-hidden rounded-xl border border-border/80 bg-zinc-950 font-mono text-xs text-zinc-100 shadow-inner">
          <pre className="max-h-[500px] overflow-auto p-4 leading-relaxed">
            <code>{content || "// No code content available"}</code>
          </pre>
        </div>
      );
    }

    // MARKDOWN OR PLAIN DOCUMENT
    if (artifact.type === "MARKDOWN" || content) {
      return (
        <div className="rounded-xl border border-border/70 bg-card/60 p-5 text-sm leading-relaxed text-foreground shadow-inner">
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-sans">
            {content || "No text content available to preview."}
          </div>
        </div>
      );
    }

    // Fallback binary card (e.g. DOCX / PDF without text stream)
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center">
        <div className={cn("mb-3 flex size-12 items-center justify-center rounded-2xl", config.bgColor)}>
          <TypeIcon className={cn("size-6", config.color)} />
        </div>
        <h4 className="font-heading text-sm font-semibold text-foreground">
          Binary Document Preview
        </h4>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          This {config.label} is formatted for native editing and printing.
          Download the file to view it in full resolution.
        </p>
        <Button
          type="button"
          onClick={handleDownload}
          size="sm"
          className="mt-4 gap-1.5 shadow-xs"
        >
          <Download className="size-3.5" />
          Download {config.ext}
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "flex flex-col gap-4 p-0 shadow-2xl backdrop-blur-md transition-all duration-200",
          isFullScreen
            ? "max-w-[95vw] h-[92vh] sm:max-w-[95vw]"
            : "max-w-3xl sm:max-w-4xl max-h-[85vh]"
        )}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                config.bgColor
              )}
            >
              <TypeIcon className={cn("size-5", config.color)} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="truncate font-heading text-base font-semibold text-foreground">
                  {artifact.name}
                </DialogTitle>
                <Badge variant="outline" className={cn("h-5 text-[10px]", config.badgeColor)}>
                  {config.ext}
                </Badge>
              </div>

              <div className="flex items-center gap-3 pt-0.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {formatArtifactDate(artifact.createdAt)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <HardDrive className="size-3" />
                  {formatBytes(artifact.sizeBytes)}
                </span>
                {artifact.metadata?.generationModel && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-medium text-foreground/80">
                      <Sparkles className="size-3 text-primary" />
                      {artifact.metadata.generationModel}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons (Copy, Fullscreen, Download, Close) */}
          <div className="flex items-center gap-1.5">
            {content && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleCopy}
                className="h-8 gap-1.5 text-xs"
                title="Copy raw content"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-emerald-500" />
                    <span className="text-emerald-500">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="h-8 w-8 p-0"
              title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullScreen ? (
                <Minimize2 className="size-3.5" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
            </Button>

            <Button
              type="button"
              size="xs"
              onClick={handleDownload}
              className="h-8 gap-1.5 text-xs shadow-xs"
            >
              <Download className="size-3.5" />
              <span>Download</span>
            </Button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <ScrollArea className="flex-1 px-6 pb-6 pt-2">
          {renderContentPreview()}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
