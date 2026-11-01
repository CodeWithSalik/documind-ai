/**
 * Document format conversion service.
 * Converts between supported document formats.
 *
 * Note: Full implementation requires additional libraries (e.g., docx for DOCX generation,
 * puppeteer or similar for PDF generation). This file establishes the interface and
 * implements Markdown-based conversions.
 */

export type ConvertibleFormat = "markdown" | "html" | "pdf" | "docx" | "csv" | "xlsx";

export interface ConversionResult {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

const FORMAT_MIME_TYPES: Record<ConvertibleFormat, string> = {
  markdown: "text/markdown",
  html: "text/html",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const FORMAT_EXTENSIONS: Record<ConvertibleFormat, string> = {
  markdown: ".md",
  html: ".html",
  pdf: ".pdf",
  docx: ".docx",
  csv: ".csv",
  xlsx: ".xlsx",
};

/**
 * Converts markdown content to the target format.
 */
export async function convertFromMarkdown(
  markdownContent: string,
  targetFormat: ConvertibleFormat,
): Promise<ConversionResult> {
  switch (targetFormat) {
    case "markdown":
      return {
        buffer: Buffer.from(markdownContent, "utf-8"),
        mimeType: FORMAT_MIME_TYPES.markdown,
        extension: FORMAT_EXTENSIONS.markdown,
      };

    case "html":
      return convertMarkdownToHtml(markdownContent);

    case "pdf":
      // PDF generation will be implemented with a headless rendering library
      throw new Error("PDF conversion is not yet implemented");

    case "docx":
      // DOCX generation will be implemented with the `docx` package
      throw new Error("DOCX conversion is not yet implemented");

    default:
      throw new Error(`Unsupported target format: ${targetFormat}`);
  }
}

/**
 * Basic markdown to HTML conversion.
 * For production, replace with a proper Markdown parser (e.g., remark + rehype).
 */
function convertMarkdownToHtml(markdown: string): ConversionResult {
  // Simple markdown-to-HTML conversion for headings, bold, italic, code, lists
  const html = markdown
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith("<")) return match;
      return `<p>${match}</p>`;
    });

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
    h1, h2, h3 { margin-top: 1.5em; }
    code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
  </style>
</head>
<body>
${html}
</body>
</html>`;

  return {
    buffer: Buffer.from(fullHtml, "utf-8"),
    mimeType: FORMAT_MIME_TYPES.html,
    extension: FORMAT_EXTENSIONS.html,
  };
}

/**
 * Creates a CSV from structured data.
 */
export function createCsv(
  headers: string[],
  rows: string[][],
): ConversionResult {
  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];

  return {
    buffer: Buffer.from(lines.join("\n"), "utf-8"),
    mimeType: FORMAT_MIME_TYPES.csv,
    extension: FORMAT_EXTENSIONS.csv,
  };
}
