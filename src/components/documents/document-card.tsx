"use client";

import * as React from "react";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  FileCode,
  File,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  Sparkles,
  Layers,
  Calendar,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DocumentActions } from "@/components/documents/document-actions";
import type { DocumentData, DocumentStatus, SupportedMimeType } from "@/types/documents";

export interface DocumentCardProps {
  document: DocumentData;
  isSelected?: boolean;
  isInChatContext?: boolean;
  onSelect?: (documentId: string, selected: boolean) => void;
  onToggleChatContext?: (documentId: string, inContext: boolean) => void;
  onOpenPreview?: (document: DocumentData) => void;
  onDelete?: (documentId: string) => void;
  onRename?: (documentId: string, newName: string) => void;
  onReprocess?: (documentId: string) => void;
  onConvert?: (documentId: string, targetFormat: string) => void;
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
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function getFileTypeConfig(mimeType: SupportedMimeType | string) {
  if (mimeType === "application/pdf") {
    return {
      icon: <FileText className="size-5 text-red-500" />,
      bg: "bg-red-500/10 text-red-500 border-red-500/20",
      label: "PDF",
    };
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return {
      icon: <FileText className="size-5 text-blue-500" />,
      bg: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      label: "DOCX",
    };
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return {
      icon: <FileSpreadsheet className="size-5 text-emerald-500" />,
      bg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      label: "XLSX",
    };
  }
  if (mimeType === "text/csv") {
    return {
      icon: <FileSpreadsheet className="size-5 text-teal-500" />,
      bg: "bg-teal-500/10 text-teal-500 border-teal-500/20",
      label: "CSV",
    };
  }
  if (mimeType.startsWith("image/")) {
    return {
      icon: <FileImage className="size-5 text-purple-500" />,
      bg: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      label: "IMAGE",
    };
  }
  if (
    mimeType === "text/markdown" ||
    mimeType === "text/plain" ||
    mimeType === "text/html" ||
    mimeType === "application/json"
  ) {
    return {
      icon: <FileCode className="size-5 text-amber-500" />,
      bg: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      label: mimeType === "text/markdown" ? "MD" : "CODE",
    };
  }
  return {
    icon: <File className="size-5 text-muted-foreground" />,
    bg: "bg-muted text-muted-foreground border-border",
    label: "FILE",
  };
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  switch (status) {
    case "READY":
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1 text-[11px] font-medium"
        >
          <CheckCircle2 className="size-3" />
          Ready
        </Badge>
      );
    case "PROCESSING":
      return (
        <Badge
          variant="outline"
          className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 gap-1 text-[11px] font-medium animate-pulse"
        >
          <Loader2 className="size-3 animate-spin" />
          Processing
        </Badge>
      );
    case "PENDING":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1 text-[11px] font-medium"
        >
          <Clock className="size-3" />
          Pending
        </Badge>
      );
    case "ERROR":
      return (
        <Badge
          variant="outline"
          className="border-destructive/30 bg-destructive/10 text-destructive gap-1 text-[11px] font-medium"
        >
          <AlertCircle className="size-3" />
          Error
        </Badge>
      );
    default:
      return null;
  }
}

export function DocumentCard({
  document,
  isSelected = false,
  isInChatContext = false,
  onSelect,
  onToggleChatContext,
  onOpenPreview,
  onDelete,
  onRename,
  onReprocess,
  onConvert,
  className,
}: DocumentCardProps) {
  const typeConfig = getFileTypeConfig(document.mimeType);

  const handleCardClick = () => {
    onOpenPreview?.(document);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(document.id, !isSelected);
  };

  return (
    <div
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenPreview?.(document);
        }
      }}
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border bg-card p-4 text-left transition-all duration-200 outline-none select-none",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:ring-1 hover:ring-primary/20",
        isSelected
          ? "border-primary bg-primary/[0.03] ring-2 ring-primary/25 shadow-xs"
          : "border-border/80",
        className
      )}
    >
      {/* Top Header: Selection Checkbox, Type Icon, Actions Menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {/* Custom Multi-select Checkbox */}
          <button
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            onClick={handleCheckboxClick}
            className={cn(
              "flex size-4.5 shrink-0 items-center justify-center rounded border transition-colors outline-none",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/30 bg-background/80 hover:border-foreground/60"
            )}
            title={isSelected ? "Deselect document" : "Select document"}
          >
            {isSelected && <Check className="size-3 stroke-[3]" />}
          </button>

          {/* File Type Icon container */}
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-lg border transition-transform duration-200 group-hover:scale-105",
              typeConfig.bg
            )}
          >
            {typeConfig.icon}
          </div>
        </div>

        {/* Action Dropdown Menu */}
        <div onClick={(e) => e.stopPropagation()}>
          <DocumentActions
            document={document}
            isInChatContext={isInChatContext}
            onOpenPreview={onOpenPreview}
            onToggleChatContext={onToggleChatContext}
            onConvert={onConvert}
            onRename={onRename}
            onReprocess={onReprocess}
            onDelete={onDelete}
          />
        </div>
      </div>

      {/* Main Body: Document Name & Chat Context Badge */}
      <div className="my-3 space-y-1">
        <h3
          className="truncate font-heading text-sm font-semibold text-foreground group-hover:text-primary transition-colors"
          title={document.name}
        >
          {document.name}
        </h3>

        {/* AI Chat Context Pill */}
        {isInChatContext && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-primary">
            <Sparkles className="size-3" />
            <span>Active in Chat Context</span>
          </div>
        )}

        {/* Error message if document processing failed */}
        {document.status === "ERROR" && document.errorMessage && (
          <p
            className="truncate text-[11px] text-destructive"
            title={document.errorMessage}
          >
            {document.errorMessage}
          </p>
        )}
      </div>

      {/* Bottom Footer: Status Badge, Pages / Words, File Size, Date */}
      <div className="flex items-center justify-between border-t border-border/50 pt-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <StatusBadge status={document.status} />
          {document.pageCount ? (
            <span className="flex items-center gap-0.5 text-[11px]">
              <Layers className="size-3 text-muted-foreground/70" />
              {document.pageCount} {document.pageCount === 1 ? "page" : "pages"}
            </span>
          ) : document.wordCount ? (
            <span className="text-[11px]">
              {document.wordCount.toLocaleString()} words
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span>{formatBytes(document.sizeBytes)}</span>
          {document.updatedAt && (
            <>
              <span>•</span>
              <span className="flex items-center gap-0.5" title="Updated date">
                <Calendar className="size-3 text-muted-foreground/70" />
                {formatDate(document.updatedAt)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
