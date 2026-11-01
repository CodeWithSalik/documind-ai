"use client";

import * as React from "react";
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  FileEdit,
  BarChart3,
  File,
  Eye,
  Download,
  Calendar,
  HardDrive,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ArtifactData, ArtifactType } from "@/types/artifacts";

export interface ArtifactCardProps {
  artifact: ArtifactData;
  onView?: (artifact: ArtifactData) => void;
  onDownload?: (artifact: ArtifactData) => void;
  className?: string;
}

/**
 * Format bytes into human-readable size (KB, MB).
 */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format relative or short date string.
 */
export function formatArtifactDate(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMins / 60);
  const diffDays = Math.round(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Resolve icon, badge, and color configuration for an artifact type.
 */
export function getArtifactTypeConfig(type: ArtifactType, mimeType?: string, fileName?: string) {
  const name = fileName?.toLowerCase() || "";
  const mime = mimeType?.toLowerCase() || "";

  if (type === "SPREADSHEET" || name.endsWith(".xlsx") || name.endsWith(".csv") || mime.includes("spreadsheet")) {
    return {
      label: "Spreadsheet",
      ext: name.endsWith(".csv") ? "CSV" : "XLSX",
      icon: FileSpreadsheet,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500/10 border-emerald-500/20",
      badgeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    };
  }

  if (type === "DOCUMENT" || name.endsWith(".pdf") || mime.includes("pdf")) {
    const isPdf = name.endsWith(".pdf") || mime.includes("pdf");
    return {
      label: isPdf ? "PDF Document" : "Word Document",
      ext: isPdf ? "PDF" : "DOCX",
      icon: FileText,
      color: isPdf ? "text-rose-600 dark:text-rose-400" : "text-blue-600 dark:text-blue-400",
      bgColor: isPdf ? "bg-rose-500/10 border-rose-500/20" : "bg-blue-500/10 border-blue-500/20",
      badgeColor: isPdf
        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
        : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    };
  }

  if (type === "CODE" || name.endsWith(".json") || name.endsWith(".ts") || name.endsWith(".py")) {
    return {
      label: "Code & Data",
      ext: name.split(".").pop()?.toUpperCase() || "CODE",
      icon: FileCode,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-500/10 border-purple-500/20",
      badgeColor: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    };
  }

  if (type === "MARKDOWN" || name.endsWith(".md")) {
    return {
      label: "Markdown",
      ext: "MD",
      icon: FileEdit,
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-500/10 border-indigo-500/20",
      badgeColor: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    };
  }

  if (type === "CHART") {
    return {
      label: "Chart & Visual",
      ext: "CHART",
      icon: BarChart3,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500/10 border-amber-500/20",
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    };
  }

  return {
    label: "File",
    ext: name.split(".").pop()?.toUpperCase() || "FILE",
    icon: File,
    color: "text-muted-foreground",
    bgColor: "bg-muted border-border",
    badgeColor: "bg-muted text-muted-foreground border-border",
  };
}

/**
 * ArtifactCard component displaying metadata, format badges, and action triggers
 * for generated workspace outputs.
 */
export function ArtifactCard({
  artifact,
  onView,
  onDownload,
  className,
}: ArtifactCardProps) {
  const { id, name, type, mimeType, sizeBytes, createdAt, metadata, downloadUrl } = artifact;

  const config = getArtifactTypeConfig(type, mimeType, name);
  const TypeIcon = config.icon;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDownload) {
      onDownload(artifact);
    } else if (downloadUrl) {
      window.open(downloadUrl, "_blank");
    }
  };

  const handleView = () => {
    if (onView) {
      onView(artifact);
    }
  };

  return (
    <Card
      onClick={handleView}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card/80 p-0 shadow-xs transition-all hover:border-primary/40 hover:bg-card hover:shadow-md cursor-pointer backdrop-blur-xs",
        className
      )}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-2">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-105",
              config.bgColor
            )}
          >
            <TypeIcon className={cn("size-5", config.color)} />
          </div>

          <div className="min-w-0">
            <h3
              className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors"
              title={name}
            >
              {name}
            </h3>
            <span className="text-xs text-muted-foreground">
              {config.label}
            </span>
          </div>
        </div>

        <Badge
          variant="outline"
          className={cn("h-5 font-mono text-[10px] font-semibold tracking-wider", config.badgeColor)}
        >
          {config.ext}
        </Badge>
      </div>

      {/* Middle Metadata (Creation date, size, AI model) */}
      <div className="px-4 py-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-1">
            <Calendar className="size-3 text-muted-foreground/70" />
            <span>{formatArtifactDate(createdAt)}</span>
          </div>

          <div className="flex items-center gap-1">
            <HardDrive className="size-3 text-muted-foreground/70" />
            <span>{formatBytes(sizeBytes)}</span>
          </div>

          {metadata?.generationModel && (
            <div className="flex items-center gap-1 text-[11px] font-medium text-foreground/80">
              <Sparkles className="size-3 text-primary" />
              <span>{metadata.generationModel}</span>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer with View and Download buttons */}
      <div className="mt-2 flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-2.5">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            handleView();
          }}
          className="gap-1.5 text-xs text-foreground/80 hover:text-foreground"
        >
          <Eye className="size-3.5" />
          <span>View Preview</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={handleDownload}
          className="gap-1.5 rounded-lg border-border/80 bg-background text-xs font-medium shadow-2xs hover:border-primary/50"
        >
          <Download className="size-3.5" />
          <span>Download</span>
        </Button>
      </div>
    </Card>
  );
}
