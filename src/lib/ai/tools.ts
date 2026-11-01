import { z } from "zod";
import { tool } from "ai";

/**
 * AI tool for generating a new document artifact.
 */
export const generateDocumentTool = tool({
  description:
    "Generate a new document (DOCX, PDF, Markdown) based on the user's instructions. Use this when the user asks you to create, write, or draft a document.",
  inputSchema: z.object({
    title: z.string().describe("The document title"),
    content: z
      .string()
      .describe("The full document content in Markdown format"),
    format: z
      .enum(["markdown", "docx", "pdf"])
      .describe("The target document format"),
  }),
  execute: async (args: { title: string; content: string; format: "markdown" | "docx" | "pdf" }) => {
    // This is handled by the artifact generation pipeline.
    // The tool call result is intercepted by the chat route handler.
    return {
      action: "generate_document",
      title: args.title,
      content: args.content,
      format: args.format,
      status: "queued",
    };
  },
});

/**
 * AI tool for generating a spreadsheet artifact.
 */
export const generateSpreadsheetTool = tool({
  description:
    "Generate a new spreadsheet (XLSX, CSV) based on the user's data or instructions. Use this when the user asks you to create a spreadsheet, table, or data export.",
  inputSchema: z.object({
    title: z.string().describe("The spreadsheet title"),
    sheets: z
      .array(
        z.object({
          name: z.string().describe("Sheet name"),
          headers: z.array(z.string()).describe("Column headers"),
          rows: z
            .array(z.array(z.string()))
            .describe("Row data as string arrays"),
        }),
      )
      .describe("Array of sheet definitions"),
    format: z
      .enum(["xlsx", "csv"])
      .describe("The target spreadsheet format"),
  }),
  execute: async (args: {
    title: string;
    sheets: Array<{ name: string; headers: string[]; rows: string[][] }>;
    format: "xlsx" | "csv";
  }) => {
    return {
      action: "generate_spreadsheet",
      title: args.title,
      sheets: args.sheets,
      format: args.format,
      status: "queued",
    };
  },
});

/**
 * AI tool for converting a document to another format.
 */
export const convertDocumentTool = tool({
  description:
    "Convert an existing document to a different format. Use this when the user asks to convert a file.",
  inputSchema: z.object({
    documentId: z
      .string()
      .describe("The ID of the document to convert"),
    targetFormat: z
      .enum(["pdf", "docx", "markdown", "html", "csv", "xlsx"])
      .describe("The target format to convert to"),
  }),
  execute: async (args: {
    documentId: string;
    targetFormat: "pdf" | "docx" | "markdown" | "html" | "csv" | "xlsx";
  }) => {
    return {
      action: "convert_document",
      documentId: args.documentId,
      targetFormat: args.targetFormat,
      status: "queued",
    };
  },
});

/**
 * All available tools for document workspace conversations.
 */
export const workspaceTools = {
  generateDocument: generateDocumentTool,
  generateSpreadsheet: generateSpreadsheetTool,
  convertDocument: convertDocumentTool,
};
