import type { ExtractionResult } from "@/types/documents";
import { pdfExtractor } from "./extractors/pdf";
import { docxExtractor } from "./extractors/docx";
import { xlsxExtractor } from "./extractors/xlsx";
import { csvExtractor } from "./extractors/csv";
import { textExtractor } from "./extractors/text";
import { imageExtractor } from "./extractors/image";
import type { DocumentExtractor } from "@/types/documents";

import { DocumentProcessingError } from "@/lib/utils/errors";

/**
 * Registry of format-specific document extractors.
 * Each extractor handles a set of MIME types and returns
 * structured text content + metadata.
 */
const extractors: DocumentExtractor[] = [
  pdfExtractor,
  docxExtractor,
  xlsxExtractor,
  csvExtractor,
  textExtractor,
  imageExtractor,
];

/**
 * Finds the appropriate extractor for a given MIME type.
 */
function getExtractor(mimeType: string): DocumentExtractor | null {
  return (
    extractors.find((ext) => ext.supportedMimeTypes.includes(mimeType)) ?? null
  );
}

/**
 * Processes a document buffer: validates, extracts text, and returns structured content.
 * This is the main entry point called by the document processing worker.
 */
export async function processDocument(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<ExtractionResult> {
  const extractor = getExtractor(mimeType);

  if (!extractor) {
    throw new DocumentProcessingError(
      `No extractor available for MIME type: ${mimeType} (file: ${fileName})`,
      "PDF_UNSUPPORTED",
      415
    );
  }

  const result = await extractor.extract(buffer, mimeType);

  if (!result.text || !result.text.trim()) {
    throw new DocumentProcessingError(
      `No extractable text found in "${fileName}". Scanned PDFs or image-only documents require OCR which is currently unsupported.`,
      "PDF_NO_EXTRACTABLE_TEXT",
      422
    );
  }

  // Ensure word count is calculated
  if (!result.wordCount && result.text) {
    result.wordCount = result.text
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  return result;
}

/**
 * Returns whether a given MIME type can be processed.
 */
export function canProcess(mimeType: string): boolean {
  return getExtractor(mimeType) !== null;
}
