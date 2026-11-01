import { PrismaClient } from "@prisma/client";

// Ensure DIRECT_URL defaults to DATABASE_URL at runtime if not explicitly provided
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton Prisma client instance.
 * In development, the client is attached to globalThis to survive
 * hot module replacement without creating multiple connections.
 */
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development" && process.env.PRISMA_VERBOSE === "true"
        ? ["query", "error", "warn"]
        : ["warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
