import _pdfParse from "pdf-parse";
import type { DocumentExtractor, ExtractionResult } from "@/types/documents";
import { DocumentProcessingError } from "@/lib/utils/errors";

type PdfParseFn = typeof _pdfParse;

// Handle both CJS and ESM interop across bundlers (Next.js Turbopack / Node runtime)
const pdfParse: PdfParseFn =
  typeof _pdfParse === "function"
    ? _pdfParse
    : ((_pdfParse as unknown as { default: PdfParseFn }).default ?? _pdfParse);

/**
 * Classifies an error thrown during PDF loading or parsing into standard error codes.
 */
function classifyPdfParseError(error: unknown): DocumentProcessingError {
  if (error instanceof DocumentProcessingError) {
    return error;
  }

  const errName = error instanceof Error ? error.name : "";
  const errMsg = error instanceof Error ? error.message : String(error);
  const lowerMsg = errMsg.toLowerCase();
  const lowerName = errName.toLowerCase();

  // 1. Password protected / encrypted documents
  if (
    lowerName.includes("password") ||
    lowerMsg.includes("password") ||
    lowerMsg.includes("encrypted")
  ) {
    return new DocumentProcessingError(
      `Password-protected PDFs are not supported: ${errMsg}`,
      "PDF_UNSUPPORTED",
      422,
      { originalError: errMsg }
    );
  }

  // 2. Unsupported PDF features / formats
  if (
    lowerMsg.includes("unsupported") ||
    lowerMsg.includes("xfa") ||
    lowerMsg.includes("form data")
  ) {
    return new DocumentProcessingError(
      `Unsupported PDF feature: ${errMsg}`,
      "PDF_UNSUPPORTED",
      422,
      { originalError: errMsg }
    );
  }

  // 3. Worker failures (kept for backwards compatibility if runtime issues occur)
  if (
    lowerMsg.includes("fake worker") ||
    lowerMsg.includes("worker was destroyed")
  ) {
    return new DocumentProcessingError(
      `PDF worker initialization failed: ${errMsg}`,
      "PDF_WORKER_INIT_FAILED",
      500,
      { originalError: errMsg }
    );
  }

  // 4. Structural or corrupt PDF parsing failure
  return new DocumentProcessingError(
    `Failed to parse PDF document structure: ${errMsg}`,
    "PDF_PARSE_FAILED",
    422,
    { originalError: errMsg }
  );
}

interface PdfPageData {
  pageIndex?: number;
  getTextContent: (options?: {
    normalizeWhitespace?: boolean;
    disableCombineTextItems?: boolean;
  }) => Promise<{
    items: Array<{
      str: string;
      transform: number[];
      [key: string]: unknown;
    }>;
  }>;
  [key: string]: unknown;
}

export const pdfExtractor: DocumentExtractor = {
  supportedMimeTypes: ["application/pdf"],

  async extract(buffer: Buffer): Promise<ExtractionResult> {
    const pages: Array<{ pageNumber: number; content: string }> = [];

    // Custom page render callback to collect per-page text content
    const customPagerender = async (pageData: PdfPageData): Promise<string> => {
      const pageNum =
        typeof pageData.pageIndex === "number"
          ? pageData.pageIndex + 1
          : pages.length + 1;

      const textContent = await pageData.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      });

      let lastY: number | undefined;
      let text = "";
      for (const item of textContent.items) {
        if (lastY === item.transform[5] || !lastY) {
          text += item.str;
        } else {
          text += "\n" + item.str;
        }
        lastY = item.transform[5];
      }

      const cleanedContent = text.trim();
      pages.push({
        pageNumber: pageNum,
        content: cleanedContent,
      });

      return text;
    };

    let result;
    try {
      result = await pdfParse(buffer, {
        pagerender: customPagerender,
      });
    } catch (parseError) {
      throw classifyPdfParseError(parseError);
    }

    const rawText = result.text || "";
    // Strip pagination delimiter banners like "-- 1 of 1 --" or "Page X of Y"
    const meaningfulText = rawText
      .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "")
      .replace(/Page\s+\d+\s+of\s+\d+/gi, "")
      .trim();

    const pageCount = result.numpages || pages.length || 1;

    // Only classify as scanned/image-only when parsing succeeded and pages loaded,
    // but the total extracted text across all pages is empty.
    if (meaningfulText.length === 0) {
      throw new DocumentProcessingError(
        `Document parsed successfully (${pageCount} page${pageCount === 1 ? "" : "s"}) but contains no extractable text. Scanned PDFs or image-only documents require OCR which is currently unsupported.`,
        "PDF_NO_EXTRACTABLE_TEXT",
        422,
        { pageCount }
      );
    }

    const wordCount = meaningfulText
      .split(/\s+/)
      .filter((w: string) => w.length > 0).length;

    // Sort pages by pageNumber to ensure sequential order
    pages.sort((a, b) => a.pageNumber - b.pageNumber);

    const info = (result.info || {}) as Record<string, unknown>;
    const title = (info.Title || info.title || undefined) as string | undefined;
    const author = (info.Author || info.author || undefined) as string | undefined;
    const subject = (info.Subject || info.subject || undefined) as string | undefined;
    const createdDate = (info.CreationDate || info.creationDate || info.createdDate || undefined) as string | undefined;

    return {
      text: rawText,
      pageCount,
      wordCount,
      pages,
      metadata: {
        title,
        author,
        subject,
        createdDate,
        pageCount,
        wordCount,
      },
    };
  },
};
