import ExcelJS from "exceljs";
import type { DocumentExtractor, ExtractionResult } from "@/types/documents";

export const xlsxExtractor: DocumentExtractor = {
  supportedMimeTypes: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],

  async extract(buffer: Buffer): Promise<ExtractionResult> {
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);

    const sheets: string[] = [];
    const textParts: string[] = [];
    let totalRows = 0;

    workbook.eachSheet((worksheet) => {
      sheets.push(worksheet.name);
      const sheetLines: string[] = [`## Sheet: ${worksheet.name}`];

      worksheet.eachRow((row, rowNumber) => {
        totalRows++;
        const values = row.values as (string | number | boolean | null | undefined)[];
        // row.values is 1-indexed, first element is undefined
        const cells = values
          .slice(1)
          .map((v) => (v !== null && v !== undefined ? String(v) : ""));
        if (rowNumber === 1) {
          // Header row
          sheetLines.push(`| ${cells.join(" | ")} |`);
          sheetLines.push(`| ${cells.map(() => "---").join(" | ")} |`);
        } else {
          sheetLines.push(`| ${cells.join(" | ")} |`);
        }
      });

      textParts.push(sheetLines.join("\n"));
    });

    const text = textParts.join("\n\n");
    const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

    return {
      text,
      wordCount,
      metadata: {
        sheets,
        sheetCount: sheets.length,
        totalRows,
      },
    };
  },
};
