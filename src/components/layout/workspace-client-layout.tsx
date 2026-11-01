"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles,
  LayoutDashboard,
  FileText,
  MessageSquare,
  Layers,
  Settings,
  ChevronDown,
  Plus,
  Search,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Sun,
  Moon,
  Laptop,
  Check,
  Cpu,
  X,
  Trash2,
  LogOut,
  User,
  ShieldCheck,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useModelSelection } from "@/hooks/use-model-selection";
import { MODEL_REGISTRY, type ModelId } from "@/lib/ai/models";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "@/components/layout/mobile-nav";
import { toast } from "@/components/shared/toast-provider";
import { signOut } from "next-auth/react";

interface WorkspaceClientLayoutProps {
  children: React.ReactNode;
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function WorkspaceClientLayout({
  children,
  user,
}: WorkspaceClientLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Stores
  const {
    sidebarCollapsed,
    toggleSidebar,
    sidebarMobileOpen,
    setSidebarMobileOpen,
    documentPanelOpen,
    toggleDocumentPanel,
    theme,
    setTheme,
  } = useUIStore();

  const {
    contextDocumentIds,
    removeContextDocument,
    clearContextDocuments,
    setActiveConversationId,
    loadWorkspaces,
    workspaces,
    activeWorkspaceId,
  } = useWorkspaceStore();

  React.useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const { modelId, setModelId } = useModelSelection();

  // Dropdown states
  const [modelDropdownOpen, setModelDropdownOpen] = React.useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = React.useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = React.useState(false);

  // Close mobile drawer on route change
  React.useEffect(() => {
    setSidebarMobileOpen(false);
  }, [pathname, setSidebarMobileOpen]);

  // Handle Theme Change
  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    setThemeDropdownOpen(false);
    if (typeof document !== "undefined") {
      const isDark =
        newTheme === "dark" ||
        (newTheme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Documents", href: "/documents", icon: FileText },
    { name: "Chat", href: "/chat", icon: MessageSquare },
    { name: "Artifacts", href: "/artifacts", icon: Layers },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const handleStartNewChat = () => {
    setActiveConversationId(null);
    router.push("/chat");
  };

  const currentWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const userInitials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : user?.email
      ? user.email.slice(0, 2).toUpperCase()
      : "DM";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Mobile Sidebar Backdrop */}
      {sidebarMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setSidebarMobileOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border/70 bg-card/90 backdrop-blur-xl transition-all duration-300 md:static",
          sidebarCollapsed ? "w-16" : "w-64",
          sidebarMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Workspace Brand / Selector */}
        <div className="flex h-16 items-center justify-between border-b border-border/70 px-3.5">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-primary-foreground shadow-sm shadow-primary/30">
              <Sparkles className="size-5" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1 truncate">
                <span className="font-heading text-base font-bold tracking-tight block truncate">
                  DocuMind<span className="text-primary font-extrabold">.AI</span>
                </span>
                <span className="text-[10px] text-muted-foreground block truncate">
                  {currentWorkspace?.name || "Enterprise Workspace"}
                </span>
              </div>
            )}
          </Link>

