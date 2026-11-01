"use client"

import * as React from "react"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type ToastVariant =
  | "default"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "loading"

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  title?: string
  description?: React.ReactNode
  variant?: ToastVariant
  duration?: number
  action?: ToastAction
}

export interface ToastOptions {
  description?: React.ReactNode
  duration?: number
  action?: ToastAction
}

type ToastInput =
  | string
  | {
      title?: string
      description?: React.ReactNode
      variant?: ToastVariant
      duration?: number
      action?: ToastAction
    }

interface ToastContextValue {
  toasts: Toast[]
  toast: {
    (input: ToastInput): string
    success: (title: string, options?: ToastOptions) => string
    error: (title: string, options?: ToastOptions) => string
    warning: (title: string, options?: ToastOptions) => string
    info: (title: string, options?: ToastOptions) => string
    loading: (title: string, options?: ToastOptions) => string
    dismiss: (id?: string) => void
  }
  dismiss: (id?: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

// Singleton listener array for invoking toast from outside React tree
type ToastListener = (toast: Toast) => void
type DismissListener = (id?: string) => void

const toastListeners = new Set<ToastListener>()
const dismissListeners = new Set<DismissListener>()

function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function dispatchToast(toastItem: Toast) {
  toastListeners.forEach((listener) => listener(toastItem))
}

function dispatchDismiss(id?: string) {
  dismissListeners.forEach((listener) => listener(id))
}

/**
 * Global standalone toast function callable anywhere (components, hooks, event handlers)
 */
export const toast = Object.assign(
  function (input: ToastInput): string {
    const id = generateId()
    const item: Toast =
      typeof input === "string"
        ? { id, title: input, variant: "default" }
        : { id, variant: "default", ...input }
    dispatchToast(item)
    return id
  },
  {
    success: (title: string, options?: ToastOptions): string => {
      const id = generateId()
      dispatchToast({ id, title, variant: "success", ...options })
      return id
    },
    error: (title: string, options?: ToastOptions): string => {
      const id = generateId()
      dispatchToast({ id, title, variant: "error", ...options })
      return id
    },
    warning: (title: string, options?: ToastOptions): string => {
      const id = generateId()
      dispatchToast({ id, title, variant: "warning", ...options })
      return id
    },
    info: (title: string, options?: ToastOptions): string => {
      const id = generateId()
      dispatchToast({ id, title, variant: "info", ...options })
      return id
    },
    loading: (title: string, options?: ToastOptions): string => {
      const id = generateId()
      // Loading toasts stay visible until manually dismissed or replaced unless duration is provided
      dispatchToast({ id, title, variant: "loading", duration: 0, ...options })
      return id
    },
    dismiss: (id?: string) => {
      dispatchDismiss(id)
    },
  }
)

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    // If used outside ToastProvider, return the global singleton functions
    return {
      toasts: [],
      toast,
      dismiss: toast.dismiss,
    }
  }
  return context
}

/**
 * Toast Item Component
 */
function ToastItem({
  toastItem,
  onDismiss,
}: {
  toastItem: Toast
  onDismiss: (id: string) => void
}) {
  const { id, title, description, variant = "default", duration = 4000, action } = toastItem

  React.useEffect(() => {
    if (duration <= 0 || variant === "loading") return

    const timer = setTimeout(() => {
      onDismiss(id)
    }, duration)

    return () => clearTimeout(timer)
  }, [id, duration, variant, onDismiss])

  const icons: Record<ToastVariant, React.ReactNode> = {
    default: <Info className="size-5 text-primary" />,
    success: <CheckCircle2 className="size-5 text-emerald-500" />,
    error: <AlertCircle className="size-5 text-destructive" />,
    warning: <AlertTriangle className="size-5 text-amber-500" />,
    info: <Info className="size-5 text-primary" />,
    loading: <Loader2 className="size-5 text-primary animate-spin" />,
  }

  const borderVariants: Record<ToastVariant, string> = {
    default: "border-border/70",
    success: "border-emerald-500/30",
    error: "border-destructive/30",
    warning: "border-amber-500/30",
    info: "border-primary/30",
    loading: "border-primary/30",
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-card/95 p-4 text-card-foreground shadow-lg backdrop-blur-md transition-all duration-200 animate-in fade-in-0 slide-in-from-bottom-3",
        borderVariants[variant]
      )}
    >
      <div className="shrink-0 pt-0.5">{icons[variant]}</div>

      <div className="flex-1 space-y-1">
        {title && (
          <p className="text-sm font-semibold leading-tight text-foreground">
            {title}
          </p>
        )}
        {description && (
          <div className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </div>
        )}
        {action && (
          <button
            type="button"
            onClick={() => {
              action.onClick()
              onDismiss(id)
            }}
            className="mt-2 text-xs font-medium text-primary hover:underline underline-offset-2"
          >
            {action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(id)}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Close notification"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

/**
 * Toast Provider that renders the toast viewport container and exposes context
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const dismiss = React.useCallback((id?: string) => {
    setToasts((prev) => (id ? prev.filter((t) => t.id !== id) : []))
  }, [])

  const addToast = React.useCallback((newToast: Toast) => {
    setToasts((prev) => [...prev.slice(-4), newToast]) // keep max 5 toasts visible
  }, [])

  React.useEffect(() => {
    toastListeners.add(addToast)
    dismissListeners.add(dismiss)
    return () => {
      toastListeners.delete(addToast)
      dismissListeners.delete(dismiss)
    }
  }, [addToast, dismiss])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      {/* Toast Viewport Container */}
      <div
        aria-label="Notifications"
        role="region"
        className="pointer-events-none fixed bottom-0 right-0 z-50 flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-md sm:p-6"
      >
        {toasts.map((toastItem) => (
          <ToastItem
            key={toastItem.id}
            toastItem={toastItem}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
