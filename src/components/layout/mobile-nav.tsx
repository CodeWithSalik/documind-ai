"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Plus,
  Layers,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
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

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const setActiveConversationId = useWorkspaceStore(
    (state) => state.setActiveConversationId
  );

  const handleNewChat = (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveConversationId(null);
    router.push("/chat");
  };

  const isChatActive = pathname?.startsWith("/chat");

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-3 inset-x-3 z-40 mx-auto max-w-md md:hidden pointer-events-none"
    >
      <div className="pointer-events-auto h-16 rounded-2xl bg-background/85 dark:bg-card/85 backdrop-blur-xl border border-border/70 shadow-2xl shadow-black/10 dark:shadow-black/50 px-3 py-1 flex items-center justify-between">
        {/* First 2 items: Dashboard, Documents */}
        {NAV_ITEMS.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center min-w-[54px] py-1 px-2 rounded-xl text-xs font-medium transition-all duration-200 active:scale-95",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute -top-1.5 w-6 h-1 rounded-full bg-primary" />
              )}
              <Icon
                className={cn(
                  "size-5 transition-transform duration-200",
                  isActive && "scale-110"
                )}
              />
              <span className="text-[10px] mt-0.5 tracking-tight">
                {item.name}
              </span>
            </Link>
          );
        })}

        {/* Center Floating Action Button: New Chat (+) */}
        <div className="relative -top-4 flex flex-col items-center">
          <button
            type="button"
            onClick={handleNewChat}
            aria-label="Start New Chat"
            className={cn(
              "group relative flex size-13 items-center justify-center rounded-full text-white shadow-lg transition-all duration-300 active:scale-90 hover:scale-105",
              "bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-400 shadow-purple-500/35 dark:shadow-purple-900/50",
              isChatActive && "ring-4 ring-primary/30"
            )}
          >
            <Plus className="size-6 transition-transform duration-300 group-hover:rotate-90 group-active:rotate-180" />
            <span className="sr-only">New Chat</span>
          </button>
          <span
            className={cn(
              "text-[10px] font-medium mt-1 tracking-tight",
              isChatActive ? "text-primary font-semibold" : "text-muted-foreground"
            )}
          >
            New Chat
          </span>
        </div>

        {/* Last 2 items: Artifacts, Settings */}
        {NAV_ITEMS.slice(2).map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center min-w-[54px] py-1 px-2 rounded-xl text-xs font-medium transition-all duration-200 active:scale-95",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute -top-1.5 w-6 h-1 rounded-full bg-primary" />
              )}
              <Icon
                className={cn(
                  "size-5 transition-transform duration-200",
                  isActive && "scale-110"
                )}
              />
              <span className="text-[10px] mt-0.5 tracking-tight">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileNav;
