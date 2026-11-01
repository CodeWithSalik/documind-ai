"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Menu,
  Search,
  Sparkles,
  Zap,
  Sun,
  Moon,
  Monitor,
  Check,
  User,
  LogOut,
  Settings,
  HelpCircle,
  Keyboard,
  ChevronDown,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useModelSelection } from "@/hooks/use-model-selection";
import { useKeyboardShortcut } from "@/hooks/use-keyboard";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { MODEL_REGISTRY, type ModelId } from "@/lib/ai/models";

const AVAILABLE_MODELS: {
  id: ModelId;
  name: string;
  provider: "Google";
  tier: "standard" | "premium";
  badge: string;
  contextDesc: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}[] = [
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    provider: "Google",
    tier: "standard",
    badge: "Fast & Smart",
    contextDesc: "1M Context",
    icon: Zap,
    iconColor: "text-blue-500 dark:text-blue-400",
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "Google",
    tier: "premium",
    badge: "Deep Reasoning",
    contextDesc: "2M Context",
    icon: Sparkles,
    iconColor: "text-purple-500 dark:text-purple-400",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    tier: "standard",
    badge: "Next-Gen",
    contextDesc: "1M Context",
    icon: Zap,
    iconColor: "text-sky-500 dark:text-sky-400",
  },
];

