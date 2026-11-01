"use client";

import * as React from "react";
import {
  Search,
  Grid,
  List,
  Sparkles,
  Trash2,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  Filter,
  Check,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileCode,
  File,
  Loader2,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  MessageSquareX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { DocumentCard } from "@/components/documents/document-card";
import { DocumentActions } from "@/components/documents/document-actions";
import type { DocumentData, DocumentStatus, SupportedMimeType } from "@/types/documents";

export interface DocumentGridProps {
  documents: DocumentData[];
  selectedIds?: string[];
  chatContextIds?: string[];
  onSelect?: (documentId: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  onToggleChatContext?: (documentId: string, inContext: boolean) => void;
  onAddSelectedToChatContext?: (documentIds: string[]) => void;
  onRemoveSelectedFromChatContext?: (documentIds: string[]) => void;
  onDeleteSelected?: (documentIds: string[]) => void;
  onOpenPreview?: (document: DocumentData) => void;
  onDelete?: (documentId: string) => void;
  onRename?: (documentId: string, newName: string) => void;
  onReprocess?: (documentId: string) => void;
  onConvert?: (documentId: string, targetFormat: string) => void;
  isLoading?: boolean;
  className?: string;
}

type SortOption =
  | "date-desc"
  | "date-asc"
  | "name-asc"
  | "name-desc"
  | "size-desc"
  | "size-asc";

type TypeFilterOption =
  | "ALL"
  | "PDF"
  | "WORD"
  | "SPREADSHEET"
  | "IMAGE"
  | "TEXT";

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function matchesTypeFilter(mimeType: string, filter: TypeFilterOption): boolean {
  if (filter === "ALL") return true;
  if (filter === "PDF") return mimeType === "application/pdf";
  if (filter === "WORD")
    return mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (filter === "SPREADSHEET")
    return (
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimeType === "text/csv"
    );
  if (filter === "IMAGE") return mimeType.startsWith("image/");
  if (filter === "TEXT")
    return (
      mimeType === "text/markdown" ||
      mimeType === "text/plain" ||
      mimeType === "text/html" ||
      mimeType === "application/json"
    );
  return true;
}

function getListFileIcon(mimeType: SupportedMimeType | string) {
  if (mimeType === "application/pdf") {
    return <FileText className="size-4 text-red-500" />;
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return <FileText className="size-4 text-blue-500" />;
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "text/csv"
  ) {
    return <FileSpreadsheet className="size-4 text-emerald-500" />;
  }
  if (mimeType.startsWith("image/")) {
    return <FileImage className="size-4 text-purple-500" />;
  }
  if (
    mimeType === "text/markdown" ||
    mimeType === "text/plain" ||
    mimeType === "text/html" ||
    mimeType === "application/json"
  ) {
    return <FileCode className="size-4 text-amber-500" />;
  }
  return <File className="size-4 text-muted-foreground" />;
}

export function DocumentGrid({
  documents,
  selectedIds = [],
  chatContextIds = [],
  onSelect,
  onSelectAll,
  onToggleChatContext,
  onAddSelectedToChatContext,
  onRemoveSelectedFromChatContext,
  onDeleteSelected,
  onOpenPreview,
  onDelete,
  onRename,
  onReprocess,
  onConvert,
  isLoading = false,
  className,
}: DocumentGridProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | DocumentStatus>("ALL");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilterOption>("ALL");
  const [sortBy, setSortBy] = React.useState<SortOption>("date-desc");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [isBatchDeleteDialogOpen, setIsBatchDeleteDialogOpen] = React.useState(false);

  // Filter & Sort
  const filteredDocuments = React.useMemo(() => {
    return documents
      .filter((doc) => {
        // Search Filter
        if (
          searchQuery.trim() &&
          !doc.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
        ) {
          return false;
        }

        // Status Filter
        if (statusFilter !== "ALL" && doc.status !== statusFilter) {
          return false;
        }

        // Type Filter
        if (!matchesTypeFilter(doc.mimeType, typeFilter)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "date-desc":
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          case "date-asc":
            return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          case "name-asc":
            return a.name.localeCompare(b.name);
          case "name-desc":
            return b.name.localeCompare(a.name);
          case "size-desc":
            return b.sizeBytes - a.sizeBytes;
          case "size-asc":
            return a.sizeBytes - b.sizeBytes;
          default:
            return 0;
        }
      });
  }, [documents, searchQuery, statusFilter, typeFilter, sortBy]);

  const allFilteredSelected =
    filteredDocuments.length > 0 &&
    filteredDocuments.every((d) => selectedIds.includes(d.id));

  const handleToggleSelectAll = () => {
    if (onSelectAll) {
      onSelectAll(!allFilteredSelected);
    } else if (onSelect) {
      const nextSelect = !allFilteredSelected;
      filteredDocuments.forEach((doc) => onSelect(doc.id, nextSelect));
    }
  };

  const handleBatchDelete = () => {
    onDeleteSelected?.(selectedIds);
    setIsBatchDeleteDialogOpen(false);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Controls Bar: Search, Filters, Sorters, and View Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by name..."
            className="pl-9 pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filter & View Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Filter className="size-3.5" />
                  <span>
                    Status: {statusFilter === "ALL" ? "All" : statusFilter}
                  </span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={statusFilter}
                onValueChange={(val) =>
                  setStatusFilter(val as "ALL" | DocumentStatus)
                }
              >
                <DropdownMenuRadioItem value="ALL">All Status</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="READY">Ready</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="PROCESSING">
                  Processing
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="PENDING">Pending</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="ERROR">Error</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Type Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <SlidersHorizontal className="size-3.5" />
                  <span>
                    Type: {typeFilter === "ALL" ? "All" : typeFilter}
                  </span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel>Filter by File Type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={typeFilter}
                onValueChange={(val) => setTypeFilter(val as TypeFilterOption)}
              >
                <DropdownMenuRadioItem value="ALL">All Types</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="PDF">PDF</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="WORD">Word Document</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="SPREADSHEET">
                  Spreadsheet / CSV
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="IMAGE">Image</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="TEXT">Text / Markdown</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <ArrowUpDown className="size-3.5" />
                  <span>Sort</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Sort Documents</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={sortBy}
                onValueChange={(val) => setSortBy(val as SortOption)}
              >
                <DropdownMenuRadioItem value="date-desc">
                  Date: Newest first
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="date-asc">
                  Date: Oldest first
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name-asc">
                  Name: A to Z
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name-desc">
                  Name: Z to A
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="size-desc">
                  Size: Largest first
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="size-asc">
                  Size: Smallest first
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Mode Toggle: Grid vs List */}
          <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/40">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon-xs"
              onClick={() => setViewMode("grid")}
              title="Grid view"
              className={cn(
                "size-7 rounded-md",
                viewMode === "grid" && "shadow-xs bg-background"
              )}
            >
              <Grid className="size-3.5" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon-xs"
              onClick={() => setViewMode("list")}
              title="List view"
              className={cn(
                "size-7 rounded-md",
                viewMode === "list" && "shadow-xs bg-background"
              )}
            >
              <List className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Multi-Select Floating Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-foreground shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={allFilteredSelected}
              onClick={handleToggleSelectAll}
              className={cn(
                "flex size-4.5 shrink-0 items-center justify-center rounded border transition-colors outline-none",
                allFilteredSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/30 bg-background hover:border-foreground/60"
              )}
              title={allFilteredSelected ? "Deselect all" : "Select all"}
            >
              {allFilteredSelected && <Check className="size-3 stroke-[3]" />}
            </button>
            <span className="font-semibold text-foreground">
              {selectedIds.length}{" "}
              {selectedIds.length === 1 ? "document" : "documents"} selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onAddSelectedToChatContext && (
              <Button
                variant="default"
                size="xs"
                onClick={() => onAddSelectedToChatContext(selectedIds)}
                className="gap-1.5"
              >
                <Sparkles className="size-3.5" />
                Add to Chat Context
              </Button>
            )}

            {onRemoveSelectedFromChatContext && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => onRemoveSelectedFromChatContext(selectedIds)}
                className="gap-1.5"
              >
                <MessageSquareX className="size-3.5" />
                Remove from Chat
              </Button>
            )}

            {onDeleteSelected && (
              <Button
                variant="destructive"
                size="xs"
                onClick={() => setIsBatchDeleteDialogOpen(true)}
                className="gap-1.5"
              >
                <Trash2 className="size-3.5" />
                Delete Selected
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onSelectAll?.(false)}
              title="Clear selection"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="mt-3 text-sm">Loading documents...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <File className="size-6" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">
            {documents.length === 0
              ? "No documents yet"
              : "No documents match filters"}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {documents.length === 0
              ? "Upload PDF, Word, Excel, or Markdown files above to begin extracting and chatting with your knowledge base."
              : "Try adjusting your search query, status, or file type filter to view documents."}
          </p>
          {(searchQuery || statusFilter !== "ALL" || typeFilter !== "ALL") && (
            <Button
              variant="outline"
              size="xs"
              className="mt-4"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
                setTypeFilter("ALL");
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              isSelected={selectedIds.includes(doc.id)}
              isInChatContext={chatContextIds.includes(doc.id)}
              onSelect={onSelect}
              onToggleChatContext={onToggleChatContext}
              onOpenPreview={onOpenPreview}
              onDelete={onDelete}
              onRename={onRename}
              onReprocess={onReprocess}
              onConvert={onConvert}
            />
          ))}
        </div>
      ) : (
        /* Table / List View */
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-3 text-center">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={allFilteredSelected}
                      onClick={handleToggleSelectAll}
                      className={cn(
                        "flex size-4 items-center justify-center rounded border transition-colors outline-none",
                        allFilteredSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30 bg-background hover:border-foreground/60"
                      )}
                    >
                      {allFilteredSelected && <Check className="size-2.5 stroke-[3]" />}
                    </button>
                  </th>
                  <th className="px-3 py-3">Document</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Pages / Words</th>
                  <th className="px-3 py-3">Size</th>
                  <th className="px-3 py-3">Updated</th>
                  <th className="w-12 px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredDocuments.map((doc) => {
                  const isSelected = selectedIds.includes(doc.id);
                  const inChat = chatContextIds.includes(doc.id);

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => onOpenPreview?.(doc)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/30",
                        isSelected && "bg-primary/[0.03]"
                      )}
                    >
                      <td
                        className="px-3 py-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          onClick={() => onSelect?.(doc.id, !isSelected)}
                          className={cn(
                            "flex size-4 items-center justify-center rounded border transition-colors outline-none",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30 bg-background hover:border-foreground/60"
                          )}
                        >
                          {isSelected && <Check className="size-2.5 stroke-[3]" />}
                        </button>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="shrink-0">
                            {getListFileIcon(doc.mimeType)}
                          </div>
                          <div className="min-w-0">
                            <p
                              className="truncate font-medium text-foreground max-w-[200px] sm:max-w-xs md:max-w-sm hover:text-primary transition-colors"
                              title={doc.name}
                            >
                              {doc.name}
                            </p>
                            {inChat && (
                              <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
                                <Sparkles className="size-2.5" /> In Chat
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap">
                        {doc.status === "READY" && (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1 text-[10px]"
                          >
                            <CheckCircle2 className="size-2.5" /> Ready
                          </Badge>
                        )}
                        {doc.status === "PROCESSING" && (
                          <Badge
                            variant="outline"
                            className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 gap-1 text-[10px] animate-pulse"
                          >
                            <Loader2 className="size-2.5 animate-spin" /> Processing
                          </Badge>
                        )}
                        {doc.status === "PENDING" && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1 text-[10px]"
                          >
                            <Clock className="size-2.5" /> Pending
                          </Badge>
                        )}
                        {doc.status === "ERROR" && (
                          <Badge
                            variant="outline"
                            className="border-destructive/30 bg-destructive/10 text-destructive gap-1 text-[10px]"
                          >
                            <AlertCircle className="size-2.5" /> Error
                          </Badge>
                        )}
                      </td>

                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                        {doc.pageCount ? (
                          <span className="flex items-center gap-1">
                            <Layers className="size-3 text-muted-foreground/70" />
                            {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
                          </span>
                        ) : doc.wordCount ? (
                          <span>{doc.wordCount.toLocaleString()} words</span>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                        {formatBytes(doc.sizeBytes)}
                      </td>

                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3 text-muted-foreground/70" />
                          {formatDate(doc.updatedAt)}
                        </span>
                      </td>

                      <td
                        className="px-3 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DocumentActions
                          document={doc}
                          isInChatContext={inChat}
                          onOpenPreview={onOpenPreview}
                          onToggleChatContext={onToggleChatContext}
                          onConvert={onConvert}
                          onRename={onRename}
                          onReprocess={onReprocess}
                          onDelete={onDelete}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Dialog */}
      <Dialog
        open={isBatchDeleteDialogOpen}
        onOpenChange={setIsBatchDeleteDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="size-5" />
              Delete Selected Documents
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong className="text-foreground">{selectedIds.length}</strong>{" "}
              selected documents? This action cannot be undone and will delete all
              extracted data and vector embeddings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  variant="outline"
                  onClick={() => setIsBatchDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
              }
            />
            <Button
              variant="destructive"
              onClick={handleBatchDelete}
            >
              Delete {selectedIds.length} Documents
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
