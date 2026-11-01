"use client";

import * as React from "react";
import {
  Sparkles,
  Zap,
  ChevronDown,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MODEL_REGISTRY,
  MODEL_IDS,
  DEFAULT_MODEL_ID,
  type ModelId,
} from "@/lib/ai/models";
import { cn } from "@/lib/utils";

export interface ModelSelectorProps {
  selectedModelId: ModelId | string;
  onSelectModel: (modelId: ModelId) => void;
  className?: string;
  size?: "sm" | "default";
  showQuickToggle?: boolean;
}

/**
 * Visual badge for the AI provider.
 */
export function ProviderBadge({
  className,
}: {
  provider?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
      Google
    </span>
  );
}

/**
 * Tier badge: Standard vs Premium.
 */
export function TierBadge({
  tier,
  className,
}: {
  tier: "standard" | "premium";
  className?: string;
}) {
  if (tier === "premium") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "h-4 gap-0.5 border-amber-500/30 bg-amber-500/10 px-1 text-[10px] font-medium text-amber-600 dark:text-amber-400",
          className
        )}
      >
        <Sparkles className="size-2.5" />
        Premium
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-4 gap-0.5 border-border bg-muted/50 px-1 text-[10px] font-medium text-muted-foreground",
        className
      )}
    >
      <Zap className="size-2.5" />
      Standard
    </Badge>
  );
}

/**
 * Formats context size in tokens (e.g., 1_048_576 -> "1M tokens").
 */
function formatContextSize(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(0)}M tokens`;
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}k tokens`;
  }
  return `${tokens} tokens`;
}

/**
 * ModelSelector component allows users to switch between Google Gemini models,
 * view context window capabilities, and quick-toggle between fast and frontier tiers.
 */
export function ModelSelector({
  selectedModelId = DEFAULT_MODEL_ID,
  onSelectModel,
  className,
  size = "default",
  showQuickToggle = true,
}: ModelSelectorProps) {
  const currentModel =
    MODEL_REGISTRY[selectedModelId as ModelId] ||
    MODEL_REGISTRY[DEFAULT_MODEL_ID];

  // Quick switch cycles between available Gemini models
  const handleQuickSwitch = () => {
    if (selectedModelId === "gemini-1.5-flash") {
      onSelectModel("gemini-1.5-pro");
    } else if (selectedModelId === "gemini-1.5-pro") {
      onSelectModel("gemini-2.0-flash");
    } else {
      onSelectModel("gemini-1.5-flash");
    }
  };

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size={size === "sm" ? "xs" : "sm"}
              className="group gap-2 border-border/80 bg-background/80 font-normal hover:bg-muted/70 hover:border-primary/40 shadow-2xs"
            />
          }
        >
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-blue-500" />
            <span className="font-medium text-foreground">
              {currentModel.displayName}
            </span>
          </div>

          <TierBadge tier={currentModel.tier} className="hidden sm:inline-flex" />

          <ChevronDown className="size-3.5 text-muted-foreground transition-transform duration-200 group-hover:text-foreground group-data-popup-open:rotate-180" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="w-80 p-2 shadow-xl backdrop-blur-md"
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Select AI Intelligence Model
            </span>
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
          </div>

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuGroup>
            {MODEL_IDS.map((id) => {
              const model = MODEL_REGISTRY[id];
              const isSelected = selectedModelId === id;

              return (
                <DropdownMenuItem
                  key={id}
                  onClick={() => onSelectModel(id)}
                  className={cn(
                    "flex flex-col items-start gap-1 p-2.5 rounded-lg cursor-pointer transition-colors",
                    isSelected
                      ? "bg-primary/10 text-primary focus:bg-primary/15"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {model.displayName}
                      </span>
                      <ProviderBadge provider={model.provider} />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <TierBadge tier={model.tier} />
                      {isSelected && (
                        <Check className="size-4 text-primary ml-1" />
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {model.description}
                  </p>

                  <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Context: {formatContextSize(model.contextWindow)}
                    </span>
                    <span>•</span>
                    <span>Max out: {formatContextSize(model.maxOutputTokens)}</span>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Quick-Switch Toggle between fast and reasoning models */}
      {showQuickToggle && (
        <Button
          type="button"
          variant="ghost"
          size={size === "sm" ? "icon-xs" : "icon-sm"}
          onClick={handleQuickSwitch}
          className="text-muted-foreground hover:text-foreground hover:bg-muted"
          title={`Quick cycle to next model (current: ${currentModel.displayName})`}
          aria-label="Quick-switch AI model"
        >
          <Zap className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
