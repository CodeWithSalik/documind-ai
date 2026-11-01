"use client";

import * as React from "react";
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileCode,
  File,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCw,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  type SupportedMimeType,
  type DocumentData,
} from "@/types/documents";

export interface UploadItem {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  mimeType: string;
  progress: number;
  status: "idle" | "uploading" | "processing" | "completed" | "error" | "cancelled";
  errorMessage?: string;
  documentId?: string;
  storageKey?: string;
  xhr?: XMLHttpRequest;
}

export interface UploadZoneProps {
  workspaceId?: string;
  onUploadComplete?: (document: DocumentData) => void;
  onUploadError?: (error: Error) => void;
  className?: string;
  disabled?: boolean;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function getFileIcon(mimeType: string) {
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

export function UploadZone({
  workspaceId = "default-workspace",
  onUploadComplete,
  onUploadError,
  className,
  disabled = false,
}: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [queue, setQueue] = React.useState<UploadItem[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Derive accepted types string for input
  const acceptedTypesString = React.useMemo(() => {
    return SUPPORTED_MIME_TYPES.join(",");
  }, []);

  const updateItem = React.useCallback(
    (id: string, updates: Partial<UploadItem>) => {
      setQueue((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    },
    []
  );

  const startUpload = React.useCallback(
    async (item: UploadItem) => {
      updateItem(item.id, {
        status: "uploading",
        progress: 5,
        errorMessage: undefined,
      });

      const DIRECT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024; // 4MB threshold for serverless

      const executeDirectUpload = () => {
        return new Promise<void>((resolve, reject) => {
          const formData = new FormData();
          formData.append("file", item.file);
          formData.append("workspaceId", workspaceId);

          const xhr = new XMLHttpRequest();
          updateItem(item.id, { xhr });

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.min(
                90,
                Math.round((event.loaded / event.total) * 90)
              );
              updateItem(item.id, { progress: Math.max(5, percentComplete) });
            }
          };

          xhr.onload = () => {
            updateItem(item.id, { xhr: undefined, progress: 95, status: "processing" });

            try {
              const responseData = JSON.parse(xhr.responseText || "{}");
              if (xhr.status >= 200 && xhr.status < 300 && responseData.success) {
                const finalDocument: DocumentData = responseData.data?.document || {
                  id: responseData.data?.documentId || item.id,
                  name: item.name,
                  mimeType: item.mimeType as SupportedMimeType,
                  sizeBytes: item.sizeBytes,
                  storageKey: responseData.data?.storageKey || "",
                  status: "READY",
                  workspaceId,
                  pageCount: responseData.data?.pageCount,
                  wordCount: responseData.data?.wordCount,
                  uploadedById: "current-user",
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };

                updateItem(item.id, {
                  status: "completed",
                  progress: 100,
                  documentId: finalDocument.id,
                });

                onUploadComplete?.(finalDocument);
                resolve();
              } else {
                const errorMsg =
                  responseData.error?.message ||
                  responseData.error ||
                  `Upload failed with status ${xhr.status}`;
                reject(new Error(errorMsg));
              }
            } catch {
              reject(new Error(`Failed to parse upload response: ${xhr.statusText}`));
            }
          };

          xhr.onerror = () => reject(new Error("Network connection error during upload"));
          xhr.onabort = () => reject(new Error("Upload cancelled by user"));

          xhr.open("POST", "/api/documents/upload");
          xhr.send(formData);
        });
      };

      const executePresignedUpload = async () => {
        // 1. Request presigned URL from authenticated upload route
        const presignedRes = await fetch("/api/documents/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            fileName: item.name,
            mimeType: item.mimeType || "application/octet-stream",
            sizeBytes: item.sizeBytes,
          }),
        });

        const presignedData = await presignedRes.json();

        if (!presignedRes.ok || !presignedData.success) {
          const errMsg = presignedData?.error?.message || "Failed to initialize upload";
          // If local storage mode, fall back to direct multipart upload
          if (
            errMsg.includes("Presigned URLs are not available in local storage mode") ||
            presignedData?.error?.code === "STORAGE_CONFIGURATION_ERROR"
          ) {
            return executeDirectUpload();
          }
          throw new Error(errMsg);
        }

        const { uploadUrl, documentId } = presignedData.data || presignedData;
        if (!uploadUrl || !documentId) {
          throw new Error("Invalid presigned upload response from server");
        }

        // 2. Upload file directly to object storage via HTTP PUT
        await new Promise<void>((resolve, reject) => {
          const putXhr = new XMLHttpRequest();
          updateItem(item.id, { xhr: putXhr });

          putXhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.min(
                90,
                Math.round((event.loaded / event.total) * 90)
              );
              updateItem(item.id, { progress: Math.max(5, percentComplete) });
            }
          };

          putXhr.onload = async () => {
            updateItem(item.id, { xhr: undefined, progress: 95, status: "processing" });

            if (putXhr.status >= 200 && putXhr.status < 300) {
              // 3. Trigger document processing route
              try {
                const processRes = await fetch("/api/documents/process", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ documentId }),
                });

                const processData = await processRes.json();
                if (!processRes.ok || !processData.success) {
                  throw new Error(processData?.error?.message || "Document processing failed");
                }

                const finalDocument: DocumentData = {
                  id: documentId,
                  name: item.name,
                  mimeType: item.mimeType as SupportedMimeType,
                  sizeBytes: item.sizeBytes,
                  storageKey: presignedData.data?.storageKey || presignedData.storageKey || "",
                  status: "READY",
                  workspaceId,
                  pageCount: processData.data?.pageCount,
                  wordCount: processData.data?.wordCount,
                  uploadedById: "current-user",
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };

                updateItem(item.id, {
                  status: "completed",
                  progress: 100,
                  documentId,
                });

                onUploadComplete?.(finalDocument);
                resolve();
              } catch (procErr: unknown) {
                const errMsg = procErr instanceof Error ? procErr.message : "Processing failed";
                reject(new Error(errMsg));
              }
            } else {
              reject(new Error(`Storage upload failed with status ${putXhr.status}`));
            }
          };

