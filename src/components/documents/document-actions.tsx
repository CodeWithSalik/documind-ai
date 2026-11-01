"use client";

import * as React from "react";
import {
  MoreVertical,
  Eye,
  MessageSquarePlus,
  MessageSquareX,
  FileCode,
  FileSpreadsheet,
  FileText,
  Edit3,
  RotateCw,
  Trash2,
  FileType,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DocumentData } from "@/types/documents";

export interface DocumentActionsProps {
  document: DocumentData;
  isInChatContext?: boolean;
  onOpenPreview?: (document: DocumentData) => void;
  onToggleChatContext?: (documentId: string, inContext: boolean) => void;
  onConvert?: (documentId: string, targetFormat: string) => void;
  onRename?: (documentId: string, newName: string) => void;
  onReprocess?: (documentId: string) => void;
  onDelete?: (documentId: string) => void;
  trigger?: React.ReactNode;
  className?: string;
}

export function DocumentActions({
  document,
  isInChatContext = false,
  onOpenPreview,
  onToggleChatContext,
  onConvert,
  onRename,
  onReprocess,
  onDelete,
  trigger,
}: DocumentActionsProps) {
  const [isRenameOpen, setIsRenameOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [newName, setNewName] = React.useState(document.name);

  // Sync state if document prop changes
  const [prevName, setPrevName] = React.useState(document.name);
  if (prevName !== document.name) {
    setPrevName(document.name);
    setNewName(document.name);
  }

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (trimmed && trimmed !== document.name) {
      onRename?.(document.id, trimmed);
    }
    setIsRenameOpen(false);
  };

  const handleDeleteConfirm = () => {
    onDelete?.(document.id);
    setIsDeleteOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            trigger ? (
              (trigger as React.ReactElement)
            ) : (
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-7 rounded-md text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="size-4" />
                <span className="sr-only">Document actions</span>
              </Button>
            )
          }
        />

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Document Options</DropdownMenuLabel>

          {/* Inline Preview */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onOpenPreview?.(document);
            }}
          >
            <Eye className="size-4 mr-1 text-muted-foreground" />
            <span>Open preview</span>
          </DropdownMenuItem>

          {/* AI Chat Context Toggle */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onToggleChatContext?.(document.id, !isInChatContext);
            }}
          >
            {isInChatContext ? (
              <>
                <MessageSquareX className="size-4 mr-1 text-amber-500" />
                <span>Remove from Chat</span>
              </>
            ) : (
              <>
                <MessageSquarePlus className="size-4 mr-1 text-primary" />
                <span>Add to Chat Context</span>
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Format Conversion Submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileType className="size-4 mr-1 text-muted-foreground" />
              <span>Convert format</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onConvert?.(document.id, "pdf");
                }}
              >
                <FileText className="size-3.5 mr-1.5 text-red-500" />
                <span>To PDF (.pdf)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onConvert?.(document.id, "markdown");
                }}
              >
                <FileCode className="size-3.5 mr-1.5 text-amber-500" />
                <span>To Markdown (.md)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onConvert?.(document.id, "html");
                }}
              >
                <FileCode className="size-3.5 mr-1.5 text-blue-500" />
                <span>To HTML (.html)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onConvert?.(document.id, "csv");
                }}
              >
                <FileSpreadsheet className="size-3.5 mr-1.5 text-emerald-500" />
                <span>To CSV (.csv)</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Rename Document */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setIsRenameOpen(true);
            }}
          >
            <Edit3 className="size-4 mr-1 text-muted-foreground" />
            <span>Rename document</span>
          </DropdownMenuItem>

          {/* Re-process Document */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onReprocess?.(document.id);
            }}
          >
            <RotateCw className="size-4 mr-1 text-muted-foreground" />
            <span>Re-process pipeline</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Delete Document */}
          <DropdownMenuItem
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              setIsDeleteOpen(true);
            }}
          >
            <Trash2 className="size-4 mr-1 text-destructive" />
            <span>Delete document</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent
          onClick={(e) => e.stopPropagation()}
          className="sm:max-w-md"
        >
          <form onSubmit={handleRenameSubmit}>
            <DialogHeader>
              <DialogTitle>Rename Document</DialogTitle>
              <DialogDescription>
                Update the display name of this document.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <label
                htmlFor="document-name"
                className="mb-1.5 block text-xs font-medium text-foreground"
              >
                File Name
              </label>
              <Input
                id="document-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                placeholder="Enter file name"
              />
            </div>

            <DialogFooter>
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsRenameOpen(false)}
                  >
                    Cancel
                  </Button>
                }
              />
              <Button type="submit" disabled={!newName.trim() || newName.trim() === document.name}>
                <Check className="size-3.5 mr-1" />
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent
          onClick={(e) => e.stopPropagation()}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="size-5" />
              Delete Document
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong className="text-foreground">{document.name}</strong>?
              This will remove the file from storage and remove all associated AI
              chunks and embeddings.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDeleteOpen(false)}
                >
                  Cancel
                </Button>
              }
            />
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
