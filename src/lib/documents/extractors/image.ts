import type { DocumentExtractor, ExtractionResult } from "@/types/documents";

/**
 * Image extractor placeholder.
 * In production, this will use Gemini Vision API to extract text from images.
 * For now, it stores basic metadata and marks the content for vision processing.
 */
export const imageExtractor: DocumentExtractor = {
  supportedMimeTypes: ["image/png", "image/jpeg", "image/webp"],

  async extract(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
    // TODO: Integrate Gemini Vision API for OCR/description
    // For now, return metadata-only result
    const sizeKB = Math.round(buffer.length / 1024);

    return {
      text: `[Image: ${mimeType}, ${sizeKB}KB - Visual content requires AI vision analysis]`,
      wordCount: 0,
      metadata: {
        format: mimeType.split("/")[1],
        sizeBytes: buffer.length,
        requiresVisionProcessing: true,
      },
    };
  },
};
