"use client"

import * as React from "react"
import { AlertCircle, ChevronDown, ChevronRight, Copy, Check, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary?: () => void
  className?: string
}

/**
 * Visual error card with collapsible diagnostic details and retry action
 */
export function ErrorFallback({
  error,
  resetErrorBoundary,
  className,
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      const details = `${error.name}: ${error.message}\n\nStack:\n${error.stack || "No stack trace available"}`
      await navigator.clipboard.writeText(details)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore clipboard write failure
    }
  }

  return (
    <div className={cn("flex w-full items-center justify-center p-4 sm:p-6", className)}>
      <Card className="w-full max-w-xl border-destructive/20 bg-card/95 shadow-lg backdrop-blur-xs">
        <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive ring-6 ring-destructive/5">
            <AlertCircle className="size-6" aria-hidden="true" />
          </div>
          <div className="flex-1 space-y-1">
            <CardTitle className="text-lg font-semibold text-foreground">
              An unexpected error occurred
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              We encountered an issue while rendering this section. You can try refreshing
              it or contact support if the problem persists.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          {/* Error Message Snippet */}
          <div className="rounded-lg border border-destructive/15 bg-destructive/5 p-3 text-sm text-destructive font-mono break-all">
            {error.message || "Unknown application error"}
          </div>

          {/* Collapsible Error Details Accordion */}
          <div className="rounded-lg border border-border/60 bg-muted/30">
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              aria-expanded={showDetails}
            >
              <span className="flex items-center gap-1.5">
                {showDetails ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
                Technical Details & Stack Trace
              </span>
              <span className="text-[11px] opacity-75">
                {showDetails ? "Hide" : "Show"}
              </span>
            </button>

            {showDetails && (
              <div className="relative border-t border-border/50 p-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={handleCopy}
                  className="absolute right-2 top-2 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {copied ? (
                    <>
                      <Check className="size-3 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
                <pre className="max-h-48 overflow-auto pr-16 text-[11px] leading-relaxed text-muted-foreground font-mono">
                  {error.stack || "No additional stack trace information available."}
                </pre>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-end gap-2 border-t border-border/40 bg-muted/20 px-6 py-3">
          {resetErrorBoundary && (
            <Button
              onClick={resetErrorBoundary}
              variant="default"
              size="sm"
              className="gap-2"
            >
              <RotateCcw className="size-3.5" />
              Try again
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

export interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?:
    | React.ReactNode
    | ((props: { error: Error; resetErrorBoundary: () => void }) => React.ReactNode)
  onReset?: () => void
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * React Error Boundary class component that catches rendering errors
 * in child tree and presents an accessible, graceful fallback UI.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    } else {
      console.error("ErrorBoundary caught an unhandled error:", error, errorInfo)
    }
  }

  resetErrorBoundary = (): void => {
    if (this.props.onReset) {
      this.props.onReset()
    }
    this.setState({ hasError: false, error: null })
  }

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback({
          error: this.state.error,
          resetErrorBoundary: this.resetErrorBoundary,
        })
      }

      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <ErrorFallback
          error={this.state.error}
          resetErrorBoundary={this.resetErrorBoundary}
        />
      )
    }

    return this.props.children
  }
}