          {!sidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={toggleSidebar}
              className="hidden md:flex text-muted-foreground hover:text-foreground"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="size-4" />
            </Button>
          )}
        </div>

        {/* Action Button: New Chat */}
        <div className="p-3">
          <Button
            onClick={handleStartNewChat}
            size="sm"
            className={cn(
              "w-full gap-2 shadow-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium",
              sidebarCollapsed ? "px-0 justify-center" : "justify-start px-3"
            )}
          >
            <Plus className="size-4 shrink-0" />
            {!sidebarCollapsed && <span>New Chat</span>}
          </Button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1 px-3 py-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs sm:text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  sidebarCollapsed && "justify-center px-0"
                )}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <Icon className={cn("size-4 shrink-0", isActive && "text-primary")} />
                {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Sidebar Widget: Security Status */}
        {!sidebarCollapsed && (
          <div className="border-t border-border/70 p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="size-3.5 text-emerald-500" />
                Zero-Trust Tenant Isolation
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold dark:text-emerald-400">Active</span>
            </div>
          </div>
        )}

        {/* Collapsed Toggle Button */}
        {sidebarCollapsed && (
          <div className="hidden md:flex p-3 border-t border-border/70 justify-center">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={toggleSidebar}
              title="Expand sidebar"
            >
              <PanelLeft className="size-4 text-muted-foreground" />
            </Button>
          </div>
        )}
      </aside>

      {/* Main Column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border/70 bg-card/80 px-4 backdrop-blur-md">
          {/* Left: Mobile hamburger & Model Selector */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSidebarMobileOpen(!sidebarMobileOpen)}
              className="md:hidden"
            >
              <PanelLeft className="size-5" />
            </Button>

            {/* AI Model Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className="flex items-center gap-2 rounded-xl border border-border/80 bg-background/90 px-3 py-1.5 text-xs font-semibold shadow-xs hover:border-primary/50 transition-colors"
              >
                <Cpu className="size-3.5 text-primary shrink-0" />
                <span className="text-foreground max-w-[130px] sm:max-w-none truncate">
                  {MODEL_REGISTRY[modelId]?.displayName || "Select Model"}
                </span>
                <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-mono text-primary hidden sm:inline-block">
                  {MODEL_REGISTRY[modelId]?.tier === "premium" ? "Frontier" : "Standard"}
                </span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>

              {modelDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setModelDropdownOpen(false)}
                  />
                  <div className="absolute left-0 mt-2 z-50 w-72 rounded-xl border border-border/80 bg-popover p-1.5 shadow-xl animate-in fade-in-0 zoom-in-95">
                    <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Active AI Reasoning Engine
                    </div>
                    {Object.values(MODEL_REGISTRY).map((mod) => (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => {
                          setModelId(mod.id as ModelId);
                          setModelDropdownOpen(false);
                          toast.success(`Active model: ${mod.displayName}`);
                        }}
                        className={cn(
                          "flex w-full items-start justify-between rounded-lg p-2 text-left text-xs transition-colors",
                          modelId === mod.id
                            ? "bg-primary/10 text-primary font-semibold"
                            : "hover:bg-muted text-foreground"
                        )}
                      >
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium truncate">{mod.displayName}</span>
                            {mod.tier === "premium" && (
                              <span className="rounded bg-amber-500/10 text-amber-500 text-[9px] px-1 font-bold">
                                PRO
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-snug line-clamp-1">
                            {mod.description}
                          </p>
                        </div>
                        {modelId === mod.id && (
                          <Check className="size-4 shrink-0 text-primary mt-0.5" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            {/* Quick Search Button */}
            <button
              type="button"
              onClick={() => {
                toast.info("Search shortcut", {
                  description: "Global document search activated (⌘K)",
                });
              }}
              className="hidden sm:flex items-center gap-2 rounded-lg border border-border/80 bg-background/60 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 transition-colors"
            >
              <Search className="size-3.5" />
              <span>Search documents...</span>
              <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
            </button>

            {/* Document Context Panel Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleDocumentPanel}
              className={cn(
                "gap-1.5 text-xs h-8 border-border/80",
                documentPanelOpen && "bg-muted text-primary"
              )}
              title="Toggle Context Documents Panel"
            >
              {documentPanelOpen ? (
                <PanelRightClose className="size-4" />
              ) : (
                <PanelRight className="size-4" />
              )}
              <span className="hidden sm:inline">Context</span>
              {contextDocumentIds.length > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {contextDocumentIds.length}
                </span>
              )}
            </Button>

            {/* Theme Toggle */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
                className="text-muted-foreground hover:text-foreground"
                title="Change theme"
              >
                {theme === "dark" ? (
                  <Moon className="size-4" />
                ) : theme === "light" ? (
                  <Sun className="size-4" />
                ) : (
                  <Laptop className="size-4" />
                )}
              </Button>

              {themeDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setThemeDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 z-50 w-36 rounded-xl border border-border/80 bg-popover p-1 shadow-lg text-xs">
                    <button
                      type="button"
                      onClick={() => handleThemeChange("light")}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted text-foreground"
                    >
                      <Sun className="size-3.5" /> Light
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemeChange("dark")}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted text-foreground"
                    >
                      <Moon className="size-3.5" /> Dark
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemeChange("system")}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted text-foreground"
                    >
                      <Laptop className="size-3.5" /> System
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* User Avatar Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs ring-1 ring-primary/30 transition-transform active:scale-95"
              >
                {userInitials}
              </button>

              {userDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 z-50 w-52 rounded-xl border border-border/80 bg-popover p-1.5 shadow-xl text-xs">
                    <div className="px-2 py-1.5 border-b border-border/60 mb-1">
                      <p className="font-semibold text-foreground truncate">{user?.name || "Active User"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {user?.email || "Authenticated"}
                      </p>
                    </div>
                    <Link
                      href="/settings"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted text-foreground"
                    >
                      <User className="size-3.5" /> Profile & Account
                    </Link>
                    <Link
                      href="/settings/team"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted text-foreground"
                    >
                      <ShieldCheck className="size-3.5" /> Team & Roles
                    </Link>
                    <div className="border-t border-border/60 my-1" />
                    <button
                      type="button"
                      onClick={async () => {
                        setUserDropdownOpen(false);
                        toast.info("Signed out of workspace");
                        await signOut({ callbackUrl: "/login" });
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-destructive hover:bg-destructive/10 text-xs text-left"
                    >
                      <LogOut className="size-3.5" /> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Body Shell: Page Content + Contextual Document Panel */}
        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          {/* Main Scrollable View */}
          <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
            {children}
          </main>

          {/* Contextual Document Panel (Right side) */}
          {documentPanelOpen && (
            <aside className="hidden lg:flex w-80 shrink-0 flex-col border-l border-border/70 bg-card/60 backdrop-blur-md overflow-hidden">
              <div className="flex h-12 items-center justify-between border-b border-border/70 px-4">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  <span className="font-semibold text-xs tracking-tight">Active Context</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {contextDocumentIds.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {contextDocumentIds.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={clearContextDocuments}
                      title="Clear all context"
                    >
                      <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={toggleDocumentPanel}
                    title="Close panel"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {contextDocumentIds.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-52 text-center p-4 rounded-xl border border-dashed border-border/60 bg-muted/20">
                    <FolderOpen className="size-8 text-muted-foreground/50 mb-2" />
                    <p className="text-xs font-medium text-foreground">No documents in context</p>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-[180px]">
                      Select documents from your library to anchor AI reasoning.
                    </p>
                    <Link href="/documents" className="mt-3">
                      <Button size="xs" variant="outline" className="text-xs">
                        Browse Library
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      These documents will be synthesized in your next chat query:
                    </p>
                    {contextDocumentIds.map((docId) => (
                      <div
                        key={docId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/80 p-2.5 text-xs shadow-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="size-4 text-primary shrink-0" />
                          <div className="min-w-0 truncate">
                            <p className="font-medium text-foreground truncate">
                              Document-{docId.slice(0, 8)}
                            </p>
                            <span className="text-[10px] text-muted-foreground">Ready</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeContextDocument(docId)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded"
                          title="Remove from context"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-border/70 bg-muted/20">
                <Link href="/documents" className="block">
                  <Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
                    <Plus className="size-3.5" />
                    Add More Documents
                  </Button>
                </Link>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
