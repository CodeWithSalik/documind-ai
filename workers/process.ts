/**
 * Standalone Node.js Worker Process Entry Point for DocuMind AI
 *
 * Runs BullMQ workers for:
 * 1. document-processing
 * 2. artifact-generation
 * 3. document-conversion
 *
 * Handles graceful shutdown on SIGINT / SIGTERM and logs all worker lifecycle events.
 */

// Load environment variables if running directly with Node
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  }
} catch {
  // .env file is optional if env vars are already set in environment
}

import type { Worker, Job } from "bullmq";
import { db } from "@/lib/db/client";
import { redis } from "@/lib/queue/client";
import {
  createDocumentProcessorWorker,
  DOCUMENT_PROCESSING_QUEUE_NAME,
} from "@/lib/queue/workers/document-processor";
import {
  createArtifactGeneratorWorker,
  ARTIFACT_GENERATION_QUEUE_NAME,
} from "@/lib/queue/workers/artifact-generator";
import {
  createConversionWorker,
  CONVERSION_QUEUE_NAME,
} from "@/lib/queue/workers/conversion";

function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Attaches logging event listeners to a BullMQ worker instance.
 */
function attachWorkerLifecycleListeners(worker: Worker, queueName: string): void {
  worker.on("ready", () => {
    console.log(`[${formatTimestamp()}] [Worker:${queueName}] Ready and listening for incoming jobs.`);
  });

  worker.on("active", (job: Job) => {
    console.log(
      `[${formatTimestamp()}] [Worker:${queueName}] Job #${job.id} started [name=${job.name}, attemptsMade=${job.attemptsMade}].`,
    );
  });

  worker.on("completed", (job: Job, result: unknown) => {
    console.log(
      `[${formatTimestamp()}] [Worker:${queueName}] Job #${job.id} completed successfully. Result:`,
      JSON.stringify(result),
    );
  });

  worker.on("failed", (job: Job | undefined, error: Error) => {
    console.error(
      `[${formatTimestamp()}] [Worker:${queueName}] Job #${job?.id ?? "unknown"} failed: ${error.message}`,
      error.stack,
    );
  });

  worker.on("stalled", (jobId: string) => {
    console.warn(
      `[${formatTimestamp()}] [Worker:${queueName}] Job #${jobId} stalled. It will be re-queued or marked failed.`,
    );
  });

  worker.on("error", (error: Error) => {
    console.error(`[${formatTimestamp()}] [Worker:${queueName}] Worker error: ${error.message}`, error);
  });

  worker.on("closing", (msg: string) => {
    console.log(`[${formatTimestamp()}] [Worker:${queueName}] Closing worker... (${msg})`);
  });

  worker.on("closed", () => {
    console.log(`[${formatTimestamp()}] [Worker:${queueName}] Worker closed.`);
  });
}

async function startWorkers(): Promise<void> {
  console.log("========================================================");
  console.log("             DocuMind AI Worker Process                 ");
  console.log("========================================================");
  console.log(`[${formatTimestamp()}] Starting background workers...`);
  console.log(`[${formatTimestamp()}] Node runtime: ${process.version}`);
  console.log(`[${formatTimestamp()}] Environment:  ${process.env.NODE_ENV || "development"}`);

  // 1. Initialize BullMQ worker instances
  const documentProcessorWorker = createDocumentProcessorWorker(redis);
  const artifactGeneratorWorker = createArtifactGeneratorWorker(redis);
  const conversionWorker = createConversionWorker(redis);

  const workers: Array<{ name: string; instance: Worker }> = [
    { name: DOCUMENT_PROCESSING_QUEUE_NAME, instance: documentProcessorWorker },
    { name: ARTIFACT_GENERATION_QUEUE_NAME, instance: artifactGeneratorWorker },
    { name: CONVERSION_QUEUE_NAME, instance: conversionWorker },
  ];

  // 2. Attach lifecycle listeners
  for (const { name, instance } of workers) {
    attachWorkerLifecycleListeners(instance, name);
  }

  console.log(
    `[${formatTimestamp()}] All 3 workers initialized: [${workers.map((w) => w.name).join(", ")}]`,
  );

  // 3. Graceful shutdown handler
  let isShuttingDown = false;

  async function gracefulShutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n[${formatTimestamp()}] Received ${signal}. Initiating graceful shutdown...`);

    const forceExitTimer = setTimeout(() => {
      console.error(
        `[${formatTimestamp()}] Graceful shutdown timed out after 30s. Forcing exit immediately.`,
      );
      process.exit(1);
    }, 30000);

    try {
      console.log(`[${formatTimestamp()}] Closing BullMQ workers...`);
      await Promise.allSettled(workers.map((w) => w.instance.close()));
      console.log(`[${formatTimestamp()}] All workers closed.`);

      console.log(`[${formatTimestamp()}] Disconnecting Redis client...`);
      await redis.quit().catch((err) => {
        console.warn(`[${formatTimestamp()}] Redis disconnect error:`, err);
      });

      console.log(`[${formatTimestamp()}] Disconnecting Prisma database client...`);
      await db.$disconnect().catch((err) => {
        console.warn(`[${formatTimestamp()}] Prisma disconnect error:`, err);
      });

      clearTimeout(forceExitTimer);
      console.log(`[${formatTimestamp()}] Graceful shutdown completed cleanly. Goodbye.`);
      process.exit(0);
    } catch (shutdownError) {
      console.error(`[${formatTimestamp()}] Error encountered during shutdown:`, shutdownError);
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  }

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}

startWorkers().catch((error) => {
  console.error(`[${formatTimestamp()}] Fatal worker process startup error:`, error);
  process.exit(1);
});
