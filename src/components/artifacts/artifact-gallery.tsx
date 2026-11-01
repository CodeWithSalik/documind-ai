"use client";

import * as React from "react";
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  FileEdit,
  FolderOpen,
  Search,
  Filter,
  ArrowUpDown,
  Sparkles,
  Layers,
  FileBox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ArtifactCard } from "@/components/artifacts/artifact-card";
import { ArtifactViewer } from "@/components/artifacts/artifact-viewer";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { ArtifactData, ArtifactType } from "@/types/artifacts";

export interface ArtifactGalleryProps {
  artifacts: ArtifactData[];
  onDownloadArtifact?: (artifact: ArtifactData) => void;
  className?: string;
}

type FilterCategory = "ALL" | "DOCUMENT" | "SPREADSHEET" | "CODE" | "MARKDOWN";
type SortOption = "newest" | "oldest" | "name-asc" | "size-desc";

const FILTER_TABS: Array<{ id: FilterCategory; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "ALL", label: "All Outputs", icon: Layers },
  { id: "DOCUMENT", label: "Documents", icon: FileText },
  { id: "SPREADSHEET", label: "Spreadsheets", icon: FileSpreadsheet },
  { id: "CODE", label: "Code & Data", icon: FileCode },
  { id: "MARKDOWN", label: "Markdown", icon: FileEdit },
];

/**
 * ArtifactGallery displays a responsive grid of generated artifacts
 * with type category filtering, full-text search, sorting, and preview viewer modal.
 */
export function ArtifactGallery({
  artifacts = [],
  onDownloadArtifact,
  className,
}: ArtifactGalleryProps) {
  const [selectedCategory, setSelectedCategory] = React.useState<FilterCategory>("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortOption, setSortOption] = React.useState<SortOption>("newest");
  const [activeViewerArtifact, setActiveViewerArtifact] = React.useState<ArtifactData | null>(null);

  // Filter and sort artifacts
  const filteredArtifacts = React.useMemo(() => {
    let result = [...artifacts];

    // Filter by category
    if (selectedCategory !== "ALL") {
      result = result.filter((a) => {
        if (selectedCategory === "DOCUMENT") {
          return a.type === "DOCUMENT" || a.name.endsWith(".pdf") || a.name.endsWith(".docx");
        }
        if (selectedCategory === "SPREADSHEET") {
          return a.type === "SPREADSHEET" || a.name.endsWith(".xlsx") || a.name.endsWith(".csv");
        }
        if (selectedCategory === "CODE") {
          return a.type === "CODE" || a.name.endsWith(".ts") || a.name.endsWith(".json");
        }
        if (selectedCategory === "MARKDOWN") {
          return a.type === "MARKDOWN" || a.name.endsWith(".md");
        }
        return a.type === selectedCategory;
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.metadata?.generationModel?.toLowerCase().includes(q) ||
          a.metadata?.format?.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortOption === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortOption === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortOption === "name-asc") {
        return a.name.localeCompare(b.name);
      }
      if (sortOption === "size-desc") {
        return (b.sizeBytes || 0) - (a.sizeBytes || 0);
      }
      return 0;
    });

    return result;
  }, [artifacts, selectedCategory, searchQuery, sortOption]);

  // Statistics counts
  const counts = React.useMemo(() => {
    return {
      all: artifacts.length,
      documents: artifacts.filter((a) => a.type === "DOCUMENT" || a.name.endsWith(".docx") || a.name.endsWith(".pdf")).length,
      spreadsheets: artifacts.filter((a) => a.type === "SPREADSHEET" || a.name.endsWith(".xlsx") || a.name.endsWith(".csv")).length,
      code: artifacts.filter((a) => a.type === "CODE" || a.name.endsWith(".ts") || a.name.endsWith(".json")).length,
      markdown: artifacts.filter((a) => a.type === "MARKDOWN" || a.name.endsWith(".md")).length,
    };
  }, [artifacts]);

  const getSortLabel = (opt: SortOption) => {
    switch (opt) {
      case "newest":
        return "Newest First";
      case "oldest":
        return "Oldest First";
      case "name-asc":
        return "Alphabetical (A-Z)";
      case "size-desc":
        return "File Size (Largest)";
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Top Header & Search / Sort controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Workspace Artifacts
            </h2>
            <Badge variant="secondary" className="font-mono text-xs">
              {artifacts.length} generated
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            AI-generated documents, spreadsheets, data models, and research reports.
          </p>
        </div>

        {/* Search & Sort Dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-xs sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search artifacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs sm:text-sm"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-border/80 bg-background text-xs"
                />
              }
            >
              <ArrowUpDown className="size-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">{getSortLabel(sortOption)}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 text-xs">
              <DropdownMenuLabel>Sort Artifacts</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={sortOption}
                onValueChange={(val) => setSortOption(val as SortOption)}
              >
                <DropdownMenuRadioItem value="newest">Newest First</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="oldest">Oldest First</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name-asc">Alphabetical (A-Z)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="size-desc">Size (Largest)</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/80 pb-3">
        {FILTER_TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isSelected = selectedCategory === tab.id;
          const count =
            tab.id === "ALL"
              ? counts.all
              : tab.id === "DOCUMENT"
                ? counts.documents
                : tab.id === "SPREADSHEET"
                  ? counts.spreadsheets
                  : tab.id === "CODE"
                    ? counts.code
                    : counts.markdown;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedCategory(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <TabIcon className="size-3.5 shrink-0" />
              <span>{tab.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-mono",
                  isSelected
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-border text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid of Artifacts or Empty State */}
      {filteredArtifacts.length === 0 ? (
        <EmptyState
          icon={FileBox}
          title={
            artifacts.length === 0
              ? "No Generated Artifacts Yet"
              : "No Matching Artifacts Found"
          }
          description={
            artifacts.length === 0
              ? "Ask the AI assistant to write a document, extract spreadsheet data, or draft research reports to generate artifacts."
              : `No artifacts match your query '${searchQuery}' in '${selectedCategory}'. Try resetting filters.`
          }
          variant="dashed"
          className="my-8"
        >
          {artifacts.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedCategory("ALL");
                setSearchQuery("");
              }}
            >
              Reset Filters
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredArtifacts.map((artifact) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              onView={(art) => setActiveViewerArtifact(art)}
              onDownload={onDownloadArtifact}
            />
          ))}
        </div>
      )}

      {/* Viewer Modal */}
      <ArtifactViewer
        artifact={activeViewerArtifact}
        isOpen={Boolean(activeViewerArtifact)}
        onClose={() => setActiveViewerArtifact(null)}
        onDownload={onDownloadArtifact}
      />
    </div>
  );
}
