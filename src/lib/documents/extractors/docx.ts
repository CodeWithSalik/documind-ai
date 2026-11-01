import mammoth from "mammoth";
import type { DocumentExtractor, ExtractionResult } from "@/types/documents";

export const docxExtractor: DocumentExtractor = {
  supportedMimeTypes: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],

  async extract(buffer: Buffer): Promise<ExtractionResult> {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value || "";
    const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

    // Also extract structured HTML for richer representation
    const htmlResult = await mammoth.convertToHtml({ buffer });

    return {
      text,
      wordCount,
      metadata: {
        warnings: result.messages
          .filter((m) => m.type === "warning")
          .map((m) => m.message),
        hasHtml: htmlResult.value.length > 0,
      },
    };
  },
};
