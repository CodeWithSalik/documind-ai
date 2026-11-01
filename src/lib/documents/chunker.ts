import type { ChunkOptions } from "@/types/documents";
import { estimateTokenCount } from "@/lib/utils/format";

export interface TextChunk {
  content: string;
  index: number;
  pageNumber?: number;
  tokenCount: number;
}

const DEFAULT_MAX_TOKENS = 2000;
const DEFAULT_OVERLAP_TOKENS = 200;

/**
 * Splits extracted text into chunks suitable for AI context windows.
 * Uses heading-aware splitting for structured documents,
 * paragraph-based splitting for plain text.
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {},
  pages?: Array<{ pageNumber: number; content: string }>,
): TextChunk[] {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const overlapTokens = options.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  // If we have page-level content, chunk by page first
  if (pages && pages.length > 0) {
    return chunkByPages(pages, maxTokens, overlapTokens);
  }

  const strategy = options.strategy ?? detectStrategy(text);

  if (strategy === "single") {
    return [
      {
        content: text,
        index: 0,
        tokenCount: estimateTokenCount(text),
      },
    ];
  }

  // Split by headings if present, otherwise by paragraphs
  if (strategy === "heading") {
    return chunkByHeadings(text, maxTokens, overlapTokens);
  }

  return chunkByParagraphs(text, maxTokens, overlapTokens);
}

/**
 * Detects the best chunking strategy based on text structure.
 */
function detectStrategy(text: string): "heading" | "paragraph" | "single" {
  const tokenCount = estimateTokenCount(text);

  // Small documents: single chunk
  if (tokenCount <= DEFAULT_MAX_TOKENS) {
    return "single";
  }

  // Check for markdown/document headings
  const headingPattern = /^#{1,6}\s+/m;
  if (headingPattern.test(text)) {
    return "heading";
  }

  return "paragraph";
}

/**
 * Chunks text by heading boundaries.
 */
function chunkByHeadings(
  text: string,
  maxTokens: number,
  overlapTokens: number,
): TextChunk[] {
  const sections = text.split(/(?=^#{1,6}\s+)/m).filter((s) => s.trim());
  return mergeAndChunk(sections, maxTokens, overlapTokens);
}

/**
 * Chunks text by paragraph boundaries.
 */
function chunkByParagraphs(
  text: string,
  maxTokens: number,
  overlapTokens: number,
): TextChunk[] {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  return mergeAndChunk(paragraphs, maxTokens, overlapTokens);
}

/**
 * Chunks page-level content, respecting page boundaries.
 */
function chunkByPages(
  pages: Array<{ pageNumber: number; content: string }>,
  maxTokens: number,
  overlapTokens: number,
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let index = 0;

  for (const page of pages) {
    const pageContent = (page.content || "").trim();
    if (!pageContent) continue;

    const pageTokens = estimateTokenCount(pageContent);
    if (pageTokens <= maxTokens) {
      chunks.push({
        content: pageContent,
        index,
        pageNumber: page.pageNumber,
        tokenCount: pageTokens,
      });
      index++;
    } else {
      // Page exceeds token limit: split by paragraphs within this page
      const paragraphs = pageContent.split(/\n\n+/).filter((p) => p.trim());
      const subChunks = mergeAndChunk(paragraphs, maxTokens, overlapTokens);
      for (const sc of subChunks) {
        chunks.push({
          content: sc.content,
          index,
          pageNumber: page.pageNumber,
          tokenCount: sc.tokenCount,
        });
        index++;
      }
    }
  }

  return chunks;
}

/**
 * Merges small sections and splits large ones to produce chunks
 * within the token limit.
 */
function mergeAndChunk(
  sections: string[],
  maxTokens: number,
  overlapTokens: number,
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let currentContent = "";
  let index = 0;

  for (const section of sections) {
    const combined = currentContent
      ? `${currentContent}\n\n${section}`
      : section;

    if (estimateTokenCount(combined) > maxTokens && currentContent) {
      chunks.push({
        content: currentContent,
        index,
        tokenCount: estimateTokenCount(currentContent),
      });
      index++;

      const overlapText = getOverlapText(currentContent, overlapTokens);
      currentContent = overlapText + section;
    } else {
      currentContent = combined;
    }
  }

  if (currentContent.trim()) {
    chunks.push({
      content: currentContent,
      index,
      tokenCount: estimateTokenCount(currentContent),
    });
  }

  return chunks;
}

/**
 * Extracts the tail of a text block for overlap.
 */
function getOverlapText(text: string, overlapTokens: number): string {
  const targetChars = overlapTokens * 4; // ~4 chars per token
  if (text.length <= targetChars) return text;

  // Find a sentence boundary near the overlap point
  const tail = text.slice(-targetChars);
  const sentenceBreak = tail.indexOf(". ");
  if (sentenceBreak > 0 && sentenceBreak < targetChars * 0.5) {
    return tail.slice(sentenceBreak + 2);
  }
  return tail;
}
