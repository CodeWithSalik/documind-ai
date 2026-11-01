/**
 * Base application error with structured error codes.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, "AUTHENTICATION_ERROR", 401);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, "AUTHORIZATION_ERROR", 403);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} not found: ${id}` : `${resource} not found`;
    super(message, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds?: number) {
    super("Rate limit exceeded", "RATE_LIMIT", 429, {
      retryAfter: retryAfterSeconds,
    });
    this.name = "RateLimitError";
  }
}

export class ProviderError extends AppError {
  constructor(provider: string, message: string) {
    super(`${provider}: ${message}`, "PROVIDER_ERROR", 502);
    this.name = "ProviderError";
  }
}

export class DatabaseConnectionError extends AppError {
  constructor(message = "Database service is unavailable. Please ensure PostgreSQL is running.") {
    super(message, "DATABASE_UNAVAILABLE", 503);
    this.name = "DatabaseConnectionError";
  }
}

export type DocumentErrorCode =
  | "PDF_WORKER_INIT_FAILED"
  | "PDF_PARSE_FAILED"
  | "PDF_NO_EXTRACTABLE_TEXT"
  | "PDF_UNSUPPORTED"
  | "PROCESSING_ERROR";

export class DocumentProcessingError extends AppError {
  constructor(
    message: string,
    public readonly documentErrorCode: DocumentErrorCode = "PROCESSING_ERROR",
    statusCode = 422,
    details?: Record<string, unknown>
  ) {
    super(message, documentErrorCode, statusCode, details);
    this.name = "DocumentProcessingError";
  }
}

/**
 * Checks if an error represents a database connection or initialization failure.
 */
export function isDatabaseConnectionError(error: unknown): boolean {
  if (error instanceof DatabaseConnectionError) return true;
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  return (
    name === "PrismaClientInitializationError" ||
    name === "PrismaClientRustPanicError" ||
    name === "PrismaClientUnknownRequestError" ||
    msg.includes("Can't reach database") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("Connection refused") ||
    msg.includes("database server at") ||
    msg.includes("DATABASE_UNAVAILABLE")
  );
}

/**
 * Converts an unknown error to an AppError for consistent error handling.
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (isDatabaseConnectionError(error)) {
    return new DatabaseConnectionError();
  }
  if (error instanceof Error) {
    return new AppError(error.message, "INTERNAL_ERROR", 500);
  }
  return new AppError("An unexpected error occurred", "INTERNAL_ERROR", 500);
}

/**
 * Formats an AppError into a JSON-serializable response object.
 */
export function formatErrorResponse(error: AppError) {
  return {
    success: false as const,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };
}
