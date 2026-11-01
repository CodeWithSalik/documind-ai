import { createRequire } from "module";
import { pathToFileURL } from "url";
import { PDFParse } from "pdf-parse";
import type { DocumentExtractor, ExtractionResult } from "@/types/documents";
import { DocumentProcessingError } from "@/lib/utils/errors";

let workerInitPromise: Promise<void> | null = null;

/**
 * Initializes the PDF.js legacy worker for server-side execution.
 *
 * 1. Populates `globalThis.pdfjsWorker` with the WorkerMessageHandler from `pdfjs-dist/legacy/build/pdf.worker.mjs`.
 *    This allows PDF.js to run in-process fake worker without attempting runtime dynamic module resolution.
 * 2. Sets `PDFParse.setWorker(...)` to the absolute file URL of the legacy worker as a robust fallback.
 */
async function ensurePdfWorkerInitialized(): Promise<void> {
  if (workerInitPromise) {
    return workerInitPromise;
  }

  workerInitPromise = (async () => {
    try {
      // 1. Direct in-memory worker setup on globalThis.pdfjsWorker
      const g = globalThis as unknown as { pdfjsWorker?: { WorkerMessageHandler?: unknown } };
      if (!g.pdfjsWorker?.WorkerMessageHandler) {
        try {
          const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
          const handler =
            workerModule.WorkerMessageHandler ||
            (workerModule as unknown as { default?: { WorkerMessageHandler?: unknown } }).default?.WorkerMessageHandler;

          if (handler) {
            g.pdfjsWorker = {
              WorkerMessageHandler: handler,
            };
          }
        } catch {
          // Continue to resolve path-based fallback
        }
      }

      // 2. Set absolute file URL on PDFParse worker options
      try {
        const req = createRequire(import.meta.url);
        const workerPath = req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
        if (workerPath) {
          const workerUrl = pathToFileURL(workerPath).href;
          PDFParse.setWorker(workerUrl);
        }
      } catch {
        // Fallback to in-memory globalThis.pdfjsWorker
      }
    } catch (workerErr) {
      const msg = workerErr instanceof Error ? workerErr.message : String(workerErr);
      throw new DocumentProcessingError(
        `Failed to initialize PDF worker runtime: ${msg}`,
        "PDF_WORKER_INIT_FAILED",
        500
      );
    }
  })();

  return workerInitPromise;
}

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

  // 1. Worker failures (missing module, fake worker setup failures)
  if (
    lowerMsg.includes("fake worker") ||
    lowerMsg.includes("worker") ||
    lowerMsg.includes("cannot find module") ||
    lowerMsg.includes("worker was destroyed")
  ) {
    return new DocumentProcessingError(
      `PDF worker initialization failed: ${errMsg}`,
      "PDF_WORKER_INIT_FAILED",
      500,
      { originalError: errMsg }
    );
  }

  // 2. Password protected / encrypted documents
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

  // 3. Unsupported PDF features / formats
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

  // 4. Structural or corrupt PDF parsing failure
  return new DocumentProcessingError(
    `Failed to parse PDF document structure: ${errMsg}`,
    "PDF_PARSE_FAILED",
    422,
    { originalError: errMsg }
  );
}

export const pdfExtractor: DocumentExtractor = {
  supportedMimeTypes: ["application/pdf"],

  async extract(buffer: Buffer): Promise<ExtractionResult> {
    // Ensure the PDF worker runtime is initialized cleanly before parsing
    try {
      await ensurePdfWorkerInitialized();
    } catch (initErr) {
      throw classifyPdfParseError(initErr);
    }

    let parser: InstanceType<typeof PDFParse> | null = null;
    try {
      parser = new PDFParse({ data: buffer });
    } catch (instantiationErr) {
      throw classifyPdfParseError(instantiationErr);
    }

    try {
      const textResult = await parser.getText();
      let infoResult: Record<string, unknown> = {};
      try {
        infoResult = (await parser.getInfo()) as unknown as Record<string, unknown>;
      } catch {
        // ignore non-critical metadata extraction failure
      }

      const rawText = textResult.text || "";
      // Strip pagination delimiter banners like "-- 1 of 1 --" generated by pdf-parse
      const meaningfulText = rawText
        .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "")
        .replace(/Page\s+\d+\s+of\s+\d+/gi, "")
        .trim();

      const pageCount = textResult.total || 1;

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

      const pages = (textResult.pages || []).map(
        (p: { text: string; num: number }) => ({
          pageNumber: p.num,
          content: (p.text || "").trim(),
        }),
      );

      return {
        text: rawText,
        pageCount: textResult.total || pages.length || 1,
        wordCount,
        pages,
        metadata: {
          title: (infoResult?.title as string) || undefined,
          author: (infoResult?.author as string) || undefined,
          subject: (infoResult?.subject as string) || undefined,
          createdDate: (infoResult?.creationDate as string) || undefined,
          pageCount: textResult.total || pages.length || 1,
        },
      };
    } catch (parseError) {
      throw classifyPdfParseError(parseError);
    } finally {
      if (parser) {
        try {
          await parser.destroy();
        } catch {
          // Ignore destroy error
        }
      }
    }
  },
};
