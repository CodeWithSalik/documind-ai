"use client"

import * as React from "react"
import { type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface EmptyStateAction {
  label: string
  onClick: () => void
  icon?: LucideIcon
}

export interface EmptyStateSecondaryAction {
  label: string
  onClick: () => void
}

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: EmptyStateAction
  secondaryAction?: EmptyStateSecondaryAction
  variant?: "dashed" | "card" | "subtle"
  className?: string
  children?: React.ReactNode
}

/**
 * Re-usable empty state component with subtle radial glow,
 * soft colored icon container, and responsive layout.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "dashed",
  className,
  children,
}: EmptyStateProps) {
  const ActionIcon = action?.icon

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center p-8 text-center transition-all sm:p-12",
        variant === "dashed" &&
          "rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/20 hover:border-muted-foreground/30 hover:bg-muted/30",
        variant === "card" &&
          "rounded-2xl border border-border/60 bg-card/60 p-8 shadow-xs backdrop-blur-xs",
        variant === "subtle" && "rounded-2xl bg-transparent",
        className
      )}
    >
      {/* Subtle radial glow background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden rounded-2xl"
        aria-hidden="true"
      >
        <div className="h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Soft colored icon container with glow */}
      <div className="relative mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5 transition-transform duration-200 hover:scale-105">
        <Icon className="size-7" aria-hidden="true" />
      </div>

      {/* Title */}
      <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        {title}
      </h3>

      {/* Description */}
      <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed sm:text-base">
        {description}
      </p>

      {/* Actions */}
      {(action || secondaryAction || children) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action && (
            <Button
              onClick={action.onClick}
              size="default"
              className="gap-2 shadow-xs"
            >
              {ActionIcon && <ActionIcon className="size-4" />}
              {action.label}
            </Button>
          )}

          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              size="default"
            >
              {secondaryAction.label}
            </Button>
          )}

          {children}
        </div>
      )}
    </div>
  )
}
