import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";

// Load local environment variables if available
if (fs.existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Ignore if already loaded
  }
}

import {
  saveFile,
  downloadFile,
  deleteFile,
  getFileMetadata,
  sanitizeStorageKey,
  getLocalStorageDir,
} from "../src/lib/storage/operations.ts";
import {
  validateStorageConfig,
  assertStorageConfig,
  getStorageMode,
  StorageConfigurationError,
  StorageSecurityError,
  StorageError,
} from "../src/lib/storage/client.ts";
import {
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
} from "../src/lib/storage/presigned.ts";
import { db } from "../src/lib/db/client.ts";
import { GET as downloadRouteHandler } from "../src/app/api/documents/[id]/download/route.ts";
import * as authGuards from "../src/lib/auth/guards.ts";

async function runPhase2CTests() {
  console.log("=================================================");
  console.log("       DOCUMIND AI — PHASE 2C VERIFICATION       ");
  console.log("   Durable Storage & Deployment Readiness Audit  ");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // ------------------------------------------------------------------------
  // TEST 1: Local Storage Mode Operations
  // ------------------------------------------------------------------------
  console.log("--- 1. Local Storage Mode Write, Read, Stat, Delete ---");
  const testKey = "test-ws/test-doc/audit-report.txt";
  const testPayload = Buffer.from("DocuMind Phase 2C Storage Integrity Verification Payload", "utf-8");

  // Save file locally
  const saveResult = await saveFile(testKey, testPayload, "text/plain");
  assert(saveResult.storageKey === testKey, "saveFile returns sanitized storageKey");
  assert(saveResult.sizeBytes === testPayload.length, `saveFile records exact byte size (${saveResult.sizeBytes})`);

  // Verify file existence on disk
  const metadata = await getFileMetadata(testKey);
  assert(metadata.exists === true, "getFileMetadata confirms file exists in storage");
  assert(metadata.sizeBytes === testPayload.length, `getFileMetadata reports matching file size (${metadata.sizeBytes})`);

  // Read file back
  const downloaded = await downloadFile(testKey);
  assert(downloaded.toString("utf-8") === testPayload.toString("utf-8"), "downloadFile reads identical buffer content");

  // Delete file
  await deleteFile(testKey);
  const metadataAfterDelete = await getFileMetadata(testKey);
  assert(metadataAfterDelete.exists === false, "deleteFile removes physical file from storage");

  // Verify download throws NotFoundError on missing file
  let downloadThrew = false;
  try {
    await downloadFile(testKey);
  } catch (err) {
    downloadThrew = true;
    assert(err.name === "NotFoundError", `downloadFile throws NotFoundError for deleted file (${err.message})`);
  }
  assert(downloadThrew, "downloadFile fails safely when target does not exist");

  // ------------------------------------------------------------------------
  // TEST 2: Path Traversal Defenses
  // ------------------------------------------------------------------------
  console.log("\n--- 2. Path Traversal & Key Sanitization Defenses ---");

  const traversalAttacks = [
    "../../etc/passwd",
    "..\\..\\windows\\system32\\cmd.exe",
    "valid-folder/../../../secret.env",
    "folder/\0injection.txt",
    "C:\\Windows\\System32\\drivers.sys",
    "/absolute/root/path.txt",
    "\\windows\\system.ini",
  ];

  for (const attack of traversalAttacks) {
    let attackBlocked = false;
    try {
      sanitizeStorageKey(attack);
    } catch (err) {
      if (err instanceof StorageSecurityError || err.name === "StorageSecurityError") {
        attackBlocked = true;
      }
    }
    assert(attackBlocked, `Blocked traversal attempt: "${attack}"`);
  }

  // Verify valid key sanitization
  const validKey = sanitizeStorageKey("workspaces\\tenant-1/documents/contract.pdf");
  assert(validKey === "workspaces/tenant-1/documents/contract.pdf", "sanitizeStorageKey normalizes Windows backslashes safely");

  // ------------------------------------------------------------------------
  // TEST 3: Remote Mode Configuration Validation
  // ------------------------------------------------------------------------
  console.log("\n--- 3. Remote Storage Configuration Validation ---");

  // Local mode requires no credentials
  const localCheck = validateStorageConfig("local");
  assert(localCheck.valid === true, "Local storage mode validates with zero required credentials");
  assert(localCheck.issues.length === 0, "Local mode reports zero configuration issues");

  // S3 mode validation with missing credentials
  const originalAccessKey = process.env.S3_ACCESS_KEY_ID;
  const originalSecretKey = process.env.S3_SECRET_ACCESS_KEY;
  const originalBucket = process.env.S3_BUCKET_NAME;
  const originalEndpoint = process.env.S3_ENDPOINT;

  delete process.env.S3_ACCESS_KEY_ID;
  delete process.env.S3_SECRET_ACCESS_KEY;
  delete process.env.S3_BUCKET_NAME;

  const s3InvalidCheck = validateStorageConfig("s3");
  assert(s3InvalidCheck.valid === false, "S3 mode validation fails when credentials/bucket are missing");
  assert(
    s3InvalidCheck.issues.some((i) => i.includes("S3_BUCKET_NAME")),
    "Validation explicitly diagnoses missing S3_BUCKET_NAME"
  );
  assert(
    s3InvalidCheck.issues.some((i) => i.includes("S3_ACCESS_KEY_ID")),
    "Validation explicitly diagnoses missing S3_ACCESS_KEY_ID"
  );

  // R2 mode validation requiring Cloudflare endpoint
  process.env.S3_BUCKET_NAME = "my-r2-bucket";
  process.env.S3_ACCESS_KEY_ID = "r2-id";
  process.env.S3_SECRET_ACCESS_KEY = "r2-secret";
  process.env.S3_ENDPOINT = "http://localhost:9000"; // Invalid endpoint for R2

  const r2InvalidCheck = validateStorageConfig("r2");
  assert(r2InvalidCheck.valid === false, "R2 mode fails when endpoint is not Cloudflare R2");
  assert(
    r2InvalidCheck.issues.some((i) => i.includes("r2.cloudflarestorage.com")),
    "R2 diagnostic explains requirement for https://<account-id>.r2.cloudflarestorage.com"
  );

  // Restore environment variables
  if (originalAccessKey) process.env.S3_ACCESS_KEY_ID = originalAccessKey;
  if (originalSecretKey) process.env.S3_SECRET_ACCESS_KEY = originalSecretKey;
  if (originalBucket) process.env.S3_BUCKET_NAME = originalBucket;
  if (originalEndpoint) process.env.S3_ENDPOINT = originalEndpoint;

  // ------------------------------------------------------------------------
  // TEST 4: Presigned URL Mode Guard
  // ------------------------------------------------------------------------
  console.log("\n--- 4. Presigned URL Mode Guard Verification ---");
  process.env.STORAGE_MODE = "local";

  let presignedUploadBlocked = false;
  try {
    await getPresignedUploadUrl("test/key.pdf", "application/pdf", 1024);
  } catch (err) {
    if (err instanceof StorageConfigurationError || err.name === "StorageConfigurationError") {
      presignedUploadBlocked = true;
      assert(err.message.includes("STORAGE_MODE=local"), "getPresignedUploadUrl explains local mode incompatibility");
    }
  }
  assert(presignedUploadBlocked, "getPresignedUploadUrl rejected in local storage mode");

  let presignedDownloadBlocked = false;
  try {
    await getPresignedDownloadUrl("test/key.pdf");
  } catch (err) {
    if (err instanceof StorageConfigurationError || err.name === "StorageConfigurationError") {
      presignedDownloadBlocked = true;
      assert(err.message.includes("STORAGE_MODE=local"), "getPresignedDownloadUrl explains local mode incompatibility");
    }
  }
  assert(presignedDownloadBlocked, "getPresignedDownloadUrl rejected in local storage mode");

  // ------------------------------------------------------------------------
  // TEST 5: Deterministic Remote Failure (No Silent Fallback)
  // ------------------------------------------------------------------------
  console.log("\n--- 5. Deterministic Remote Storage Failure (No Silent Fallback) ---");
  // Configure remote S3 mode pointing to an unreachable port
  process.env.STORAGE_MODE = "s3";
  process.env.S3_BUCKET_NAME = "nonexistent-documind-bucket";
  process.env.S3_ACCESS_KEY_ID = "dummy-access-key";
  process.env.S3_SECRET_ACCESS_KEY = "dummy-secret-key";
  process.env.S3_ENDPOINT = "http://127.0.0.1:59999"; // Non-existent daemon

  let remoteSaveFailedExplicitly = false;
  try {
    await saveFile("test/remote-failure-test.txt", Buffer.from("remote data"), "text/plain");
  } catch (err) {
    remoteSaveFailedExplicitly = true;
    assert(
      err instanceof StorageError || err.name === "StorageError",
      `saveFile threw explicit StorageError on unreachable S3 (${err.message})`
    );
  }
  assert(remoteSaveFailedExplicitly, "saveFile never swallows remote errors to falsely report success");

  // Reset to local mode
  process.env.STORAGE_MODE = "local";
  if (originalEndpoint) process.env.S3_ENDPOINT = originalEndpoint;

  // ------------------------------------------------------------------------
  // TEST 6: Authorized Download Route Security & Tenant Access Control
  // ------------------------------------------------------------------------
  console.log("\n--- 6. Authorized Download Route Security & Tenant Isolation ---");

  // 6a: Test Unauthenticated Request (Must return HTTP 401)
  const unauthReq = new NextRequest("http://localhost:3000/api/documents/any-id/download");
  const unauthRes = await downloadRouteHandler(unauthReq, {
    params: Promise.resolve({ id: "any-id" }),
  });
  assert(unauthRes.status === 401, `Unauthenticated download request rejected with HTTP 401 (${unauthRes.status})`);
  const unauthBody = await unauthRes.json();
  assert(unauthBody.error?.code === "AUTHENTICATION_ERROR", "Response returns code AUTHENTICATION_ERROR");

  // 6b: Test with Authenticated Mock Context to verify Route Streaming & Security Headers
  console.log("\n--- 6b. Route Streaming, Content-Disposition & Security Headers ---");
  const testDocId = `doc-test-${Date.now()}`;
  const testDocKey = `workspace-alpha/${testDocId}/report.pdf`;
  const samplePdfBytes = Buffer.from("%PDF-1.4 DocuMind Phase 2C Verified Payload Content", "utf-8");
  await saveFile(testDocKey, samplePdfBytes, "application/pdf");

  const originalFindUnique = db.document.findUnique;
  try {
    // Mock authenticated user and workspace access via test hooks
    globalThis.__TEST_USER__ = { id: "user-123", email: "tester@documind.ai" };
    globalThis.__TEST_WORKSPACE_ACCESS__ = async (wsId) => {
      if (wsId === "forbidden-workspace") {
        const { AuthorizationError } = await import("../src/lib/utils/errors.ts");
        throw new AuthorizationError("Access denied to workspace");
      }
      return { workspace: { id: wsId } };
    };

    // Mock document findUnique
    db.document.findUnique = async ({ where }) => {
      if (where.id === testDocId) {
        return {
          id: testDocId,
          name: "Annual_Audit_Report.pdf",
          mimeType: "application/pdf",
          sizeBytes: samplePdfBytes.length,
          storageKey: testDocKey,
          workspaceId: "workspace-alpha",
          status: "READY",
        };
      }
      if (where.id === "forbidden-doc-id") {
        return {
          id: "forbidden-doc-id",
          name: "Confidential.pdf",
          mimeType: "application/pdf",
          sizeBytes: 100,
          storageKey: "workspace-beta/confidential.pdf",
          workspaceId: "forbidden-workspace",
          status: "READY",
        };
      }
      return null;
    };

    // Test 6c: Non-existent document returns 404
    const notFoundReq = new NextRequest("http://localhost:3000/api/documents/non-existent-id/download");
    const notFoundRes = await downloadRouteHandler(notFoundReq, {
      params: Promise.resolve({ id: "non-existent-id" }),
    });
    assert(notFoundRes.status === 404, `Non-existent document returns HTTP 404 (${notFoundRes.status})`);

    // Test 6d: Unauthorized cross-workspace returns 404 anti-enumeration
    const forbiddenReq = new NextRequest("http://localhost:3000/api/documents/forbidden-doc-id/download");
    const forbiddenRes = await downloadRouteHandler(forbiddenReq, {
      params: Promise.resolve({ id: "forbidden-doc-id" }),
    });
    assert(forbiddenRes.status === 404, `Cross-workspace access returns HTTP 404 anti-enumeration (${forbiddenRes.status})`);

    // Test 6e: Authorized download returns 200 with headers
    const authReq = new NextRequest(`http://localhost:3000/api/documents/${testDocId}/download`);
    const authRes = await downloadRouteHandler(authReq, {
      params: Promise.resolve({ id: testDocId }),
    });
    assert(authRes.status === 200, `Authorized download returns HTTP 200 (${authRes.status})`);
    assert(
      authRes.headers.get("content-type") === "application/pdf",
      `Response specifies correct Content-Type (${authRes.headers.get("content-type")})`
    );
    assert(
      authRes.headers.get("x-content-type-options") === "nosniff",
      "Response includes security header X-Content-Type-Options: nosniff"
    );
    assert(
      authRes.headers.get("content-disposition")?.includes("attachment"),
      `Response sets attachment Content-Disposition header (${authRes.headers.get("content-disposition")})`
    );

    const receivedStream = Buffer.from(await authRes.arrayBuffer());
    assert(receivedStream.equals(samplePdfBytes), "Downloaded stream matches source binary byte-for-byte");

    // Test 6f: Inline preview returns inline Content-Disposition
    const inlineReq = new NextRequest(`http://localhost:3000/api/documents/${testDocId}/download?inline=true`);
    const inlineRes = await downloadRouteHandler(inlineReq, {
      params: Promise.resolve({ id: testDocId }),
    });
    assert(
      inlineRes.headers.get("content-disposition")?.includes("inline"),
      `Inline request returns inline Content-Disposition (${inlineRes.headers.get("content-disposition")})`
    );
  } finally {
    // Reset test hooks and restore db
    delete globalThis.__TEST_USER__;
    delete globalThis.__TEST_WORKSPACE_ACCESS__;
    db.document.findUnique = originalFindUnique;
    // Clean up local test file
    await deleteFile(testDocKey);
  }

  // ------------------------------------------------------------------------
  // TEST 7: Coordinated Deletion & Consistency Semantics
  // ------------------------------------------------------------------------
  console.log("\n--- 7. Coordinated Deletion & Consistency Semantics ---");

  const deleteTestKey = "cleanup-test/document-to-delete.txt";
  const deletePayload = Buffer.from("Temporary document for deletion consistency verification", "utf-8");
  await saveFile(deleteTestKey, deletePayload, "text/plain");

  const existsBefore = await getFileMetadata(deleteTestKey);
  assert(existsBefore.exists === true, "File exists prior to coordinated deletion test");

  await deleteFile(deleteTestKey);
  const existsAfter = await getFileMetadata(deleteTestKey);
  assert(existsAfter.exists === false, "File removed from storage cleanly during deletion");

  // Calling delete on already-deleted file does not throw (idempotent deletion)
  let repeatDeleteThrew = false;
  try {
    await deleteFile(deleteTestKey);
  } catch {
    repeatDeleteThrew = true;
  }
  assert(!repeatDeleteThrew, "deleteFile is safely idempotent when called on missing target");

  // ------------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------------
  console.log("\n=================================================");
  console.log(`Phase 2C Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2CTests().catch((err) => {
  console.error("Phase 2C Test Runner Encountered Fatal Error:", err);
  process.exit(1);
});
