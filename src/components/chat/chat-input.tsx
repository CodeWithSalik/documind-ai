"use client";

import * as React from "react";
import {
  Paperclip,
  ArrowUp,
  Square,
  Sparkles,
  Loader2,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileImage,
  File,
  Layers,
  X,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelSelector } from "@/components/chat/model-selector";
import { type ModelId, DEFAULT_MODEL_ID } from "@/lib/ai/models";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast-provider";

export interface ComposerAttachment {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  status: "uploading" | "processing" | "ready" | "error";
  progress?: number;
  documentId?: string;
  errorMessage?: string;
}

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string) => void;
  onAttachDocument?: () => void;
  attachments?: ComposerAttachment[];
  onAddFiles?: (files: File[]) => void;
  onRemoveAttachment?: (id: string) => void;
  isUploadingAttachments?: boolean;
  isLoading?: boolean;
  onStop?: () => void;
  selectedModelId?: ModelId | string;
  onSelectModel?: (modelId: ModelId) => void;
  isConversationEmpty?: boolean;
  promptSuggestions?: Array<{
    title: string;
    prompt: string;
    icon?: "document" | "spreadsheet" | "summary" | "compare";
  }>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_PROMPT_SUGGESTIONS = [
  {
    title: "Executive Summary",
    prompt: "Provide an executive summary of the attached documents with key findings and action items.",
    icon: "summary" as const,
  },
  {
    title: "Draft DOCX Report",
    prompt: "Draft a comprehensive project status report in DOCX format based on these files.",
    icon: "document" as const,
  },
  {
    title: "Extract Financials to XLSX",
    prompt: "Extract all financial tables, metrics, and estimates into an Excel spreadsheet.",
    icon: "spreadsheet" as const,
  },
  {
    title: "Cross-Document Comparison",
    prompt: "Compare and contrast the key methodologies and metrics between the attached documents.",
    icon: "compare" as const,
  },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getAttachmentIcon(mimeType: string, name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (mimeType.includes("pdf") || ext === "pdf") {
    return <FileText className="size-3.5 text-red-500 shrink-0" />;
  }
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv" ||
    ext === "xlsx" ||
    ext === "xls" ||
    ext === "csv"
  ) {
    return <FileSpreadsheet className="size-3.5 text-emerald-500 shrink-0" />;
  }
  if (
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    ext === "docx" ||
    ext === "doc"
  ) {
    return <FileText className="size-3.5 text-blue-500 shrink-0" />;
  }
  if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext || "")) {
    return <FileImage className="size-3.5 text-purple-500 shrink-0" />;
  }
  if (
    mimeType.includes("code") ||
    mimeType.includes("json") ||
    mimeType.includes("text") ||
    ["txt", "md", "json", "ts", "js", "py"].includes(ext || "")
  ) {
    return <FileCode className="size-3.5 text-amber-500 shrink-0" />;
  }
  return <File className="size-3.5 text-muted-foreground shrink-0" />;
}

