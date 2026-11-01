import IORedis from "ioredis";

function createRedisConnection(): IORedis {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy(times: number) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });
}

const globalForRedis = globalThis as unknown as {
  redisConnection: IORedis | undefined;
};

export const redis = globalForRedis.redisConnection ?? createRedisConnection();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redisConnection = redis;
}
