import { S3Client } from "@aws-sdk/client-s3";
import { AppError } from "@/lib/utils/errors";

export type StorageMode = "local" | "s3" | "r2";

export class StorageConfigurationError extends AppError {
  constructor(message: string, issues: string[] = []) {
    super(message, "STORAGE_CONFIGURATION_ERROR", 500, { issues });
    this.name = "StorageConfigurationError";
  }
}

export class StorageSecurityError extends AppError {
  constructor(message = "Path traversal or illegal storage key detected") {
    super(message, "STORAGE_SECURITY_ERROR", 400);
    this.name = "StorageSecurityError";
  }
}

export class StorageError extends AppError {
  constructor(message: string, statusCode = 500, details?: Record<string, unknown>) {
    super(message, "STORAGE_ERROR", statusCode, details);
    this.name = "StorageError";
  }
}

/**
 * Resolves the active storage mode from environment variables.
 * Defaults to "local" for zero-budget development.
 */
export function getStorageMode(): StorageMode {
  const raw = (process.env.STORAGE_MODE || "local").toLowerCase().trim();
  if (raw === "s3") return "s3";
  if (raw === "r2") return "r2";
  return "local";
}

export const STORAGE_MODE = getStorageMode();

export const BUCKET_NAME = process.env.S3_BUCKET_NAME || "documind";

/**
 * Validates the storage configuration for the active or specified storage mode.
 */
export function validateStorageConfig(mode: StorageMode = getStorageMode()): {
  valid: boolean;
  mode: StorageMode;
  issues: string[];
} {
  const issues: string[] = [];

  if (mode === "local") {
    // Local mode does not require cloud credentials.
    return { valid: true, mode, issues: [] };
  }

  // Remote mode validations (s3 or r2)
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET_NAME;
  const endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT;

  if (!bucket || bucket.trim() === "") {
    issues.push("S3_BUCKET_NAME is required in remote storage mode.");
  }

  if (!accessKeyId || accessKeyId.trim() === "") {
    issues.push("S3_ACCESS_KEY_ID is required in remote storage mode.");
  }

  if (!secretAccessKey || secretAccessKey.trim() === "") {
    issues.push("S3_SECRET_ACCESS_KEY is required in remote storage mode.");
  }

  if (mode === "r2") {
    if (!endpoint || !endpoint.includes("r2.cloudflarestorage.com")) {
      issues.push(
        "S3_ENDPOINT (or R2_ENDPOINT) must point to Cloudflare R2: https://<account-id>.r2.cloudflarestorage.com"
      );
    }
  }

  return {
    valid: issues.length === 0,
    mode,
    issues,
  };
}

/**
 * Throws StorageConfigurationError if remote storage is active but configuration is invalid.
 */
export function assertStorageConfig(mode: StorageMode = getStorageMode()): void {
  const check = validateStorageConfig(mode);
  if (!check.valid) {
    throw new StorageConfigurationError(
      `Invalid storage configuration for mode "${mode}": ${check.issues.join("; ")}`,
      check.issues
    );
  }
}

function createS3Client(): S3Client {
  const mode = getStorageMode();
  const endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT;
  const region =
    mode === "r2"
      ? process.env.S3_REGION || "auto"
      : process.env.S3_REGION || "us-east-1";

  const accessKeyId = process.env.S3_ACCESS_KEY_ID || "minioadmin";
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || "minioadmin";

  // Force path style is needed for MinIO, but disabled for Cloudflare R2 and standard AWS S3
  const forcePathStyle =
    process.env.S3_FORCE_PATH_STYLE === "true" ||
    (endpoint
      ? endpoint.includes("localhost") || endpoint.includes("127.0.0.1")
      : false);

  return new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle,
  });
}

const globalForS3 = globalThis as unknown as {
  s3Client: S3Client | undefined;
};

export const s3 = globalForS3.s3Client ?? createS3Client();

if (process.env.NODE_ENV !== "production") {
  globalForS3.s3Client = s3;
}
