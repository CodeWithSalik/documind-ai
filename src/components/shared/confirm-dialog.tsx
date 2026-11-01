"use client"

import * as React from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  isLoading?: boolean
  onConfirm: () => void | Promise<void>
  children?: React.ReactNode
}

/**
 * Accessible confirmation modal dialog built with shadcn Dialog primitives
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  isLoading = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = React.useState(false)
  const isBusy = isLoading || internalLoading

  const handleConfirm = async () => {
    try {
      const result = onConfirm()
      if (result instanceof Promise) {
        setInternalLoading(true)
        await result
      }
    } finally {
      setInternalLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={isBusy ? () => {} : onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={!isBusy}
      >
        <DialogHeader className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {destructive && (
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive ring-6 ring-destructive/5"
                aria-hidden="true"
              >
                <AlertTriangle className="size-5" />
              </div>
            )}
            <DialogTitle className="text-base font-semibold leading-normal">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        {children && <div className="py-2">{children}</div>}

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={isBusy}
            onClick={handleConfirm}
            className={cn("gap-2", destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
          >
            {isBusy && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
