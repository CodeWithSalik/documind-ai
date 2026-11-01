"use client";

import * as React from "react";
import { Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AIProvider } from "@/types/ai";

export interface StreamingIndicatorProps {
  modelName?: string;
  provider?: AIProvider;
  statusText?: string;
  startTime?: number;
  onStop?: () => void;
  className?: string;
}

/**
 * StreamingIndicator displays an animated thinking/reasoning state
 * with live elapsed timer, model badge, and optional cancel button.
 */
export function StreamingIndicator({
  modelName = "Gemini 1.5 Flash",
  statusText = "Reasoning...",
  startTime,
  onStop,
  className,
}: StreamingIndicatorProps) {
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const startRef = React.useRef(startTime ?? 0);

  // Initialize and reset timer in effect
  React.useEffect(() => {
    startRef.current = startTime || Date.now();
  }, [startTime]);

  // Update timer every 100ms for smooth 0.1s increments
  React.useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - startRef.current) / 1000;
      setElapsedSeconds(elapsed);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-2.5 shadow-xs backdrop-blur-md transition-all sm:w-fit",
        className
      )}
    >
      {/* Soft Shimmer glow bar on top */}
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-80" />

      {/* Model Icon with pulsing aura */}
      <div className="relative flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Sparkles className="size-3.5 animate-pulse text-blue-500" />
        <span className="absolute inset-0 rounded-lg bg-primary/20 animate-ping opacity-30" />
      </div>

      {/* Status & Model info */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="font-medium text-xs text-foreground sm:text-sm">
            {statusText}
          </span>

          {/* Three pulsing staggered dots */}
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
            <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
            <span className="size-1.5 rounded-full bg-primary animate-bounce" />
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground/80">{modelName}</span>
          <span>•</span>
          <span className="font-mono tabular-nums">
            {elapsedSeconds.toFixed(1)}s elapsed
          </span>
        </div>
      </div>

      {/* Stop generation button */}
      {onStop && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onStop}
          className="ml-2 h-6 gap-1 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="Stop response generation"
        >
          <Square className="size-2.5 fill-current" />
          Stop
        </Button>
      )}
    </div>
  );
}
