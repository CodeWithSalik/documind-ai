import { SUPPORTED_MIME_TYPES, MAX_FILE_SIZE_BYTES, type SupportedMimeType } from "@/types/documents";

/**
 * File extension to MIME type mapping.
 */
const EXTENSION_MIME_MAP: Record<string, SupportedMimeType> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".html": "text/html",
  ".htm": "text/html",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/**
 * Validates that a MIME type is supported.
 */
export function isSupportedMimeType(mimeType: string): mimeType is SupportedMimeType {
  return (SUPPORTED_MIME_TYPES as string[]).includes(mimeType);
}

/**
 * Gets the expected MIME type from a file extension.
 */
export function getMimeTypeFromExtension(filename: string): SupportedMimeType | null {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!ext) return null;
  return EXTENSION_MIME_MAP[ext] ?? null;
}

/**
 * Validates file size against the maximum limit.
 */
export function isFileSizeValid(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_FILE_SIZE_BYTES;
}

/**
 * Sanitizes a filename by removing path traversal characters and unsafe characters.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\]/g, "")           // Remove path separators
    .replace(/\.\./g, "")            // Remove path traversal
    .replace(/[<>:"|?*\x00-\x1f]/g, "") // Remove unsafe characters
    .trim()
    .slice(0, 255);                   // Limit length
}

/**
 * Generates a unique storage key for an uploaded file.
 */
export function generateStorageKey(
  workspaceId: string,
  documentId: string,
  filename: string,
): string {
  const sanitized = sanitizeFilename(filename);
  return `workspaces/${workspaceId}/documents/${documentId}/${sanitized}`;
}

/**
 * Generates a storage key for an artifact.
 */
export function generateArtifactStorageKey(
  workspaceId: string,
  artifactId: string,
  filename: string,
): string {
  const sanitized = sanitizeFilename(filename);
  return `workspaces/${workspaceId}/artifacts/${artifactId}/${sanitized}`;
}

/**
 * Returns a human-readable file type label.
 */
export function getFileTypeLabel(mimeType: string): string {
  const labels: Record<string, string> = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "text/csv": "CSV",
    "text/plain": "TXT",
    "text/markdown": "MD",
    "text/html": "HTML",
    "application/json": "JSON",
    "image/png": "PNG",
    "image/jpeg": "JPG",
    "image/webp": "WebP",
  };
  return labels[mimeType] ?? "File";
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  detectedMime?: string;
}

/**
 * Validates a file buffer against binary signatures (magic numbers) and rejects executables / malformed headers.
 */
export function validateFileBuffer(
  buffer: Buffer,
  filename: string,
  declaredMimeType?: string
): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: "File buffer is empty" };
  }

  // 1. Immediately reject known binary executable signatures
  // Windows DOS/PE executable ("MZ")
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { isValid: false, error: "Executable files (Windows PE/MZ) are forbidden." };
  }
  // Linux ELF executable ("\x7fELF")
  if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return { isValid: false, error: "Executable files (Linux ELF) are forbidden." };
  }
  // Mach-O / Java bytecode binaries
  if (buffer.length >= 4) {
    const magic32 = buffer.readUInt32BE(0);
    if (
      magic32 === 0xcafe_babe || // Java class or Mach-O fat binary
      magic32 === 0xfeed_face || // Mach-O 32-bit
      magic32 === 0xfeed_facf || // Mach-O 64-bit
      magic32 === 0xcefa_edfe || // Mach-O 32-bit reverse
      magic32 === 0xcffa_edfe    // Mach-O 64-bit reverse
    ) {
      return { isValid: false, error: "Binary executable files are forbidden." };
    }
  }

  // Determine expected extension and declared MIME
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  const expectedMime = (declaredMimeType && declaredMimeType !== "application/octet-stream")
    ? declaredMimeType
    : (ext ? EXTENSION_MIME_MAP[ext] : null);

  // 2. Validate PDF signature: must contain "%PDF" within first 1024 bytes
  if (ext === ".pdf" || expectedMime === "application/pdf") {
    const headerSlice = buffer.subarray(0, Math.min(1024, buffer.length)).toString("latin1");
    if (!headerSlice.includes("%PDF")) {
      return { isValid: false, error: "Invalid PDF file: Missing %PDF header signature." };
    }
    return { isValid: true, detectedMime: "application/pdf" };
  }

  // 3. Validate PNG signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (ext === ".png" || expectedMime === "image/png") {
    if (
      buffer.length < 8 ||
      buffer[0] !== 0x89 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x4e ||
      buffer[3] !== 0x47 ||
      buffer[4] !== 0x0d ||
      buffer[5] !== 0x0a ||
      buffer[6] !== 0x1a ||
      buffer[7] !== 0x0a
    ) {
      return { isValid: false, error: "Invalid PNG file: Missing PNG signature." };
    }
    return { isValid: true, detectedMime: "image/png" };
  }

  // 4. Validate JPEG signature: starts with [0xff, 0xd8, 0xff]
  if (ext === ".jpg" || ext === ".jpeg" || expectedMime === "image/jpeg") {
    if (
      buffer.length < 3 ||
      buffer[0] !== 0xff ||
      buffer[1] !== 0xd8 ||
      buffer[2] !== 0xff
    ) {
      return { isValid: false, error: "Invalid JPEG file: Missing JPEG SOI marker." };
    }
    return { isValid: true, detectedMime: "image/jpeg" };
  }

  // 5. Validate WebP signature: "RIFF" .... "WEBP"
  if (ext === ".webp" || expectedMime === "image/webp") {
    if (
      buffer.length < 12 ||
      buffer.subarray(0, 4).toString("latin1") !== "RIFF" ||
      buffer.subarray(8, 12).toString("latin1") !== "WEBP"
    ) {
      return { isValid: false, error: "Invalid WebP file: Missing RIFF/WEBP signature." };
    }
    return { isValid: true, detectedMime: "image/webp" };
  }

  // 6. Validate DOCX / XLSX: ZIP container starting with [0x50, 0x4b]
  if (
    ext === ".docx" ||
    ext === ".xlsx" ||
    expectedMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    expectedMime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return { isValid: false, error: "Invalid Office OpenXML file: Missing ZIP archive signature." };
    }
    return { isValid: true, detectedMime: expectedMime || (ext === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") };
  }

  // 7. Validate Text / CSV / Markdown / HTML / JSON: must not contain binary null bytes in first 512 bytes
  if (
    ext === ".txt" ||
    ext === ".md" ||
    ext === ".csv" ||
    ext === ".html" ||
    ext === ".htm" ||
    ext === ".json" ||
    expectedMime?.startsWith("text/") ||
    expectedMime === "application/json"
  ) {
    const checkLength = Math.min(512, buffer.length);
    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0x00) {
        return { isValid: false, error: "Binary data or null bytes detected in plaintext file." };
      }
    }
    return { isValid: true, detectedMime: expectedMime || "text/plain" };
  }

  return { isValid: true, detectedMime: expectedMime || declaredMimeType || "application/octet-stream" };
}
