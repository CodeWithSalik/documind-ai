import * as React from "react"
import { cn } from "@/lib/utils"

export interface SkeletonProps extends React.ComponentProps<"div"> {
  className?: string
}

/**
 * Base skeleton element with pulse animation
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      {...props}
    />
  )
}

/**
 * Skeleton loader for Document Cards in grid or list layouts
 */
export function DocumentCardSkeleton({
  count = 1,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      role="status"
      aria-label="Loading documents"
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
    >
      <span className="sr-only">Loading documents, please wait...</span>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`doc-skeleton-${index}`}
          className="flex flex-col gap-4 rounded-xl border border-border/50 bg-card p-5 shadow-xs"
        >
          {/* Header with icon and action placeholder */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="size-8 rounded-md" />
          </div>

          {/* Description snippet */}
          <div className="space-y-2 py-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>

          {/* Footer metadata */}
          <div className="flex items-center justify-between border-t border-border/40 pt-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton loader for Chat Message Bubbles
 */
export function MessageBubbleSkeleton({
  count = 3,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      role="status"
      aria-label="Loading chat messages"
      className={cn("flex flex-col gap-6 p-4", className)}
    >
      <span className="sr-only">Loading messages, please wait...</span>
      {Array.from({ length: count }).map((_, index) => {
        const isUser = index % 2 === 1
        return (
          <div
            key={`msg-skeleton-${index}`}
            className={cn(
              "flex items-start gap-3",
              isUser ? "flex-row-reverse" : "flex-row"
            )}
          >
            {/* Avatar */}
            <Skeleton className="size-8 shrink-0 rounded-full" />

            {/* Message Bubble */}
            <div
              className={cn(
                "flex max-w-[80%] flex-col gap-2 rounded-2xl p-4 sm:max-w-[70%]",
                isUser
                  ? "rounded-tr-xs bg-primary/10"
                  : "rounded-tl-xs border border-border/50 bg-card shadow-xs"
              )}
            >
              <Skeleton
                className={cn(
                  "h-4",
                  isUser ? "w-40 sm:w-64" : "w-56 sm:w-80"
                )}
              />
              <Skeleton
                className={cn(
                  "h-4",
                  isUser ? "w-28 sm:w-44" : "w-48 sm:w-64"
                )}
              />
              {!isUser && <Skeleton className="h-4 w-36 sm:w-52" />}

              <div
                className={cn(
                  "mt-1 flex items-center gap-2",
                  isUser ? "justify-end" : "justify-start"
                )}
              >
                <Skeleton className="h-2.5 w-10" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Skeleton loader for Tabular Data
 */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div
      role="status"
      aria-label="Loading table data"
      className={cn(
        "w-full overflow-hidden rounded-xl border border-border/50 bg-card shadow-xs",
        className
      )}
    >
      <span className="sr-only">Loading table records, please wait...</span>

      {/* Table Header */}
      <div className="flex items-center border-b border-border/60 bg-muted/30 px-6 py-3.5">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <div
            key={`col-hdr-${colIndex}`}
            className="flex-1 first:flex-[1.5] last:flex-none last:w-20"
          >
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>

      {/* Table Body Rows */}
      <div className="divide-y divide-border/40">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="flex items-center px-6 py-4 transition-colors"
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={`cell-${rowIndex}-${colIndex}`}
                className="flex-1 first:flex-[1.5] last:flex-none last:w-20"
              >
                <Skeleton
                  className={cn(
                    "h-3.5",
                    colIndex === 0 && "w-3/4",
                    colIndex === 1 && "w-1/2",
                    colIndex === 2 && "w-2/3",
                    colIndex >= 3 && "w-16"
                  )}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Table Pagination Footer */}
      <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-6 py-3">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton loader for Dashboard Metric Cards
 */
export function DashboardMetricSkeleton({
  count = 4,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      role="status"
      aria-label="Loading dashboard metrics"
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      <span className="sr-only">Loading dashboard metrics, please wait...</span>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`metric-skeleton-${index}`}
          className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-5 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-12 rounded-full" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
