import Papa from "papaparse";
import type { DocumentExtractor, ExtractionResult } from "@/types/documents";

export const csvExtractor: DocumentExtractor = {
  supportedMimeTypes: ["text/csv"],

  async extract(buffer: Buffer): Promise<ExtractionResult> {
    const csvString = buffer.toString("utf-8");

    const parsed = Papa.parse<string[]>(csvString, {
      header: false,
      skipEmptyLines: true,
    });

    const rows = parsed.data;
    if (rows.length === 0) {
      return {
        text: "",
        wordCount: 0,
        metadata: { rowCount: 0, columnCount: 0 },
      };
    }

    // Format as markdown table
    const headers = rows[0];
    const lines: string[] = [
      `| ${headers.join(" | ")} |`,
      `| ${headers.map(() => "---").join(" | ")} |`,
      ...rows.slice(1).map((row) => `| ${row.join(" | ")} |`),
    ];

    const text = lines.join("\n");
    const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

    return {
      text,
      wordCount,
      metadata: {
        rowCount: rows.length - 1, // Exclude header
        columnCount: headers.length,
        hasHeader: true,
      },
    };
  },
};
