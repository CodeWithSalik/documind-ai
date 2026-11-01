"use client";

import * as React from "react";
import {
  User,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  ExternalLink,
  ChevronRight,
  Info,
  CheckCircle2,
  Clock,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MessageData, Citation, MessageRole } from "@/types/chat";
import type { AIToolCall } from "@/types/ai";

export interface MessageBubbleProps {
  message: MessageData;
  onRetry?: (messageId: string) => void;
  onCitationClick?: (citation: Citation) => void;
  onViewArtifact?: (artifactIdOrName: string) => void;
  isStreaming?: boolean;
  className?: string;
}

/**
 * Format timestamp into 12-hour local time (e.g. "2:30 PM").
 */
function formatTime(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Inline text parser for bold, italic, code, links.
 */
function renderInlineContent(text: string): React.ReactNode[] {
  // Regex to match code (`code`), bold (**bold**), italics (*italic*), and links [text](url)
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Inline code
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-primary"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italics
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={index} className="italic text-foreground/90">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Links: [label](url)
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-primary underline underline-offset-3 hover:text-primary/80"
        >
          {linkMatch[1]}
          <ExternalLink className="size-2.5 inline" />
        </a>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

/**
 * Custom CodeBlock component with copy functionality and syntax styling.
 */
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 overflow-hidden rounded-xl border border-border/80 bg-zinc-950 text-zinc-100 shadow-md">
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 px-3.5 py-1.5 text-xs">
        <span className="font-mono text-zinc-400">
          {language || "code"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={handleCopy}
          className="h-6 gap-1 px-2 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copy code</span>
            </>
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Custom Markdown parser supporting Headings, Lists, Tables, Code Blocks, and Blockquotes.
 */
function FormattedMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = "";

  let inTable = false;
  let tableRows: string[][] = [];

  let inList = false;
  let listItems: React.ReactNode[] = [];
  let isNumberedList = false;

  const flushList = () => {
    if (inList && listItems.length > 0) {
      if (isNumberedList) {
        elements.push(
          <ol
            key={`ol-${elements.length}`}
            className="my-2 ml-5 list-decimal space-y-1 text-sm leading-relaxed"
          >
            {listItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul
            key={`ul-${elements.length}`}
            className="my-2 ml-5 list-disc space-y-1 text-sm leading-relaxed"
          >
            {listItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        );
      }
      listItems = [];
      inList = false;
    }
  };

  const flushTable = () => {
    if (inTable && tableRows.length > 0) {
      const [headerRow, ...bodyRows] = tableRows;
      elements.push(
        <div
          key={`table-${elements.length}`}
          className="my-3 overflow-x-auto rounded-lg border border-border/70"
        >
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-border/80 bg-muted/60">
              <tr>
                {headerRow.map((col, idx) => (
                  <th key={idx} className="px-3 py-2 font-semibold">
                    {renderInlineContent(col.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {bodyRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="transition-colors hover:bg-muted/30 odd:bg-card even:bg-muted/10"
                >
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-muted-foreground">
                      {renderInlineContent(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block check
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <CodeBlock
            key={`code-${elements.length}`}
            code={codeBlockContent.join("\n")}
            language={codeBlockLang}
          />
        );
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockLang = "";
      } else {
        flushList();
        flushTable();
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Markdown Table check
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      flushList();
      // Skip markdown separator row like | --- | --- |
      if (/^\|[\s-:]+\|/.test(line.trim())) {
        continue;
      }
      const cols = line
        .trim()
        .slice(1, -1)
        .split("|");
      inTable = true;
      tableRows.push(cols);
      continue;
    } else {
      flushTable();
    }

    // Empty line
    if (!line.trim()) {
      flushList();
      continue;
    }

    // Heading 1
    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h1
          key={`h1-${elements.length}`}
          className="mt-4 mb-2 font-heading text-lg font-bold text-foreground first:mt-0 sm:text-xl"
        >
          {renderInlineContent(line.slice(2))}
        </h1>
      );
      continue;
    }

    // Heading 2
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2
          key={`h2-${elements.length}`}
          className="mt-3 mb-1.5 font-heading text-base font-semibold text-foreground first:mt-0 sm:text-lg"
        >
          {renderInlineContent(line.slice(3))}
        </h2>
      );
      continue;
    }

    // Heading 3
    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3
          key={`h3-${elements.length}`}
          className="mt-2.5 mb-1 font-heading text-sm font-semibold text-foreground first:mt-0 sm:text-base"
        >
          {renderInlineContent(line.slice(4))}
        </h3>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      flushList();
      elements.push(
        <blockquote
          key={`quote-${elements.length}`}
          className="my-2 border-l-2 border-primary/50 pl-3 italic text-muted-foreground text-sm"
        >
          {renderInlineContent(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (line.match(/^[\*\-]\s+/)) {
      if (!inList || isNumberedList) {
        flushList();
        inList = true;
        isNumberedList = false;
      }
      listItems.push(renderInlineContent(line.replace(/^[\*\-]\s+/, "")));
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\.\s+/)) {
      if (!inList || !isNumberedList) {
        flushList();
        inList = true;
        isNumberedList = true;
      }
      listItems.push(renderInlineContent(line.replace(/^\d+\.\s+/, "")));
      continue;
    }

    flushList();

    // Standard paragraph
    elements.push(
      <p
        key={`p-${elements.length}`}
        className="my-1 text-sm leading-relaxed text-foreground"
      >
        {renderInlineContent(line)}
      </p>
    );
  }

  flushList();
  flushTable();

  // If code block remains unclosed at the end of streaming
  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <CodeBlock
        key={`code-${elements.length}`}
        code={codeBlockContent.join("\n")}
        language={codeBlockLang}
      />
    );
  }

  return <div className="space-y-1">{elements}</div>;
}

/**
 * Tool Execution Card rendering details for document/spreadsheet generation or conversion.
 */
function ToolCallCard({
  toolCall,
  onViewArtifact,
}: {
  toolCall: AIToolCall;
  onViewArtifact?: (artifactIdOrName: string) => void;
}) {
  const { toolName, args, result } = toolCall;
  const isDocGen = toolName === "generateDocument";
  const isSheetGen = toolName === "generateSpreadsheet";
  const isConversion = toolName === "convertDocument";

  const title =
    (args?.title as string) ||
    (args?.documentId as string) ||
    "Generated Output";
  const format =
    (args?.format as string) ||
    (args?.targetFormat as string) ||
    "file";

  return (
    <div className="my-2.5 flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/40 p-3 shadow-2xs backdrop-blur-xs sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {isSheetGen ? (
            <FileSpreadsheet className="size-5 text-emerald-600 dark:text-emerald-400" />
          ) : isDocGen ? (
            <FileText className="size-5 text-blue-600 dark:text-blue-400" />
          ) : (
            <Wrench className="size-5 text-amber-600 dark:text-amber-400" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isDocGen
                ? "Document Generated"
                : isSheetGen
                  ? "Spreadsheet Generated"
                  : "Document Converted"}
            </span>
            <Badge variant="outline" className="h-4 uppercase text-[9px] font-mono">
              {format}
            </Badge>
          </div>
          <p className="truncate text-sm font-medium text-foreground">
            {title}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5" />
          <span className="font-medium">Ready</span>
        </div>

        {onViewArtifact && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onViewArtifact(title)}
            className="h-7 gap-1 rounded-md text-xs font-medium"
          >
            <span>View Artifact</span>
            <ChevronRight className="size-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * MessageBubble renders chat items with role styling, custom Markdown, citations,
 * tool cards, and message action controls.
 */
export function MessageBubble({
  message,
  onRetry,
  onCitationClick,
  onViewArtifact,
  isStreaming = false,
  className,
}: MessageBubbleProps) {
  const [copied, setCopied] = React.useState(false);
  const { role, content, metadata, createdAt, model, tokenCount } = message;

  const isUser = role === "user";
  const isSystem = role === "system";
  const isAssistant = role === "assistant";

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // System Messages are centered neutral alerts
  if (isSystem) {
    return (
      <div
        className={cn(
          "mx-auto my-3 flex max-w-md items-center justify-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground",
          className
        )}
      >
        <Info className="size-3.5 shrink-0" />
        <span>{content}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex w-full gap-3 py-3",
        isUser ? "flex-row-reverse" : "flex-row",
        className
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex size-8 shrink-0 select-none items-center justify-center rounded-xl font-medium shadow-2xs transition-all",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-primary shadow-xs"
        )}
      >
        {isUser ? (
          <User className="size-4" />
        ) : (
          <Sparkles className="size-4 text-primary" />
        )}
      </div>

      {/* Message Body Container */}
      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-1 sm:max-w-[75%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Header Metadata (Model name, time) */}
        <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
          {isAssistant && model && (
            <span className="font-semibold text-foreground/80">{model}</span>
          )}
          <span>{formatTime(createdAt)}</span>
          {tokenCount && (
            <span className="font-mono text-[10px]">
              • {tokenCount.toLocaleString()} tokens
            </span>
          )}
          {metadata?.processingTimeMs && (
            <span className="font-mono text-[10px]">
              • {(metadata.processingTimeMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>

        {/* Content Bubble */}
        <div
          className={cn(
            "relative rounded-2xl px-4 py-3 text-sm transition-all",
            isUser
              ? "rounded-tr-xs bg-primary text-primary-foreground shadow-xs"
              : "rounded-tl-xs border border-border/80 bg-card text-card-foreground shadow-xs"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
          ) : (
            <FormattedMarkdown content={content} />
          )}

          {/* Tool Calls executions if available */}
          {metadata?.toolCalls && metadata.toolCalls.length > 0 && (
            <div className="mt-2 space-y-1.5 border-t border-border/40 pt-2">
              {metadata.toolCalls.map((tc, idx) => (
                <ToolCallCard
                  key={idx}
                  toolCall={tc}
                  onViewArtifact={onViewArtifact}
                />
              ))}
            </div>
          )}

          {/* Citations references */}
          {metadata?.citations && metadata.citations.length > 0 && (
            <div className="mt-3 border-t border-border/40 pt-2">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Document Sources ({metadata.citations.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {metadata.citations.map((citation, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onCitationClick?.(citation)}
                    className="group/chip inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-foreground transition-all hover:border-primary/40 hover:bg-card"
                    title={citation.snippet || citation.documentName}
                  >
                    <FileText className="size-3 text-primary shrink-0" />
                    <span className="max-w-[130px] truncate font-medium">
                      {citation.documentName}
                    </span>
                    {citation.pageNumber ? (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        p.{citation.pageNumber}
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        chunk #{citation.chunkIndex}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons (Copy, Retry) */}
        {!isStreaming && (
          <div
            className={cn(
              "flex items-center gap-1 pt-0.5 opacity-0 transition-opacity group-hover:opacity-100",
              isUser ? "flex-row-reverse" : "flex-row"
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleCopy}
              className="text-muted-foreground hover:text-foreground"
              title="Copy message"
            >
              {copied ? (
                <Check className="size-3 text-emerald-500" />
              ) : (
                <Copy className="size-3" />
              )}
            </Button>

            {isAssistant && onRetry && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => onRetry(message.id)}
                className="text-muted-foreground hover:text-foreground"
                title="Retry response"
              >
                <RotateCcw className="size-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
