"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  MessageSquare,
  Layers,
  HardDrive,
  UploadCloud,
  Paperclip,
  Plus,
  ArrowRight,
  Clock,
  Sparkles,
  FileSpreadsheet,
  FileCode,
  MoreVertical,
  ExternalLink,
  Bot,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { useWorkspaceStore, type WorkspaceItem } from "@/stores/workspace-store";
import { useModelSelection } from "@/hooks/use-model-selection";
import { toast } from "@/components/shared/toast-provider";

interface RealDocItem {
  id: string;
  name: string;
  type: string;
  mimeType: string;
  size: string;
  pages?: number;
  sheets?: number;
  status: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const {
    activeWorkspaceId,
    workspaces,
    loadWorkspaces,
    setActiveConversationId,
    addContextDocument,
  } = useWorkspaceStore();
  const { model } = useModelSelection();

  const [recentDocuments, setRecentDocuments] = React.useState<RealDocItem[]>([]);
  const [totalDocBytes, setTotalDocBytes] = React.useState<number>(0);
  const [isLoadingDocs, setIsLoadingDocs] = React.useState(true);

  React.useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const currentWorkspace: WorkspaceItem =
    workspaces.find((w) => w.id === activeWorkspaceId) ||
    workspaces[0] || {
      id: activeWorkspaceId || "default",
      name: "Personal Workspace",
      slug: "personal-workspace",
      role: "OWNER",
      plan: "PRO",
      documentCount: 0,
      conversationCount: 0,
    };

