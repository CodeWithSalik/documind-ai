"use client";

import * as React from "react";
import {
  Layers,
  FileText,
  FileSpreadsheet,
  FileCode,
  BarChart3,
  Download,
  Copy,
  Check,
  Search,
  ExternalLink,
  Sparkles,
  Calendar,
  Eye,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "@/components/shared/toast-provider";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { ArtifactType } from "@/types/artifacts";

interface ArtifactItem {
  id: string;
  name: string;
  type: ArtifactType;
  extension: string;
  size: string;
  model: string;
  createdAt: string;
  description: string;
  contentPreview: string;
}

export default function ArtifactsPage() {
  const [artifacts, setArtifacts] = React.useState<ArtifactItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedFilter, setSelectedFilter] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [previewArtifact, setPreviewArtifact] = React.useState<ArtifactItem | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const { activeWorkspaceId, loadWorkspaces } = useWorkspaceStore();

  React.useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  React.useEffect(() => {
    let isMounted = true;
    async function fetchArtifacts() {
      if (!activeWorkspaceId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch(`/api/artifacts?workspaceId=${encodeURIComponent(activeWorkspaceId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data?.items) && isMounted) {
            const loaded: ArtifactItem[] = json.data.items.map((item: {
              id: string;
              name: string;
              type: ArtifactType;
              sizeBytes?: number;
              createdAt: string;
              description?: string;
              content: unknown;
              message?: { model?: string };
            }) => ({
              id: item.id,
              name: item.name,
              type: item.type,
              extension: item.name.split(".").pop() || "txt",
              size: item.sizeBytes ? `${Math.round(item.sizeBytes / 1024)} KB` : "0 KB",
              model: item.message?.model || "AI Model",
              createdAt: new Date(item.createdAt).toLocaleDateString(),
              description: item.description || `Generated ${item.type.toLowerCase()} artifact`,
              contentPreview: typeof item.content === "string" ? item.content : JSON.stringify(item.content, null, 2),
            }));
            setArtifacts(loaded);
          }
        }
      } catch (err) {
        console.warn("Failed to load artifacts:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchArtifacts();
    return () => {
      isMounted = false;
    };
  }, [activeWorkspaceId]);

  const filterTabs = [
    { id: "ALL", label: "All Artifacts" },
    { id: "DOCUMENT", label: "Documents (DOCX)" },
    { id: "SPREADSHEET", label: "Spreadsheets (XLSX)" },
    { id: "CODE", label: "Code & SQL" },
    { id: "CHART", label: "Charts & Data" },
  ];

  const filtered = artifacts.filter((item) => {
    const matchesFilter = selectedFilter === "ALL" || item.type === selectedFilter;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getIcon = (type: ArtifactType) => {
    switch (type) {
      case "DOCUMENT":
        return <FileText className="size-5 text-blue-500" />;
      case "SPREADSHEET":
        return <FileSpreadsheet className="size-5 text-emerald-500" />;
      case "CODE":
        return <FileCode className="size-5 text-amber-500" />;
      case "CHART":
        return <BarChart3 className="size-5 text-purple-500" />;
      default:
        return <Layers className="size-5 text-primary" />;
    }
  };

  const handleDownload = (artifact: ArtifactItem) => {
    toast.success(`Download started: ${artifact.name}`, {
      description: `Format: .${artifact.extension.toUpperCase()} (${artifact.size})`,
    });
  };

  const handleCopy = (artifact: ArtifactItem) => {
    navigator.clipboard.writeText(artifact.contentPreview);
    setCopiedId(artifact.id);
    toast.info("Content copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-heading text-foreground">
              Artifacts Gallery
            </h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {artifacts.length} Generated
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Downloadable reports, spreadsheet models, code snippets, and chart structures compiled by AI.
          </p>
        </div>
      </div>

      {/* Toolbar: Search & Filter Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-y border-border/60 py-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search artifacts by title or keyword..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                selectedFilter === tab.id
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Artifacts Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No artifacts found"
          description="Try selecting a different filter category or asking the AI Studio to generate an artifact."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="group flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-xs hover:border-primary/50 hover:shadow-md transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-muted/60 shrink-0">
                      {getIcon(item.type)}
                    </div>
                    <div className="min-w-0">
                      <h3
                        className="font-semibold text-xs sm:text-sm text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                        onClick={() => setPreviewArtifact(item)}
                        title={item.name}
                      >
                        {item.name}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="uppercase font-mono">{item.extension}</span>
                        <span>•</span>
                        <span>{item.size}</span>
                      </div>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-[10px] shrink-0 font-normal">
                    {item.model}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="size-3" /> {item.createdAt}
                </span>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setPreviewArtifact(item)}
                    title="Preview artifact"
                  >
                    <Eye className="size-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleCopy(item)}
                    title="Copy content"
                  >
                    {copiedId === item.id ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5 text-muted-foreground hover:text-foreground" />
                    )}
                  </Button>
                  <Button
                    size="xs"
                    onClick={() => handleDownload(item)}
                    className="gap-1 text-xs shadow-xs"
                  >
                    <Download className="size-3" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-border/80 bg-popover p-6 shadow-2xl space-y-4 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                {getIcon(previewArtifact.type)}
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    {previewArtifact.name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Generated with {previewArtifact.model} • {previewArtifact.size}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setPreviewArtifact(null)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-xl border border-border/70 bg-background/80 p-4 font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed">
              {previewArtifact.contentPreview}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Ready for local export
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewArtifact(null)}
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    handleDownload(previewArtifact);
                    setPreviewArtifact(null);
                  }}
                  className="gap-1.5"
                >
                  <Download className="size-3.5" />
                  Download Artifact
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