export function Header() {
  const router = useRouter();

  // UI Store state & actions
  const setSidebarMobileOpen = useUIStore((state) => state.setSidebarMobileOpen);
  const setCommandPaletteOpen = useUIStore((state) => state.setCommandPaletteOpen);
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);

  // Model selection
  const { modelId, setModelId } = useModelSelection();

  // Listen for Cmd+K / Ctrl+K
  useKeyboardShortcut({ key: "k", ctrl: true }, () => {
    setCommandPaletteOpen(true);
  });
  useKeyboardShortcut({ key: "k", meta: true }, () => {
    setCommandPaletteOpen(true);
  });

  // Apply theme class to <html>
  const handleThemeChange = React.useCallback(
    (newTheme: "light" | "dark" | "system") => {
      setTheme(newTheme);
      if (typeof window === "undefined") return;

      const isDark =
        newTheme === "dark" ||
        (newTheme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);

      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    },
    [setTheme]
  );

  // Sync theme on mount
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const activeModelMeta =
    AVAILABLE_MODELS.find((m) => m.id === modelId) || AVAILABLE_MODELS[0];
  const ActiveModelIcon = activeModelMeta.icon;

  const handleLogout = async () => {
    try {
      await signOut({ callbackUrl: "/login" });
    } catch {
      router.push("/login");
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 md:h-16 w-full items-center justify-between border-b border-border/60 bg-background/80 backdrop-blur-md px-3 sm:px-4 md:px-6 transition-colors">
      {/* Left: Mobile Menu Trigger + Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setSidebarMobileOpen(true)}
          className="inline-flex md:hidden size-9 items-center justify-center rounded-lg border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Open sidebar menu"
        >
          <Menu className="size-5" />
        </button>

        <div className="hidden sm:block min-w-0">
          <Breadcrumb />
        </div>
      </div>

      {/* Right: Search + Model Selector + Theme Toggle + User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Global Search / Cmd+K Trigger */}
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Global search (Command K)"
          className="group relative flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted/70 px-2.5 sm:px-3 text-xs text-muted-foreground hover:text-foreground transition-all duration-200 shadow-2xs"
        >
          <Search className="size-3.5 sm:size-4 shrink-0 transition-colors group-hover:text-primary" />
          <span className="hidden md:inline-block max-w-[140px] lg:max-w-none truncate">
            Search documents, chats...
          </span>
          <span className="hidden sm:inline-block md:hidden">Search...</span>
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border/70 bg-background/80 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>

        {/* AI Model Selector Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="group flex h-9 items-center gap-1.5 sm:gap-2 rounded-lg border border-border/60 bg-card/60 hover:bg-muted/60 px-2 sm:px-2.5 text-xs font-medium text-foreground transition-all duration-150 shadow-2xs cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Select AI Model"
          >
            <ActiveModelIcon
              className={cn("size-3.5 sm:size-4 shrink-0", activeModelMeta.iconColor)}
            />
            <span className="hidden sm:inline-block font-semibold">
              {activeModelMeta.name}
            </span>
            <span className="sm:hidden font-semibold">
              {activeModelMeta.name.replace("Gemini ", "")}
            </span>
            <Badge
              variant={activeModelMeta.tier === "premium" ? "default" : "secondary"}
              className="hidden lg:inline-flex text-[10px] h-4.5 px-1.5 font-semibold"
            >
              {activeModelMeta.tier === "premium" ? "Pro" : "Fast"}
            </Badge>
            <ChevronDown className="size-3 shrink-0 text-muted-foreground group-hover:text-foreground transition-transform group-data-popup-open:rotate-180" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-72 sm:w-80 p-1.5 rounded-xl border border-border/80 shadow-xl bg-popover"
          >
            <DropdownMenuLabel className="px-2.5 py-1.5 text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Select Active Intelligence</span>
              <span className="text-[10px] text-muted-foreground font-normal">
                DocuMind v2.5
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuGroup>
              {AVAILABLE_MODELS.map((item) => {
                const isSelected = item.id === modelId;
                const ItemIcon = item.icon;

                return (
                  <DropdownMenuItem
                    key={item.id}
                    onClick={() => setModelId(item.id)}
                    className={cn(
                      "flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors",
                      isSelected
                        ? "bg-accent text-accent-foreground font-medium"
                        : "hover:bg-muted/70 text-foreground"
                    )}
                  >
                    <div
                      className={cn(
                        "p-1.5 rounded-md shrink-0 mt-0.5",
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <ItemIcon className={cn("size-4", item.iconColor)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold leading-none truncate">
                          {item.name}
                        </span>
                        <Badge
                          variant={item.tier === "premium" ? "default" : "secondary"}
                          className="text-[9px] h-4 px-1 leading-none font-medium"
                        >
                          {item.badge}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        <span>{item.provider}</span>
                        <span>•</span>
                        <span>{item.contextDesc}</span>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="size-4 shrink-0 text-primary mt-1" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? (
              <Moon className="size-4 text-indigo-400" />
            ) : theme === "light" ? (
              <Sun className="size-4 text-amber-500" />
            ) : (
              <Monitor className="size-4" />
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-36 p-1 rounded-xl border border-border/80 shadow-lg bg-popover"
          >
            <DropdownMenuItem
              onClick={() => handleThemeChange("light")}
              className="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Sun className="size-3.5 text-amber-500" />
                <span>Light</span>
              </div>
              {theme === "light" && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => handleThemeChange("dark")}
              className="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Moon className="size-3.5 text-indigo-400" />
                <span>Dark</span>
              </div>
              {theme === "dark" && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => handleThemeChange("system")}
              className="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Monitor className="size-3.5" />
                <span>System</span>
              </div>
              {theme === "system" && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Profile Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="User Profile Menu"
          >
            <Avatar size="sm" className="size-8 border border-border/80 shadow-2xs">
              <AvatarImage src="/avatar-placeholder.png" alt="User Avatar" />
              <AvatarFallback className="bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-semibold text-xs">
                DM
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-56 p-1.5 rounded-xl border border-border/80 shadow-xl bg-popover"
          >
            {/* Header / User Info */}
            <div className="flex flex-col space-y-1 px-2 py-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold leading-none text-foreground truncate">
                  DocuMind Admin
                </p>
                <Badge variant="secondary" className="text-[9px] h-4 px-1">
                  PRO
                </Badge>
              </div>
              <p className="text-[11px] leading-none text-muted-foreground truncate">
                admin@documind.ai
              </p>
            </div>

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem
              onClick={() => router.push("/settings")}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md cursor-pointer"
            >
              <User className="size-3.5 text-muted-foreground" />
              <span>Account & Profile</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => router.push("/settings")}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md cursor-pointer"
            >
              <Settings className="size-3.5 text-muted-foreground" />
              <span>Workspace Settings</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Keyboard className="size-3.5 text-muted-foreground" />
                <span>Shortcuts</span>
              </div>
              <kbd className="text-[10px] text-muted-foreground font-mono">⌘K</kbd>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => window.open("https://docs.documind.ai", "_blank")}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md cursor-pointer"
            >
              <HelpCircle className="size-3.5 text-muted-foreground" />
              <span>Help & Docs</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem
              onClick={handleLogout}
              variant="destructive"
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md cursor-pointer text-destructive focus:bg-destructive/10"
            >
              <LogOut className="size-3.5" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default Header;
