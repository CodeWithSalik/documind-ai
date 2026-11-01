import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const localStorageBase = path.resolve('.storage');

// Resolve credentials from project-grounded environment variables
const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const bucketName = process.env.S3_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME || 'documind';
const endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || (
  process.env.CLOUDFLARE_ACCOUNT_ID
    ? `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined
);
const region = process.env.S3_REGION || 'auto';

const hasOptIn =
  process.env.RUN_STORAGE_MIGRATION === "true" ||
  process.argv.includes("--run-migration") ||
  process.argv.includes("--confirm");

if (!hasOptIn) {
  console.log("--- STORAGE MANIFEST MIGRATION ---");
  console.log("ℹ️ Manifest migration requires explicit opt-in before executing remote uploads.");
  console.log("To execute migration to configured object storage, run with:");
  console.log("   RUN_STORAGE_MIGRATION=true node scripts/migrate-storage-manifest.mjs");
  console.log("   or: node scripts/migrate-storage-manifest.mjs --run-migration\n");
  process.exit(0);
}

if (!accessKeyId || !secretAccessKey || !endpoint) {
  console.error('Error: Remote object storage credentials incomplete.');
  console.error('Required: S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT (or S3_BUCKET_NAME / CLOUDFLARE_ACCOUNT_ID)');
  process.exit(1);
}

const s3 = new S3Client({
  region,
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
});

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function run() {
  console.log('--- STARTING STORAGE MANIFEST MIGRATION ---');

  // 1. Query database for all valid storage keys
  const docs = await prisma.document.findMany({
    select: { id: true, name: true, storageKey: true, sizeBytes: true, mimeType: true }
  });
  const arts = await prisma.artifact.findMany({
    select: { id: true, name: true, storageKey: true, sizeBytes: true, mimeType: true }
  });

  const manifest = [
    ...docs.map(d => ({ ...d, entity: 'document' })),
    ...arts.map(a => ({ ...a, entity: 'artifact' })),
  ];

  console.log(`Found ${manifest.length} active database-referenced storage items.`);

  let totalUploaded = 0;
  let totalBytes = 0;

  for (const item of manifest) {
    if (!item.storageKey) continue;

    // Resolve local file path
    let localPath = path.join(localStorageBase, item.storageKey);
    if (!fs.existsSync(localPath)) {
      const alt = path.join(localStorageBase, 'documents', item.storageKey);
      if (fs.existsSync(alt)) localPath = alt;
    }

    if (!fs.existsSync(localPath)) {
      throw new Error(`Referenced storage file missing on local disk: ${item.storageKey} (entity: ${item.entity}, id: ${item.id})`);
    }

    const localBuffer = fs.readFileSync(localPath);
    const localHash = crypto.createHash('sha256').update(localBuffer).digest('hex');

    console.log(`\n[${item.entity.toUpperCase()}] Uploading: ${item.name}`);
    console.log(`  Key:  ${item.storageKey}`);
    console.log(`  Size: ${localBuffer.length} bytes`);
    console.log(`  SHA:  ${localHash}`);

    // Upload object to R2
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: item.storageKey,
      Body: localBuffer,
      ContentType: item.mimeType || 'application/octet-stream',
    }));

    // Download object back from R2 to perform cryptographic SHA-256 checksum verification
    console.log(`  Verifying R2 object via SHA-256 hash comparison...`);
    const getRes = await s3.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: item.storageKey,
    }));

    const downloadedBuffer = await streamToBuffer(getRes.Body);
    const downloadedHash = crypto.createHash('sha256').update(downloadedBuffer).digest('hex');

    if (downloadedHash !== localHash) {
      throw new Error(`Checksum mismatch for key ${item.storageKey}!\n  Local SHA-256:      ${localHash}\n  Downloaded SHA-256: ${downloadedHash}`);
    }

    if (downloadedBuffer.length !== localBuffer.length) {
      throw new Error(`Byte size mismatch for key ${item.storageKey}!\n  Local bytes:      ${localBuffer.length}\n  Downloaded bytes: ${downloadedBuffer.length}`);
    }

    console.log(`  ✓ Checksum verified identical: ${downloadedHash}`);
    totalUploaded++;
    totalBytes += localBuffer.length;
  }

  console.log(`\n>>> STORAGE MIGRATION COMPLETE <<<`);
  console.log(`Successfully migrated and verified ${totalUploaded} files (${totalBytes} bytes).`);
}

run()
  .catch((err) => {
    console.error('\nStorage migration failed with error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('Prisma disconnected.');
  });