/**
 * Enhanced chat input component with auto-resizing textarea, document attachment,
 * drag-and-drop upload zone, removable attachment badges, and keyboard submission.
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  onAttachDocument,
  attachments = [],
  onAddFiles,
  onRemoveAttachment,
  isUploadingAttachments = false,
  isLoading = false,
  onStop,
  selectedModelId = DEFAULT_MODEL_ID,
  onSelectModel,
  isConversationEmpty = false,
  promptSuggestions = DEFAULT_PROMPT_SUGGESTIONS,
  placeholder = "Ask anything about your documents, request reports, or draft spreadsheets...",
  disabled = false,
  className,
}: ChatInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);

  // Auto-resize textarea to fit content up to 220px max
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 44), 220);
    textarea.style.height = `${newHeight}px`;
  }, [value]);

  const hasPendingUploads =
    isUploadingAttachments ||
    attachments.some((a) => a.status === "uploading" || a.status === "processing");
  const hasErrorAttachments = attachments.some((a) => a.status === "error");
  const canSubmit =
    !hasPendingUploads &&
    (value.trim().length > 0 || attachments.some((a) => a.status === "ready")) &&
    !isLoading &&
    !disabled;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (hasPendingUploads) {
      toast.info("Please wait for document upload and processing to complete.");
      return;
    }
    if (hasErrorAttachments) {
      toast.error("Please remove or resolve failed file attachments before sending.");
      return;
    }
    if (!canSubmit) return;

    const messageText = value.trim() || (attachments.length > 0 ? "Please analyze the attached document(s)." : "");
    onSubmit(messageText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onAddFiles) {
      onAddFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const handleAttachClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else if (onAttachDocument) {
      onAttachDocument();
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onAddFiles) {
      onAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleSelectSuggestion = (prompt: string) => {
    onChange(prompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const getSuggestionIcon = (type?: string) => {
    switch (type) {
      case "document":
        return <FileText className="size-3.5 text-blue-500" />;
      case "spreadsheet":
        return <FileSpreadsheet className="size-3.5 text-emerald-500" />;
      case "compare":
        return <Layers className="size-3.5 text-purple-500" />;
      default:
        return <Sparkles className="size-3.5 text-amber-500" />;
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Hidden File Input for Paperclip Attachment */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.html,.json,.png,.jpg,.jpeg,.webp"
        onChange={handleFileInputChange}
      />

      {/* Prompt Suggestions when conversation is empty */}
      {isConversationEmpty && promptSuggestions.length > 0 && attachments.length === 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Suggested Prompts
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {promptSuggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSuggestion(item.prompt)}
                className="group flex items-start gap-2.5 rounded-xl border border-border/80 bg-card/70 p-3 text-left text-xs transition-all hover:border-primary/50 hover:bg-card hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10">
                  {getSuggestionIcon(item.icon)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground group-hover:text-primary">
                    {item.title}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-muted-foreground leading-relaxed">
                    {item.prompt}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Input Box Container */}
      <form
        onSubmit={handleSubmit}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col rounded-2xl border bg-card/90 shadow-sm transition-all backdrop-blur-md",
          isDragOver
            ? "border-primary ring-2 ring-primary/30 bg-primary/5"
            : "border-border/80 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20"
        )}
      >
        {/* Drag & Drop Visual Overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-primary/10 backdrop-blur-xs border-2 border-dashed border-primary text-primary font-medium text-xs gap-2">
            <UploadCloud className="size-5 animate-bounce" />
            <span>Drop files here to attach to conversation</span>
          </div>
        )}

        {/* Staged Attachments Strip */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5 pb-1 border-b border-border/50">
            {attachments.map((att) => (
              <div
                key={att.id}
                className={cn(
                  "group inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all shadow-2xs",
                  att.status === "error"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : att.status === "ready"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-foreground"
                    : "border-border bg-muted/60 text-foreground"
                )}
              >
                {getAttachmentIcon(att.mimeType, att.name)}
                <span className="max-w-[130px] sm:max-w-[180px] truncate" title={att.name}>
                  {att.name}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatBytes(att.sizeBytes)}
                </span>

                {/* Status Indicator */}
                {att.status === "uploading" && (
                  <span className="flex items-center gap-1 text-[10px] text-primary font-medium">
                    <Loader2 className="size-3 animate-spin" />
                    <span>{att.progress ?? 0}%</span>
                  </span>
                )}

                {att.status === "processing" && (
                  <span className="flex items-center gap-1 text-[10px] text-primary font-medium">
                    <Sparkles className="size-3 animate-pulse" />
                    <span>Extracting...</span>
                  </span>
                )}

                {att.status === "ready" && (
                  <span
                    className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium"
                    title="Document extracted and indexed"
                  >
                    <CheckCircle2 className="size-3 text-emerald-500" />
                    <span>Ready</span>
                  </span>
                )}

                {att.status === "error" && (
                  <span
                    className="flex items-center gap-1 text-[10px] text-destructive font-semibold max-w-[140px] truncate"
                    title={att.errorMessage}
                  >
                    <AlertCircle className="size-3 shrink-0" />
                    <span className="truncate">{att.errorMessage || "Failed"}</span>
                  </span>
                )}

                {/* Remove button */}
                {onRemoveAttachment && (
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(att.id)}
                    className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Remove attachment"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none leading-relaxed disabled:opacity-50"
        />

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1">
          {/* Left Actions: Attach documents & Model selector */}
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleAttachClick}
              disabled={disabled || hasPendingUploads}
              className="text-muted-foreground hover:text-foreground hover:bg-muted relative"
              title="Attach documents to conversation"
              aria-label="Attach documents"
            >
              <Paperclip className="size-4" />
            </Button>

            {onSelectModel && (
              <ModelSelector
                selectedModelId={selectedModelId}
                onSelectModel={onSelectModel}
                size="sm"
                showQuickToggle={false}
              />
            )}
          </div>

          {/* Right Actions: Helper text & Send/Stop button */}
          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-muted-foreground/70 sm:inline">
              {hasPendingUploads
                ? "Uploading & extracting attached files..."
                : "Enter to send, Shift + Enter for newline"}
            </span>

            {isLoading ? (
              <Button
                type="button"
                size="icon-sm"
                variant="destructive"
                onClick={onStop}
                className="rounded-xl shadow-xs"
                title="Stop response generation"
              >
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : hasPendingUploads ? (
              <Button
                type="button"
                size="icon-sm"
                disabled
                className="rounded-xl shadow-xs opacity-70"
                title="Uploading documents..."
              >
                <Loader2 className="size-4 animate-spin text-primary-foreground" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon-sm"
                disabled={!canSubmit}
                className="rounded-xl shadow-xs transition-transform active:scale-95 disabled:opacity-40"
                title="Send message"
              >
                <ArrowUp className="size-4 stroke-[2.5]" />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