          putXhr.onerror = () => reject(new Error("Storage network error during upload"));
          putXhr.onabort = () => reject(new Error("Upload cancelled by user"));

          putXhr.open("PUT", uploadUrl);
          putXhr.setRequestHeader("Content-Type", item.mimeType || "application/octet-stream");
          putXhr.send(item.file);
        });
      };

      try {
        if (item.file.size <= DIRECT_UPLOAD_MAX_BYTES) {
          await executeDirectUpload();
        } else {
          await executePresignedUpload();
        }
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        const isCancelled = error.message.includes("cancelled");

        updateItem(item.id, {
          status: isCancelled ? "cancelled" : "error",
          errorMessage: error.message,
          xhr: undefined,
        });

        if (!isCancelled) {
          onUploadError?.(error);
        }
      }
    },
    [workspaceId, onUploadComplete, onUploadError, updateItem]
  );

  const handleFiles = React.useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const newItems: UploadItem[] = [];

      for (const file of fileArray) {
        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        // File validation: Size limit
        if (file.size > MAX_FILE_SIZE_BYTES) {
          newItems.push({
            id,
            file,
            name: file.name,
            sizeBytes: file.size,
            mimeType: file.type,
            progress: 0,
            status: "error",
            errorMessage: `File exceeds maximum size limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
          });
          continue;
        }

        // File validation: MIME type check
        const isMimeSupported = SUPPORTED_MIME_TYPES.includes(
          file.type as SupportedMimeType
        );
        // Fallback check by extension if mime type is generic
        const extension = file.name.split(".").pop()?.toLowerCase();
        const extensionSupported =
          extension &&
          ["pdf", "docx", "xlsx", "csv", "txt", "md", "html", "json", "png", "jpg", "jpeg", "webp"].includes(
            extension
          );

        if (!isMimeSupported && !extensionSupported) {
          newItems.push({
            id,
            file,
            name: file.name,
            sizeBytes: file.size,
            mimeType: file.type || "unknown",
            progress: 0,
            status: "error",
            errorMessage: `Unsupported file type. Supported: PDF, Word, Excel, CSV, Markdown, Text, Images.`,
          });
          continue;
        }

        const validItem: UploadItem = {
          id,
          file,
          name: file.name,
          sizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
          progress: 0,
          status: "idle",
        };

        newItems.push(validItem);
      }

      setQueue((prev) => [...newItems, ...prev]);

      // Automatically launch upload for valid idle items
      for (const item of newItems) {
        if (item.status === "idle") {
          startUpload(item);
        }
      }
    },
    [startUpload]
  );

  const cancelUpload = React.useCallback(
    (id: string) => {
      setQueue((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            if (item.xhr) {
              item.xhr.abort();
            }
            return { ...item, status: "cancelled", errorMessage: "Upload cancelled" };
          }
          return item;
        })
      );
    },
    []
  );

  const retryUpload = React.useCallback(
    (id: string) => {
      const item = queue.find((q) => q.id === id);
      if (item) {
        startUpload(item);
      }
    },
    [queue, startUpload]
  );

  const removeItem = React.useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearCompleted = React.useCallback(() => {
    setQueue((prev) =>
      prev.filter(
        (item) =>
          item.status !== "completed" &&
          item.status !== "cancelled" &&
          item.status !== "error"
      )
    );
  }, []);

  // Drag and drop handlers
  const handleDragOver = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (disabled) return;

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [disabled, handleFiles]
  );

  const handleFileInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        // Reset file input value so re-selecting the same file fires onChange
        e.target.value = "";
      }
    },
    [handleFiles]
  );

  const completedCount = queue.filter(
    (i) => i.status === "completed" || i.status === "error" || i.status === "cancelled"
  ).length;

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Drop Zone Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          "group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 outline-none select-none",
          disabled ? "cursor-not-allowed opacity-50 border-muted" : "cursor-pointer hover:border-primary/60 hover:bg-primary/5",
          isDragOver
            ? "border-primary bg-primary/10 shadow-lg shadow-primary/10 scale-[1.005]"
            : "border-border/80 bg-card/60"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypesString}
          onChange={handleFileInputChange}
          disabled={disabled}
          className="sr-only"
        />

        <div
          className={cn(
            "flex size-14 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110",
            isDragOver ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
          )}
        >
          <UploadCloud className="size-7" />
        </div>

        <div className="mt-4 space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {isDragOver ? (
              <span className="text-primary font-bold">Release to upload files</span>
            ) : (
              <>
                <span className="text-primary hover:underline">Click to upload</span> or drag and drop
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            PDF, Word, Excel, CSV, Text, Markdown, HTML, JSON, Images
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            Maximum file size: 50MB per document
          </p>
        </div>
      </div>

      {/* Visual Upload Queue */}
      {queue.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-card/40 p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Upload Queue ({queue.length})
              </h4>
            </div>
            {completedCount > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={clearCompleted}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear finished
              </Button>
            )}
          </div>

          <div className="space-y-2.5">
            {queue.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg border p-3 text-xs transition-colors",
                  item.status === "error"
                    ? "border-destructive/30 bg-destructive/5"
                    : item.status === "completed"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border/60 bg-background/60"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {getFileIcon(item.mimeType)}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground max-w-[240px] sm:max-w-xs md:max-w-md">
                        {item.name}
                      </p>
                      <span className="text-[11px] text-muted-foreground">
                        {formatBytes(item.sizeBytes)}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {/* Status Text & Indicators */}
                    {item.status === "uploading" && (
                      <span className="flex items-center gap-1 font-mono text-[11px] text-primary">
                        <Loader2 className="size-3 animate-spin" />
                        {item.progress}%
                      </span>
                    )}

                    {item.status === "processing" && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-blue-500">
                        <Loader2 className="size-3 animate-spin" />
                        Extracting...
                      </span>
                    )}

                    {item.status === "completed" && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3.5" />
                        Ready
                      </span>
                    )}

                    {item.status === "cancelled" && (
                      <span className="text-[11px] text-muted-foreground">Cancelled</span>
                    )}

                    {/* Actions: Cancel / Retry / Remove */}
                    {item.status === "uploading" && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => cancelUpload(item.id)}
                        title="Cancel upload"
                      >
                        <X className="size-3.5" />
                      </Button>
                    )}

                    {item.status === "error" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => retryUpload(item.id)}
                          title="Retry"
                        >
                          <RotateCw className="size-3.5 text-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => removeItem(item.id)}
                          title="Dismiss"
                        >
                          <X className="size-3.5 text-muted-foreground" />
                        </Button>
                      </>
                    )}

                    {(item.status === "completed" || item.status === "cancelled") && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeItem(item.id)}
                        title="Remove"
                      >
                        <X className="size-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {(item.status === "uploading" || item.status === "processing") && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        item.status === "processing"
                          ? "bg-blue-500 animate-pulse"
                          : "bg-primary"
                      )}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}

                {/* Error message */}
                {item.status === "error" && item.errorMessage && (
                  <div className="flex items-start gap-1 text-[11px] text-destructive">
                    <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                    <span>{item.errorMessage}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
