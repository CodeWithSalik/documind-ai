"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  FileImage,
  Search,
  Filter,
  CheckCircle2,
  Trash2,
  ExternalLink,
  MessageSquare,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "@/components/shared/toast-provider";
import type { SupportedMimeType } from "@/types/documents";

interface DocItem {
  id: string;
  name: string;
  mimeType: SupportedMimeType;
  sizeBytes: number;
  status: "READY" | "PROCESSING" | "ERROR";
  pageCount?: number;
  sheets?: number;
  createdAt: string;
}

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = React.useState<DocItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedFormat, setSelectedFormat] = React.useState<string>("all");

  const {
    activeWorkspaceId,
    loadWorkspaces,
    contextDocumentIds,
    addContextDocument,
    removeContextDocument,
  } = useWorkspaceStore();

  React.useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const workspaceId = activeWorkspaceId || "default-workspace";

  React.useEffect(() => {
    let isMounted = true;
    async function loadDocuments() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data?.items) && isMounted) {
            const loaded: DocItem[] = json.data.items.map((item: {
              id: string;
              name: string;
              mimeType: SupportedMimeType;
              sizeBytes: number;
              status: "READY" | "PROCESSING" | "ERROR";
              pageCount?: number;
              createdAt: string;
            }) => ({
              id: item.id,
              name: item.name,
              mimeType: item.mimeType,
              sizeBytes: item.sizeBytes,
              status: item.status,
              pageCount: item.pageCount,
              createdAt: item.createdAt,
            }));
            setDocuments(loaded);
          }
        }
      } catch (err) {
        console.warn("Failed to load workspace documents:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDocuments();
    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        removeContextDocument(id);
        toast.info("Document removed", {
          description: `${name} has been deleted from your workspace.`,
        });
      } else {
        toast.error("Failed to delete document");
      }
    } catch {
      toast.error("Network error while deleting document");
    }
  };

  const handleToggleContext = (id: string, name: string) => {
    if (contextDocumentIds.includes(id)) {
      removeContextDocument(id);
      toast.info("Removed from chat context", { description: name });
    } else {
      addContextDocument(id);
      toast.success("Added to chat context", {
        description: `${name} will be synthesized in your next question.`,
      });
    }
  };

  const handleChatWithDoc = (id: string) => {
    addContextDocument(id);
    router.push("/chat");
  };

  // Filtered documents
  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedFormat === "pdf") return doc.mimeType === "application/pdf";
    if (selectedFormat === "spreadsheet") {
      return (
        doc.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        doc.mimeType === "text/csv"
      );
    }
    if (selectedFormat === "word") {
      return doc.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    if (selectedFormat === "image") return doc.mimeType.startsWith("image/");
    return true;
  });

  const getDocIcon = (mime: string) => {
    if (mime === "application/pdf") {
      return <FileText className="size-5 text-red-500" />;
    }
    if (mime.includes("spreadsheet") || mime === "text/csv") {
      return <FileSpreadsheet className="size-5 text-emerald-500" />;
    }
    if (mime.includes("wordprocessing")) {
      return <FileText className="size-5 text-blue-500" />;
    }
    if (mime.startsWith("image/")) {
      return <FileImage className="size-5 text-purple-500" />;
    }
    return <FileCode className="size-5 text-amber-500" />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-heading text-foreground">
              Document Library
            </h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {documents.length} Files
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Secure, encrypted workspace storage for PDFs, spreadsheets, Word briefs, and images.
          </p>
        </div>

        <Link href="/chat">
          <Button className="gap-2 shadow-xs">
            <MessageSquare className="size-4" />
            Start Chat with Documents
          </Button>
        </Link>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-y border-border/60 py-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by filename or keyword..."
            className="pl-9 h-9 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "All Formats" },
            { id: "pdf", label: "PDFs" },
            { id: "spreadsheet", label: "Sheets & CSV" },
            { id: "word", label: "Word" },
            { id: "image", label: "Images" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedFormat(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                selectedFormat === tab.id
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Document Grid */}
      {filteredDocs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents found"
          description={
            searchQuery
              ? `No documents matching "${searchQuery}". Try adjusting your search or filters.`
              : "No documents in your workspace yet. Start a chat and attach documents directly in the chat composer to begin AI reasoning."
          }
          action={{
            label: "Open Chat & Attach Documents",
            icon: MessageSquare,
            onClick: () => router.push("/chat"),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => {
            const isInContext = contextDocumentIds.includes(doc.id);

            return (
              <div
                key={doc.id}
                className={`group flex flex-col justify-between rounded-xl border bg-card p-4 transition-all shadow-xs hover:shadow-md ${
                  isInContext
                    ? "border-primary/60 bg-primary/[0.02] ring-1 ring-primary/20"
                    : "border-border/70 hover:border-primary/40"
                }`}
              >
                <div>
                  {/* Top Bar: Icon, Name, Context Toggle */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-muted/60 shrink-0">
                        {getDocIcon(doc.mimeType)}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="font-semibold text-xs sm:text-sm text-foreground hover:text-primary transition-colors line-clamp-2 block leading-snug"
                          title={doc.name}
                        >
                          {doc.name}
                        </Link>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                          <span>{formatBytes(doc.sizeBytes)}</span>
                          {doc.pageCount && <span>• {doc.pageCount} pages</span>}
                          {doc.sheets && <span>• {doc.sheets} sheets</span>}
                        </div>
                      </div>
                    </div>

                    {/* Context selection indicator button */}
                    <button
                      type="button"
                      onClick={() => handleToggleContext(doc.id, doc.name)}
                      className={`size-6 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                        isInContext
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "border border-border/80 text-muted-foreground hover:border-primary"
                      }`}
                      title={isInContext ? "Remove from chat context" : "Add to chat context"}
                    >
                      <Check className={`size-3.5 ${isInContext ? "opacity-100" : "opacity-0 group-hover:opacity-30"}`} />
                    </button>
                  </div>
                </div>

                {/* Bottom Bar: Status, Open in Chat, Delete */}
                <div className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3" /> Ready
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleChatWithDoc(doc.id)}
                      className="text-xs text-primary gap-1 font-medium hover:bg-primary/10"
                    >
                      <MessageSquare className="size-3" />
                      Chat
                    </Button>

                    <Link href={`/documents/${doc.id}`}>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="View details"
                      >
                        <ExternalLink className="size-3.5 text-muted-foreground" />
                      </Button>
                    </Link>

                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(doc.id, doc.name)}
                      title="Delete document"
                      className="hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
