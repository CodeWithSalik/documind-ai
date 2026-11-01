import { Queue } from "bullmq";
import { redis } from "./client";

let _docQueue: Queue | null = null;
let _artifactQueue: Queue | null = null;
let _convQueue: Queue | null = null;

function createQueue(
  name: string,
  defaultJobOptions: Record<string, unknown>,
): Queue {
  return new Queue(name, {
    connection: redis,
    defaultJobOptions,
  });
}

export function getDocumentProcessingQueue(): Queue {
  if (!_docQueue) {
    _docQueue = createQueue("document-processing", {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    });
  }
  return _docQueue;
}

export function getArtifactGenerationQueue(): Queue {
  if (!_artifactQueue) {
    _artifactQueue = createQueue("artifact-generation", {
      attempts: 2,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 500 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    });
  }
  return _artifactQueue;
}

export function getConversionQueue(): Queue {
  if (!_convQueue) {
    _convQueue = createQueue("document-conversion", {
      attempts: 2,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 500 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    });
  }
  return _convQueue;
}

export const documentProcessingQueue = new Proxy({} as Queue, {
  get(_, prop) {
    const queue = getDocumentProcessingQueue();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (queue as any)[prop];
    return typeof val === "function" ? val.bind(queue) : val;
  },
});

export const artifactGenerationQueue = new Proxy({} as Queue, {
  get(_, prop) {
    const queue = getArtifactGenerationQueue();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (queue as any)[prop];
    return typeof val === "function" ? val.bind(queue) : val;
  },
});

export const conversionQueue = new Proxy({} as Queue, {
  get(_, prop) {
    const queue = getConversionQueue();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (queue as any)[prop];
    return typeof val === "function" ? val.bind(queue) : val;
  },
});

export type DocumentProcessingJobData = {
  documentId: string;
  storageKey: string;
  mimeType: string;
  workspaceId: string;
};

export type ArtifactGenerationJobData = {
  type: "document" | "spreadsheet";
  title: string;
  content: string;
  format: string;
  messageId: string;
  workspaceId: string;
};

export type ConversionJobData = {
  documentId: string;
  targetFormat: string;
  workspaceId: string;
};
