"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  Home,
  LayoutDashboard,
  FileText,
  MessageSquare,
  Layers,
  Settings,
  FolderOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  isCurrent?: boolean;
}

export interface BreadcrumbProps {
  /**
   * Optional manual breadcrumb items. If not provided,
   * items are dynamically inferred from current pathname.
   */
  items?: BreadcrumbItem[];
  /**
   * Optional custom dynamic title for the active document, chat, or artifact.
   */
  customTitle?: string;
  /**
   * Optional workspace name override.
   */
  workspaceName?: string;
  className?: string;
}

const SECTION_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  dashboard: { label: "Dashboard", icon: LayoutDashboard },
  documents: { label: "Documents", icon: FileText },
  chat: { label: "Chat", icon: MessageSquare },
  artifacts: { label: "Artifacts", icon: Layers },
  settings: { label: "Settings", icon: Settings },
};

export function Breadcrumb({
  items: manualItems,
  customTitle,
  workspaceName,
  className,
}: BreadcrumbProps) {
  const pathname = usePathname();
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const activeConversationId = useWorkspaceStore(
    (state) => state.activeConversationId
  );

  const displayWorkspaceName =
    workspaceName ||
    (activeWorkspaceId ? `Workspace #${activeWorkspaceId.slice(0, 6)}` : "Workspace");

  // Generate items automatically if manualItems are not provided
  const items: BreadcrumbItem[] = React.useMemo(() => {
    if (manualItems && manualItems.length > 0) {
      return manualItems;
    }

    const segments = (pathname || "/").split("/").filter(Boolean);
    const result: BreadcrumbItem[] = [
      {
        label: "Home",
        href: "/dashboard",
        icon: Home,
      },
    ];

    // Workspace segment
    result.push({
      label: displayWorkspaceName,
      href: "/dashboard",
      icon: FolderOpen,
    });

    if (segments.length === 0) {
      result[result.length - 1].isCurrent = true;
      return result;
    }

    const rootSection = segments[0].toLowerCase();
    const config = SECTION_CONFIG[rootSection];

    if (config) {
      const isCurrent = segments.length === 1 && !customTitle;
      result.push({
        label: config.label,
        href: `/${rootSection}`,
        icon: config.icon,
        isCurrent,
      });

      // Child item (e.g., document ID, chat conversation ID, etc.)
      if (segments.length > 1 || customTitle) {
        let childLabel = customTitle;

        if (!childLabel) {
          const detailId = segments[1];
          if (rootSection === "chat") {
            childLabel = activeConversationId
              ? `Chat (${activeConversationId.slice(0, 8)})`
              : "Conversation";
          } else if (rootSection === "documents") {
            childLabel = `Doc: ${detailId.slice(0, 8)}`;
          } else if (rootSection === "artifacts") {
            childLabel = `Artifact: ${detailId.slice(0, 8)}`;
          } else {
            childLabel = detailId.charAt(0).toUpperCase() + detailId.slice(1);
          }
        }

        result.push({
          label: childLabel,
          href: pathname,
          icon: rootSection === "artifacts" ? Sparkles : undefined,
          isCurrent: true,
        });
      }
    } else {
      // Fallback for custom top-level routes
      const formatted =
        rootSection.charAt(0).toUpperCase() + rootSection.slice(1);
      result.push({
        label: formatted,
        href: `/${rootSection}`,
        isCurrent: true,
      });
    }

    return result;
  }, [
    manualItems,
    pathname,
    displayWorkspaceName,
    customTitle,
    activeConversationId,
  ]);

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center text-xs md:text-sm font-medium", className)}
    >
      <ol className="flex items-center gap-1.5 md:gap-2 flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1 || item.isCurrent;
          const Icon = item.icon;

          return (
            <li
              key={`${item.label}-${index}`}
              className="inline-flex items-center gap-1.5 md:gap-2"
            >
              {index > 0 && (
                <ChevronRight
                  className="size-3.5 shrink-0 text-muted-foreground/40"
                  aria-hidden="true"
                />
              )}

              {isLast ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 font-semibold text-foreground max-w-[120px] sm:max-w-[180px] md:max-w-[260px] truncate"
                  )}
                  title={item.label}
                  aria-current="page"
                >
                  {Icon && (
                    <Icon className="size-3.5 sm:size-4 shrink-0 text-primary" />
                  )}
                  <span className="truncate">{item.label}</span>
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors max-w-[100px] sm:max-w-[140px] truncate"
                  title={item.label}
                >
                  {Icon && <Icon className="size-3.5 sm:size-4 shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground max-w-[100px] sm:max-w-[140px] truncate">
                  {Icon && <Icon className="size-3.5 sm:size-4 shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumb;