  React.useEffect(() => {
    let isMounted = true;
    async function loadRecentDocs() {
      if (!currentWorkspace?.id) return;
      setIsLoadingDocs(true);
      try {
        const res = await fetch(`/api/documents?workspaceId=${encodeURIComponent(currentWorkspace.id)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data?.items) && isMounted) {
            let bytes = 0;
            const items: RealDocItem[] = json.data.items.slice(0, 4).map((item: {
              id: string;
              name: string;
              mimeType: string;
              sizeBytes: number;
              status: string;
              pageCount?: number;
              createdAt: string;
            }) => {
              bytes += item.sizeBytes || 0;
              const isPdf = item.mimeType === "application/pdf";
              const isSheet = item.mimeType?.includes("sheet") || item.mimeType === "text/csv";
              return {
                id: item.id,
                name: item.name,
                type: isPdf ? "pdf" : isSheet ? "spreadsheet" : "document",
                mimeType: item.mimeType,
                size: item.sizeBytes ? `${Math.round(item.sizeBytes / 1024)} KB` : "0 KB",
                pages: item.pageCount,
                sheets: isSheet ? 1 : undefined,
                status: item.status,
                updatedAt: new Date(item.createdAt).toLocaleDateString(),
              };
            });
            setRecentDocuments(items);
            setTotalDocBytes(bytes);
          }
        }
      } catch (err) {
        console.warn("Failed to load dashboard recent documents:", err);
      } finally {
        if (isMounted) setIsLoadingDocs(false);
      }
    }

    loadRecentDocs();
    return () => {
      isMounted = false;
    };
  }, [currentWorkspace?.id]);

  const handleStartChat = () => {
    setActiveConversationId(null);
    router.push("/chat");
  };

  const getDocIcon = (type: string) => {
    if (type === "spreadsheet") {
      return <FileSpreadsheet className="size-5 text-emerald-500" />;
    }
    if (type === "pdf") {
      return <FileText className="size-5 text-red-500" />;
    }
    return <FileText className="size-5 text-blue-500" />;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card/90 to-primary/5 p-6 sm:p-8 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" />
              <span>{currentWorkspace.name}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground font-normal">{currentWorkspace.plan || "PRO"} Plan</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-heading tracking-tight text-foreground">
              Welcome to your Document Studio 👋
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
              Your document intelligence workspace is primed. Reasoning powered by{" "}
              <span className="font-semibold text-foreground">{model.displayName}</span>{" "}
              with 1M+ context tokens available.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/chat">
              <Button variant="outline" size="sm" className="gap-2 border-border/80">
                <Paperclip className="size-4 text-primary" />
                Attach & Chat
              </Button>
            </Link>
            <Button onClick={handleStartChat} size="sm" className="gap-2 shadow-xs">
              <Plus className="size-4" />
              Start New Chat
            </Button>
          </div>
        </div>

        {/* Subtle Decorative Glow */}
        <div className="pointer-events-none absolute -right-12 -bottom-12 -z-0 size-64 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Documents */}
        <Card className="border-border/70 bg-card/70 shadow-xs hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Documents
            </CardTitle>
            <div className="size-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <FileText className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading">
              {currentWorkspace.documentCount ?? recentDocuments.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span>Ingested & indexed in workspace</span>
            </p>
          </CardContent>
        </Card>

        {/* Conversations */}
        <Card className="border-border/70 bg-card/70 shadow-xs hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Active Threads
            </CardTitle>
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <MessageSquare className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading">
              {currentWorkspace.conversationCount ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span>Reasoning conversation history</span>
            </p>
          </CardContent>
        </Card>

        {/* Generated Artifacts */}
        <Card className="border-border/70 bg-card/70 shadow-xs hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Generated Artifacts
            </CardTitle>
            <div className="size-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Layers className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading">0</div>
            <p className="text-xs text-muted-foreground mt-1">
              Reports, spreadsheet & code exports
            </p>
          </CardContent>
        </Card>

        {/* Storage Used */}
        <Card className="border-border/70 bg-card/70 shadow-xs hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Storage Used
            </CardTitle>
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <HardDrive className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading">
              {totalDocBytes > 1024 * 1024
                ? `${(totalDocBytes / (1024 * 1024)).toFixed(1)} MB`
                : totalDocBytes > 0
                ? `${Math.round(totalDocBytes / 1024)} KB`
                : "0 MB"}
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${Math.min(100, Math.max(1, (totalDocBytes / (5 * 1024 * 1024 * 1024)) * 100))}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Active workspace document storage
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Strip */}
      <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Shortcuts:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/chat">
              <Button variant="outline" size="xs" className="gap-1.5 text-xs">
                <Paperclip className="size-3.5 text-primary" />
                Attach to Chat
              </Button>
            </Link>
            <Button onClick={handleStartChat} variant="outline" size="xs" className="gap-1.5 text-xs">
              <MessageSquare className="size-3.5 text-blue-500" />
              Ask Any Question
            </Button>
            <Link href="/documents">
              <Button variant="outline" size="xs" className="gap-1.5 text-xs">
                <FileSpreadsheet className="size-3.5 text-emerald-500" />
                View Ingested Documents
              </Button>
            </Link>
            <Link href="/settings/models">
              <Button variant="outline" size="xs" className="gap-1.5 text-xs">
                <Bot className="size-3.5 text-purple-500" />
                Configure Models
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Documents & Recent Conversations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Recent Documents (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold font-heading text-foreground">
                Recent Documents
              </h2>
              <p className="text-xs text-muted-foreground">
                Recently ingested files ready for AI synthesis
              </p>
            </div>
            <Link href="/documents">
              <Button variant="ghost" size="xs" className="text-xs gap-1 text-primary">
                View all <ArrowRight className="size-3" />
              </Button>
            </Link>
          </div>

          {recentDocuments.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents uploaded yet"
              description="Upload or attach your PDF, DOCX, CSV, or spreadsheet files in chat to start asking questions."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {recentDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="group flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-xs hover:border-primary/50 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="p-2 rounded-lg bg-muted/60 shrink-0">
                        {getDocIcon(doc.type)}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="font-medium text-xs sm:text-sm text-foreground hover:text-primary transition-colors line-clamp-1 block"
                          title={doc.name}
                        >
                          {doc.name}
                        </Link>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span>{doc.size}</span>
                          {doc.pages && <span>• {doc.pages} pages</span>}
                          {doc.sheets && <span>• {doc.sheets} sheets</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="size-3" /> Ready
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        addContextDocument(doc.id);
                        toast.success("Document added to chat context", {
                          description: doc.name,
                        });
                        router.push("/chat");
                      }}
                      className="text-[11px] font-medium text-primary hover:underline underline-offset-2 flex items-center gap-1"
                    >
                      Chat With Doc <ArrowRight className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Recent Conversations (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold font-heading text-foreground">
                Recent Conversations
              </h2>
              <p className="text-xs text-muted-foreground">
                Active synthesis threads and inquiry history
              </p>
            </div>
            <Link href="/chat">
              <Button variant="ghost" size="xs" className="text-xs gap-1 text-primary">
                Open studio <ArrowRight className="size-3" />
              </Button>
            </Link>
          </div>

          <EmptyState
            icon={MessageSquare}
            title="No active conversations"
            description="Start a new chat session to discuss your documents with Google Gemini."
          />
        </div>
      </div>
    </div>
  );
}
