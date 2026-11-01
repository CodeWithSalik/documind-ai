import {
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, BUCKET_NAME, getStorageMode, assertStorageConfig, StorageConfigurationError } from "./client";
import { sanitizeStorageKey } from "./operations";

const UPLOAD_EXPIRY_SECONDS = 15 * 60; // 15 minutes
const DOWNLOAD_EXPIRY_SECONDS = 60 * 60; // 1 hour

/**
 * Generates a presigned URL for uploading a file directly to S3 or Cloudflare R2.
 * Throws StorageConfigurationError if local mode is active.
 */
export async function getPresignedUploadUrl(
  storageKey: string,
  contentType: string,
  maxSizeBytes: number,
): Promise<{ url: string; expiresAt: Date }> {
  const safeKey = sanitizeStorageKey(storageKey);
  const mode = getStorageMode();
  if (mode === "local") {
    throw new StorageConfigurationError(
      "Presigned URLs are not available in local storage mode (STORAGE_MODE=local). Use direct multipart upload (/api/documents/upload), or configure STORAGE_MODE=s3 or STORAGE_MODE=r2."
    );
  }

  assertStorageConfig(mode);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: safeKey,
    ContentType: contentType,
    ContentLength: maxSizeBytes,
  });

  const url = await getSignedUrl(s3, command, {
    expiresIn: UPLOAD_EXPIRY_SECONDS,
  });

  const expiresAt = new Date(Date.now() + UPLOAD_EXPIRY_SECONDS * 1000);

  return { url, expiresAt };
}

/**
 * Generates a presigned URL for downloading a file from S3 or Cloudflare R2.
 * Throws StorageConfigurationError if local mode is active.
 */
export async function getPresignedDownloadUrl(
  storageKey: string,
): Promise<{ url: string; expiresAt: Date }> {
  const safeKey = sanitizeStorageKey(storageKey);
  const mode = getStorageMode();
  if (mode === "local") {
    throw new StorageConfigurationError(
      "Presigned URLs are not available in local storage mode (STORAGE_MODE=local). Use direct application download (/api/documents/[id]/download), or configure STORAGE_MODE=s3 or STORAGE_MODE=r2."
    );
  }

  assertStorageConfig(mode);

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: safeKey,
  });

  const url = await getSignedUrl(s3, command, {
    expiresIn: DOWNLOAD_EXPIRY_SECONDS,
  });

  const expiresAt = new Date(Date.now() + DOWNLOAD_EXPIRY_SECONDS * 1000);

  return { url, expiresAt };
}
