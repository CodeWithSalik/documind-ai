"use client";

import * as React from "react";
import Link from "next/link";
import {
  Settings,
  Cpu,
  Users,
  ShieldCheck,
  Save,
  HardDrive,
  Sliders,
  Sparkles,
  Bot,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useModelSelection } from "@/hooks/use-model-selection";
import { useWorkspaceStore, type WorkspaceItem } from "@/stores/workspace-store";
import { toast } from "@/components/shared/toast-provider";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = React.useState<"general" | "models" | "team">("general");
  const { model, modelId, setModelId } = useModelSelection();

  const { activeWorkspaceId, workspaces, loadWorkspaces } = useWorkspaceStore();

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
    };

  // General settings state
  const [workspaceName, setWorkspaceName] = React.useState<string | null>(null);
  const [workspaceSlug, setWorkspaceSlug] = React.useState<string | null>(null);
  const [retentionDays, setRetentionDays] = React.useState("90");
  const [temperature, setTemperature] = React.useState("0.2");
  const [isSaving, setIsSaving] = React.useState(false);

  const effectiveWorkspaceName = workspaceName !== null ? workspaceName : currentWorkspace.name;
  const effectiveWorkspaceSlug = workspaceSlug !== null ? workspaceSlug : currentWorkspace.slug;

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Workspace settings updated successfully");
    }, 500);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">
          Workspace Settings
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Manage workspace preferences, AI frontier model configurations, and team permissions.
        </p>
      </div>

      {/* Tabs Header */}
      <div className="flex items-center gap-2 border-b border-border/70">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "general"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className="size-4" />
          General
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("models")}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "models"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Cpu className="size-4" />
          Model Defaults
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("team")}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "team"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="size-4" />
          Team & Roles
        </button>
      </div>

      {/* Tab 1: General Settings */}
      {activeTab === "general" && (
        <form onSubmit={handleSaveGeneral} className="space-y-6">
          <Card className="border-border/70 bg-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Workspace Profile</CardTitle>
              <CardDescription className="text-xs">
                Visible to all collaborators within this workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Workspace Name</label>
                <Input
                  value={effectiveWorkspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="max-w-md text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Workspace Identifier (URL Slug)</label>
                <div className="flex items-center gap-2 max-w-md">
                  <span className="text-xs font-mono text-muted-foreground">app.documind.ai/</span>
                  <Input
                    value={effectiveWorkspaceSlug}
                    onChange={(e) => setWorkspaceSlug(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Security & Storage Governance</CardTitle>
              <CardDescription className="text-xs">
                Encryption, access boundaries, and retention lifecycles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-muted/20">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-5 text-emerald-500 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      AWS S3 KMS Server-Side Encryption
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      All uploaded files are automatically encrypted at rest using dedicated KMS customer keys.
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="text-emerald-500 font-mono text-[10px]">
                  ACTIVE
                </Badge>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Document Retention Lifecycle</label>
                <select
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary max-w-md block"
                >
                  <option value="30">Retain documents for 30 days</option>
                  <option value="90">Retain documents for 90 days (Default)</option>
                  <option value="365">Retain documents for 1 year</option>
                  <option value="never">Indefinite storage (Enterprise)</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving} className="gap-2 shadow-xs">
              <Save className="size-4" />
              {isSaving ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </form>
      )}

      {/* Tab 2: Models Settings */}
      {activeTab === "models" && (
        <div className="space-y-6">
          <Card className="border-border/70 bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">AI Engine Configuration</CardTitle>
                <CardDescription className="text-xs">
                  Configure default reasoning parameters and provider credentials.
                </CardDescription>
              </div>
              <Link href="/settings/models">
                <Button variant="outline" size="xs" className="gap-1.5 text-xs">
                  Full Model Manager <ExternalLink className="size-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bot className="size-5 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Current Default Model</p>
                    <p className="text-[11px] text-muted-foreground">{model.displayName} ({model.tier})</p>
                  </div>
                </div>
                <Link href="/settings/models">
                  <Button size="xs" variant="outline" className="text-xs">
                    Switch Engine
                  </Button>
                </Link>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-foreground">Temperature (Creativity vs Determinism)</label>
                  <span className="font-mono text-primary font-semibold">{temperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Deterministic (0.0: Strict extraction)</span>
                  <span>Balanced (0.5)</span>
                  <span>Creative (1.0)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 3: Team Settings */}
      {activeTab === "team" && (
        <div className="space-y-6">
          <Card className="border-border/70 bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Workspace Collaborators</CardTitle>
                <CardDescription className="text-xs">
                  Manage team access tiers and role-based permissions.
                </CardDescription>
              </div>
              <Link href="/settings/team">
                <Button variant="outline" size="xs" className="gap-1.5 text-xs">
                  Manage Team & Invites <ExternalLink className="size-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card text-xs">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    LA
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Lead Analyst (You)</div>
                    <div className="text-[10px] text-muted-foreground">analyst@documind.ai</div>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">Owner</Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card text-xs">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs">
                    SC
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Sarah Chen</div>
                    <div className="text-[10px] text-muted-foreground">schen@acme.com</div>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">Editor</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
