import fs from "fs";
import path from "path";
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import {
  s3,
  BUCKET_NAME,
  getStorageMode,
  assertStorageConfig,
  StorageSecurityError,
  StorageError,
} from "./client";
import { NotFoundError } from "@/lib/utils/errors";

/**
 * Returns the resolved directory for local disk storage.
 * Configurable via LOCAL_STORAGE_DIR, defaulting to `<cwd>/.storage/documents`.
 */
export function getLocalStorageDir(): string {
  const customDir = process.env.LOCAL_STORAGE_DIR;
  if (customDir) {
    return path.resolve(/*turbopackIgnore: true*/ customDir);
  }
  return path.join(process.cwd(), ".storage", "documents");
}

/**
 * Sanitizes a storage key and strictly validates against directory traversal attacks.
 */
export function sanitizeStorageKey(key: string): string {
  if (!key || typeof key !== "string") {
    throw new StorageSecurityError("Storage key must be a non-empty string");
  }

  // Reject absolute paths, null bytes, or Windows drive indicators
  if (
    key.startsWith("/") ||
    key.startsWith("\\") ||
    /^[a-zA-Z]:/.test(key) ||
    key.includes("\0")
  ) {
    throw new StorageSecurityError(
      `Invalid storage key: absolute paths and illegal characters are forbidden: "${key}"`
    );
  }

  // Normalize slashes
  const cleaned = key.replace(/\\/g, "/");

  // Detect explicit traversal, null byte injection, or Windows drive indicators
  if (
    cleaned.includes("..") ||
    cleaned.includes(":")
  ) {
    throw new StorageSecurityError(
      `Invalid storage key: directory traversal or illegal characters detected in "${key}"`
    );
  }

  // Verify that path resolution does not escape the configured storage root
  const rootDir = getLocalStorageDir();
  const resolved = path.resolve(rootDir, cleaned);
  if (!resolved.startsWith(rootDir + path.sep) && resolved !== rootDir) {
    throw new StorageSecurityError(
      `Invalid storage key: resolved path escapes storage root "${key}"`
    );
  }

  return cleaned;
}

export function getLocalFilePath(sanitizedKey: string): string {
  return path.join(/*turbopackIgnore: true*/ getLocalStorageDir(), sanitizedKey);
}

async function ensureDirectoryExists(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
}

/**
 * Saves a file buffer to storage according to STORAGE_MODE.
 * - In local mode: persists to local disk.
 * - In remote mode (s3/r2): persists directly to object storage.
 *   Throws a deterministic StorageError if remote storage fails.
 */
export async function saveFile(
  storageKey: string,
  buffer: Buffer,
  contentType: string = "application/octet-stream"
): Promise<{ storageKey: string; sizeBytes: number }> {
  const safeKey = sanitizeStorageKey(storageKey);
  const mode = getStorageMode();

  if (mode === "local") {
    const localPath = getLocalFilePath(safeKey);
    await ensureDirectoryExists(localPath);
    await fs.promises.writeFile(/*turbopackIgnore: true*/ localPath, buffer);
    return { storageKey: safeKey, sizeBytes: buffer.length };
  }

  // Remote mode (s3 or r2)
  assertStorageConfig(mode);

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: safeKey,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    });
    await s3.send(command);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new StorageError(
      `Failed to upload file to ${mode.toUpperCase()} storage ("${safeKey}"): ${message}`,
      502,
      { storageKey: safeKey, mode, originalError: message }
    );
  }

  // Opportunistically cache to local disk if local directory is writable
  try {
    const localPath = getLocalFilePath(safeKey);
    await ensureDirectoryExists(localPath);
    await fs.promises.writeFile(/*turbopackIgnore: true*/ localPath, buffer);
  } catch {
    // Ephemeral disk write error can be safely ignored in remote mode
  }

  return { storageKey: safeKey, sizeBytes: buffer.length };
}

/**
 * Downloads a file buffer from storage according to STORAGE_MODE.
 */
export async function downloadFile(storageKey: string): Promise<Buffer> {
  const safeKey = sanitizeStorageKey(storageKey);
  const mode = getStorageMode();
  const localPath = getLocalFilePath(safeKey);

  if (mode === "local") {
    if (!fs.existsSync(/*turbopackIgnore: true*/ localPath)) {
      throw new NotFoundError("File in local storage", safeKey);
    }
    return await fs.promises.readFile(/*turbopackIgnore: true*/ localPath);
  }

  // Remote mode (s3 or r2)
  assertStorageConfig(mode);

  // Check local cache first for quick retrieval
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ localPath)) {
      return await fs.promises.readFile(/*turbopackIgnore: true*/ localPath);
    }
  } catch {
    // Proceed to remote retrieval
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: safeKey,
    });

    const response = await s3.send(command);

    if (!response.Body) {
      throw new StorageError(`Empty response body from ${mode.toUpperCase()} for key: ${safeKey}`, 502);
    }

    const chunks: Uint8Array[] = [];
    const stream = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    // Opportunistically cache locally
    try {
      await ensureDirectoryExists(localPath);
      await fs.promises.writeFile(/*turbopackIgnore: true*/ localPath, buffer);
    } catch {
      // Ignore cache write error
    }

    return buffer;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      ((error as { name: string }).name === "NoSuchKey" ||
        (error as { name: string }).name === "NotFound")
    ) {
      throw new NotFoundError(`File in ${mode.toUpperCase()} storage`, safeKey);
    }
    const message = error instanceof Error ? error.message : "Remote fetch failed";
    throw new StorageError(
      `Failed to download file from ${mode.toUpperCase()} storage ("${safeKey}"): ${message}`,
      502
    );
  }
}

/**
 * Deletes a file from storage according to STORAGE_MODE.
 */
export async function deleteFile(storageKey: string): Promise<void> {
  const safeKey = sanitizeStorageKey(storageKey);
  const mode = getStorageMode();
  const localPath = getLocalFilePath(safeKey);

  // Delete from local disk
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ localPath)) {
      await fs.promises.unlink(/*turbopackIgnore: true*/ localPath);
    }
  } catch {
    // Ignore if already deleted
  }

  if (mode === "local") {
    return;
  }

  // Remote mode
  assertStorageConfig(mode);

  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: safeKey,
    });
    await s3.send(command);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Remote deletion failed";
    throw new StorageError(
      `Failed to delete file from ${mode.toUpperCase()} storage ("${safeKey}"): ${message}`,
      502
    );
  }
}

/**
 * Checks if a file exists in storage and returns its metadata.
 */
export async function getFileMetadata(
  storageKey: string
): Promise<{ exists: boolean; sizeBytes?: number; contentType?: string }> {
  const safeKey = sanitizeStorageKey(storageKey);
  const mode = getStorageMode();
  const localPath = getLocalFilePath(safeKey);

  if (mode === "local") {
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ localPath)) {
        const stat = await fs.promises.stat(/*turbopackIgnore: true*/ localPath);
        return { exists: true, sizeBytes: stat.size };
      }
      return { exists: false };
    } catch {
      return { exists: false };
    }
  }

  // Remote mode
  assertStorageConfig(mode);

  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: safeKey,
    });

    const response = await s3.send(command);

    return {
      exists: true,
      sizeBytes: response.ContentLength,
      contentType: response.ContentType,
    };
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      ((error as { name: string }).name === "NotFound" ||
        (error as { name: string }).name === "NoSuchKey")
    ) {
      return { exists: false };
    }
    return { exists: false };
  }
}
