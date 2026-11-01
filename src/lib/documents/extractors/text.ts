import type { DocumentExtractor, ExtractionResult } from "@/types/documents";

export const textExtractor: DocumentExtractor = {
  supportedMimeTypes: [
    "text/plain",
    "text/markdown",
    "text/html",
    "application/json",
  ],

  async extract(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
    const text = buffer.toString("utf-8");
    const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
    const lineCount = text.split("\n").length;

    let format = "plain";
    if (mimeType === "text/markdown") format = "markdown";
    else if (mimeType === "text/html") format = "html";
    else if (mimeType === "application/json") format = "json";

    return {
      text,
      wordCount,
      metadata: {
        format,
        lineCount,
        encoding: "utf-8",
      },
    };
  },
};
