"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Brain,
  Sparkles,
  LayoutDashboard,
  FileText,
  MessageSquare,
  Layers,
  Settings,
  ChevronLeft,
  ChevronRight,
  Folder,
  Plus,
  HardDrive,
  Check,
  X,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useWorkspaceStore, type WorkspaceItem } from "@/stores/workspace-store";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";

interface NavLinkItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_LINKS: NavLinkItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Documents",
    href: "/documents",
    icon: FileText,
  },
  {
    name: "Chat",
    href: "/chat",
    icon: MessageSquare,
  },
  {
    name: "Artifacts",
    href: "/artifacts",
    icon: Layers,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // UI state
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const sidebarMobileOpen = useUIStore((state) => state.sidebarMobileOpen);
  const setSidebarMobileOpen = useUIStore((state) => state.setSidebarMobileOpen);

  // Workspace state
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const setActiveWorkspaceId = useWorkspaceStore(
    (state) => state.setActiveWorkspaceId
  );
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const loadWorkspaces = useWorkspaceStore((state) => state.loadWorkspaces);
  const setActiveConversationId = useWorkspaceStore((state) => state.setActiveConversationId);

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
    };

  const handleSelectWorkspace = (workspace: WorkspaceItem) => {
    setActiveWorkspaceId(workspace.id);
  };

  const handleNewChat = (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveConversationId(null);
    setSidebarMobileOpen(false);
    router.push("/chat");
  };

  // Close mobile sidebar upon clicking navigation links
  const handleNavClick = () => {
    if (sidebarMobileOpen) {
      setSidebarMobileOpen(false);
    }
  };

  // Sidebar Inner Content Component (used in both Desktop & Mobile Drawer)
  const renderSidebarContent = (isMobile = false) => {
    const isCollapsed = !isMobile && sidebarCollapsed;

    return (
      <div className="flex flex-col h-full select-none">
        {/* 1. Header: Brand Logo & Workspace Selector */}
        <div className="flex items-center justify-between p-3.5 border-b border-sidebar-border/70 min-h-[64px]">
          {isCollapsed ? (
            /* Collapsed Brand Mark */
            <div className="mx-auto flex flex-col items-center gap-2">
              <Link
                href="/dashboard"
                aria-label="DocuMind AI Home"
                className="group relative flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white shadow-md shadow-purple-500/25 transition-transform duration-200 hover:scale-105"
              >
                <Brain className="size-5" />
                <Sparkles className="size-2.5 absolute top-1 right-1 text-amber-300 animate-pulse" />
              </Link>
            </div>
          ) : (
            /* Expanded Brand & Workspace Dropdown */
            <div className="flex items-center justify-between w-full gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-2.5 rounded-xl p-1.5 -ml-1 hover:bg-sidebar-accent/50 text-sidebar-foreground transition-all duration-150 outline-none w-full text-left cursor-pointer group"
                  aria-label="Switch Workspace"
                >
                  {/* Intelligent Gradient Logo */}
                  <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white shadow-sm shadow-purple-500/30">
                    <Brain className="size-5" />
                    <Sparkles className="size-2 absolute -top-0.5 -right-0.5 text-amber-300" />
                  </div>

                  {/* Brand & Workspace Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-heading font-bold text-sm tracking-tight text-foreground truncate">
                        DocuMind
                      </span>
                      <span className="text-[10px] font-extrabold uppercase px-1 py-0.2 rounded bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-2xs">
                        AI
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                      {currentWorkspace.name}
                    </p>
                  </div>

                  <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="start"
                  sideOffset={6}
                  className="w-64 p-1.5 rounded-xl border border-border/80 shadow-xl bg-popover"
                >
                  <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                    Workspaces
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-1" />

                  <DropdownMenuGroup>
                    {(workspaces.length > 0 ? workspaces : [currentWorkspace]).map((ws) => {
                      const isActive = ws.id === currentWorkspace.id;
                      const iconBg = ws.role === "OWNER" ? "bg-indigo-600" : "bg-purple-600";
                      return (
                        <DropdownMenuItem
                          key={ws.id}
                          onClick={() => handleSelectWorkspace(ws)}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
                            isActive
                              ? "bg-accent text-accent-foreground font-medium"
                              : "hover:bg-muted/70 text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={cn(
                                "size-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0",
                                iconBg
                              )}
                            >
                              {ws.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="truncate">
                              <p className="text-xs font-medium truncate">
                                {ws.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {ws.role === "OWNER" ? "Owner" : "Member"}
                              </p>
                            </div>
                          </div>
                          {isActive && (
                            <Check className="size-3.5 shrink-0 text-primary" />
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuGroup>


                  <DropdownMenuSeparator className="my-1" />

                  <DropdownMenuItem
                    onClick={() => router.push("/settings")}
                    className="flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs font-medium text-primary hover:bg-primary/10"
                  >
                    <Plus className="size-3.5" />
                    <span>Create New Workspace</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Close Button on Mobile Drawer */}
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setSidebarMobileOpen(false)}
                  className="size-8 inline-flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                  aria-label="Close sidebar"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* 2. Scrollable Body: Nav Links + Documents Tree + Recent Chats */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5 scrollbar-thin">
          {/* Main Navigation Links */}
          <nav aria-label="Main Navigation" className="space-y-1">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const isActive =
                pathname === link.href ||
                (link.href !== "/dashboard" && pathname?.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={handleNavClick}
                  title={isCollapsed ? link.name : undefined}
                  className={cn(
                    "group relative flex items-center rounded-lg text-xs font-medium transition-all duration-150 outline-none",
                    isCollapsed
                      ? "justify-center size-10 mx-auto"
                      : "gap-3 px-3 py-2 w-full",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-primary shadow-2xs"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {!isCollapsed && (
                    <span className="flex-1 truncate">{link.name}</span>
                  )}
                  {!isCollapsed && link.badge && (
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className="text-[10px] h-4.5 px-1.5 ml-auto font-medium"
                    >
                      {link.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Expanded Sections: Document Tree & Recent Chats */}
          {!isCollapsed && (
            <>
              {/* Document Vault Access */}
              <div className="space-y-2 pt-2 border-t border-sidebar-border/60">
                <div className="flex items-center justify-between px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Document Vault</span>
                  <Link
                    href="/chat"
                    onClick={handleNavClick}
                    title="New chat with documents"
                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="size-3.5" />
                  </Link>
                </div>

                <Link
                  href="/documents"
                  onClick={handleNavClick}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
                >
                  <Folder className="size-3.5 text-indigo-500 shrink-0" />
                  <span className="flex-1 truncate">All Workspace Documents</span>
                  {currentWorkspace.documentCount !== undefined && currentWorkspace.documentCount > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">{currentWorkspace.documentCount}</span>
                  )}
                </Link>
              </div>

              {/* Recent Conversations List */}
              <div className="space-y-2 pt-2 border-t border-sidebar-border/60">
                <div className="flex items-center justify-between px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Recent Chats</span>
                  <button
                    type="button"
                    onClick={handleNewChat}
                    title="Start new chat"
                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                  <p>No recent conversations.</p>
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="text-primary hover:underline text-[11px] mt-0.5 inline-block"
                  >
                    Start a new chat
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 3. Footer: Storage Quota & Desktop Collapse Toggle */}
        <div className="p-3 border-t border-sidebar-border/70 bg-sidebar/50">
          {isCollapsed ? (
            /* Collapsed Storage & Toggle */
            <div className="flex flex-col items-center gap-3">
              <div
                title="Storage: 3.4 GB of 10 GB (34%)"
                className="flex items-center justify-center size-9 rounded-lg bg-muted/60 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <HardDrive className="size-4" />
              </div>

              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Expand sidebar"
                className="flex size-8 items-center justify-center rounded-lg border border-sidebar-border/80 bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shadow-2xs"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          ) : (
            /* Expanded Storage Indicator & Collapse Toggle */
            <div className="space-y-3">
              {/* Storage Quota Indicator Bar */}
              <div className="rounded-xl border border-sidebar-border/60 bg-background/50 p-2.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <HardDrive className="size-3.5 text-primary" />
                    Storage
                  </span>
                  <span className="text-[11px] text-muted-foreground font-semibold">
                    34% used
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300"
                    style={{ width: "34%" }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>3.4 GB of 10 GB</span>
                  <Link
                    href="/settings"
                    onClick={handleNavClick}
                    className="font-medium text-primary hover:underline"
                  >
                    Upgrade
                  </Link>
                </div>
              </div>

              {/* Desktop Collapse Toggle */}
              {!isMobile && (
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
                  aria-label="Collapse sidebar"
                >
                  <span className="flex items-center gap-2">
                    <ChevronLeft className="size-4" />
                    <span>Collapse menu</span>
                  </span>
                  <kbd className="text-[10px] text-muted-foreground font-mono">
                    ⌘B
                  </kbd>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* =========================================================================
          Desktop Permanent Sidebar
          Hidden on mobile (<768px), rendered on tablet/desktop.
          Width transitions smoothly between collapsed (70px) and expanded (264px).
         ========================================================================= */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out z-20 sticky top-0 h-screen",
          sidebarCollapsed ? "w-[70px]" : "w-64 lg:w-70"
        )}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* =========================================================================
          Mobile Drawer (Drawer on screen < 768px)
          Renders when sidebarMobileOpen is true.
         ========================================================================= */}
      {sidebarMobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Drawer"
          className="fixed inset-0 z-50 md:hidden"
        >
          {/* Backdrop overlay */}
          <div
            onClick={() => setSidebarMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
          />

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-sidebar border-r border-sidebar-border shadow-2xl transition-transform duration-300 ease-out animate-in slide-in-from-left">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
