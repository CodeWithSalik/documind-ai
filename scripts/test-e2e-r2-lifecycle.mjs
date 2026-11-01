import crypto from "crypto";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

dotenv.config();

const db = new PrismaClient();
const APP_URL = process.env.APP_URL || "http://localhost:3000";

// Cloudflare R2 Client setup using verified credentials
const r2Client = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
});
const R2_BUCKET = process.env.S3_BUCKET_NAME || "documind-ai";

// Helper to create a valid minimal text-based PDF containing the canary phrase
function createCanaryPdfBuffer(canaryPhrase) {
  const lines = [
    "DocuMind Phoenix Protocol Document:",
    "Section 4.2 states that the primary operational target",
    "for project Phoenix is zero-latency verifiable intelligence",
    "across Cloudflare R2 and Neon PostgreSQL.",
    `Verification token ${canaryPhrase} confirmed.`,
  ];
  const stream = "BT /F1 12 Tf 14 TL 72 712 Td " + lines.map(l => "(" + l + ") '").join(" ") + " ET";
  const header = "%PDF-1.4\n";
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n";
  const obj4 = `4 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`;
  const obj5 = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";

  let offset = Buffer.byteLength(header);
  const offset1 = offset; offset += Buffer.byteLength(obj1);
  const offset2 = offset; offset += Buffer.byteLength(obj2);
  const offset3 = offset; offset += Buffer.byteLength(obj3);
  const offset4 = offset; offset += Buffer.byteLength(obj4);
  const offset5 = offset; offset += Buffer.byteLength(obj5);
  const startxref = offset;

  const pad = (n) => String(n).padStart(10, "0");
  const xref = `xref\n0 6\n0000000000 65535 f \n${pad(offset1)} 00000 n \n${pad(offset2)} 00000 n \n${pad(offset3)} 00000 n \n${pad(offset4)} 00000 n \n${pad(offset5)} 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;

  const pdf = header + obj1 + obj2 + obj3 + obj4 + obj5 + xref;
  return {
    buffer: Buffer.from(pdf),
    textContent: lines.join(" "),
  };
}

async function runE2EVerification() {
  console.log("================================================================================");
  console.log("   DOCUMIND AI — END-TO-END R2 & NEON LIFECYCLE VERIFICATION                    ");
  console.log("================================================================================\n");

  const hasOptIn =
    process.env.RUN_CLOUD_E2E === "true" ||
    process.argv.includes("--run-cloud-e2e") ||
    process.argv.includes("--confirm");

  if (!hasOptIn) {
    console.log("ℹ️ Cloud E2E lifecycle suite requires explicit opt-in before contacting remote services.");
    console.log("To run this test against configured cloud infrastructure, execute with:");
    console.log("   RUN_CLOUD_E2E=true node scripts/test-e2e-r2-lifecycle.mjs");
    console.log("   or: node scripts/test-e2e-r2-lifecycle.mjs --run-cloud-e2e\n");
    process.exit(0);
  }

  const results = {
    auth: { status: "NOT TESTED", details: "" },
    neonMetadata: { status: "NOT TESTED", details: "" },
    r2Presence: { status: "NOT TESTED", details: "" },
    extractionChunking: { status: "NOT TESTED", details: "" },
    chatCitation: { status: "NOT TESTED", details: "" },
    documentDownload: { status: "NOT TESTED", details: "" },
    documentDeletion: { status: "NOT TESTED", details: "" },
  };

  const CANARY_TOKEN = "CANARY-DOCUMIND-PHOENIX-9281";
  const timestamp = Date.now();
  const testEmail = `canary-e2e-${timestamp}@documind.test`;
  const testPassword = `CanaryPass_${timestamp}!`;
  let testUser = null;
  let testWorkspace = null;
  let sessionCookie = null;
  let documentId = null;
  let storageKey = null;
  let canaryPdf = null;
  let pdfSha256 = null;

  try {
    // --------------------------------------------------------------------------
    // CHECK 1: Registration / Login and Authenticated Session
    // --------------------------------------------------------------------------
    console.log(">>> CHECK 1: Registration, Login & Authenticated Document Upload");

    // 1A. Register user via HTTP API
    const regRes = await fetch(`${APP_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Phoenix Canary Test User",
        email: testEmail,
        password: testPassword,
      }),
    });

    const regJson = await regRes.json();
    if (regRes.status !== 201 || !regJson.success) {
      throw new Error(`Registration failed (HTTP ${regRes.status}): ${JSON.stringify(regJson)}`);
    }

    testUser = regJson.user;
    testWorkspace = regJson.workspace;
    console.log(`  [+] Registered synthetic user: ${testEmail} (ID: ${testUser.id})`);
    console.log(`  [+] Created default workspace: ${testWorkspace.name} (ID: ${testWorkspace.id})`);

    // 1B. Authenticate via Auth.js credentials flow to obtain session cookie
    const csrfRes = await fetch(`${APP_URL}/api/auth/csrf`);
    const csrfJson = await csrfRes.json();
    const csrfCookie = csrfRes.headers.getSetCookie().find(c => c.includes("authjs.csrf-token"));

    const loginRes = await fetch(`${APP_URL}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": csrfCookie ? csrfCookie.split(";")[0] : "",
      },
      body: new URLSearchParams({
        csrfToken: csrfJson.csrfToken,
        email: testEmail,
        password: testPassword,
        json: "true",
      }),
      redirect: "manual",
    });

    const setCookies = loginRes.headers.getSetCookie();
    const sessionTokenCookie = setCookies.find(c => c.includes("authjs.session-token"));
    if (!sessionTokenCookie) {
      throw new Error(`Login succeeded but authjs.session-token cookie was not set: ${setCookies.join(", ")}`);
    }
    sessionCookie = sessionTokenCookie.split(";")[0];
    console.log(`  [+] Authenticated session established (JWT token received)`);

    // 1C. Generate canary PDF
    canaryPdf = createCanaryPdfBuffer(CANARY_TOKEN);
    pdfSha256 = crypto.createHash("sha256").update(canaryPdf.buffer).digest("hex");
    console.log(`  [+] Generated test PDF with token '${CANARY_TOKEN}' (Size: ${canaryPdf.buffer.length} bytes, SHA256: ${pdfSha256.slice(0, 16)}...)`);

    // 1D. Upload PDF via authenticated multipart/form-data
    const formData = new FormData();
    const pdfBlob = new Blob([canaryPdf.buffer], { type: "application/pdf" });
    formData.append("file", pdfBlob, "phoenix_protocol_canary.pdf");
    formData.append("workspaceId", testWorkspace.id);

    const uploadRes = await fetch(`${APP_URL}/api/documents/upload`, {
      method: "POST",
      headers: {
        "Cookie": sessionCookie,
      },
      body: formData,
    });

    const uploadJson = await uploadRes.json();
    if (uploadRes.status !== 200 || !uploadJson.success) {
      throw new Error(`Upload failed (HTTP ${uploadRes.status}): ${JSON.stringify(uploadJson)}`);
    }

    documentId = uploadJson.data?.documentId;
    console.log(`  [+] Authenticated upload successful: documentId=${documentId}, status=${uploadJson.data?.status}`);
    results.auth = {
      status: "PASS",
      details: `User registration (HTTP 201), credentials session authentication (JWT), and authenticated document upload (HTTP 200, documentId: ${documentId}) succeeded.`,
    };

    // --------------------------------------------------------------------------
    // CHECK 2: Document Metadata Persistence in Neon PostgreSQL
    // --------------------------------------------------------------------------
    console.log("\n>>> CHECK 2: Document Metadata Persistence in Neon PostgreSQL");
    const neonDoc = await db.document.findUnique({
      where: { id: documentId },
      include: {
        uploadedBy: { select: { id: true, email: true } },
        workspace: { select: { id: true, name: true } },
      },
    });

    if (!neonDoc) {
      throw new Error(`Document record not found in Neon database for id: ${documentId}`);
    }

    storageKey = neonDoc.storageKey;
    console.log(`  [+] Neon Document Record verified:`);
    console.log(`      ID: ${neonDoc.id}`);
    console.log(`      Name: ${neonDoc.name}`);
    console.log(`      Status: ${neonDoc.status}`);
    console.log(`      MIME Type: ${neonDoc.mimeType}`);
    console.log(`      Size: ${neonDoc.sizeBytes} bytes (Buffer size: ${canaryPdf.buffer.length})`);
    console.log(`      Storage Key: ${storageKey}`);
    console.log(`      Workspace ID: ${neonDoc.workspaceId}`);
    console.log(`      Uploaded By: ${neonDoc.uploadedBy.email}`);

    if (neonDoc.status !== "READY") {
      throw new Error(`Document status in Neon is "${neonDoc.status}", expected "READY"`);
    }
    if (neonDoc.sizeBytes !== canaryPdf.buffer.length) {
      throw new Error(`Document size mismatch in Neon: DB=${neonDoc.sizeBytes}, expected=${canaryPdf.buffer.length}`);
    }
    if (!storageKey.startsWith(`workspaces/${testWorkspace.id}/documents/${documentId}/`)) {
      throw new Error(`Storage key format invalid: "${storageKey}"`);
    }

    results.neonMetadata = {
      status: "PASS",
      details: `Neon record verified: status=READY, sizeBytes=${neonDoc.sizeBytes}, storageKey=${storageKey}, workspaceId=${neonDoc.workspaceId}, owner=${neonDoc.uploadedBy.email}.`,
    };

    // --------------------------------------------------------------------------
    // CHECK 3: Object Presence in Configured Cloudflare R2 Bucket
    // --------------------------------------------------------------------------
    console.log("\n>>> CHECK 3: Object Presence in Private Cloudflare R2 Bucket");
    console.log(`  [+] Verifying object presence in bucket "${R2_BUCKET}" for key "${storageKey}"...`);

    const headRes = await r2Client.send(new HeadObjectCommand({
      Bucket: R2_BUCKET,
      Key: storageKey,
    }));

    console.log(`  [+] R2 HeadObject verified:`);
    console.log(`      ContentLength: ${headRes.ContentLength} bytes`);
    console.log(`      ContentType: ${headRes.ContentType}`);
    console.log(`      LastModified: ${headRes.LastModified}`);
    console.log(`      ETag: ${headRes.ETag}`);

    if (headRes.ContentLength !== canaryPdf.buffer.length) {
      throw new Error(`R2 object ContentLength mismatch: R2=${headRes.ContentLength}, expected=${canaryPdf.buffer.length}`);
    }

    // Download bytes directly from R2 and verify SHA-256
    const getRes = await r2Client.send(new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: storageKey,
    }));

    const r2Chunks = [];
    for await (const chunk of getRes.Body) {
      r2Chunks.push(chunk);
    }
    const r2Buffer = Buffer.concat(r2Chunks);
    const r2Sha256 = crypto.createHash("sha256").update(r2Buffer).digest("hex");
    console.log(`  [+] R2 Downloaded Object SHA-256: ${r2Sha256}`);
    console.log(`  [+] Local Source Buffer SHA-256: ${pdfSha256}`);

    if (r2Sha256 !== pdfSha256) {
      throw new Error(`R2 byte integrity check failed: SHA-256 hash mismatch!`);
    }

    results.r2Presence = {
      status: "PASS",
      details: `Cloudflare R2 bucket "${R2_BUCKET}" verified: Object "${storageKey}" present (${headRes.ContentLength} bytes, ETag ${headRes.ETag}), SHA-256 matches uploaded buffer byte-for-byte.`,
    };

    // --------------------------------------------------------------------------
    // CHECK 4: PDF Extraction, Chunking & Retrieval Indexing
    // --------------------------------------------------------------------------
    console.log("\n>>> CHECK 4: PDF Extraction, Chunking & Retrieval Indexing");
    const chunks = await db.documentChunk.findMany({
      where: { documentId },
      orderBy: { index: "asc" },
    });

    console.log(`  [+] Found ${chunks.length} extracted chunks in Neon document_chunks table`);
    if (chunks.length === 0) {
      throw new Error("No document chunks found in database");
    }

    const canaryChunk = chunks.find(c => c.content.includes(CANARY_TOKEN));
    if (!canaryChunk) {
      throw new Error(`Extracted chunks do NOT contain the canary token "${CANARY_TOKEN}"!`);
    }
    console.log(`  [+] Verified canary phrase in Chunk index ${canaryChunk.index} (Page ${canaryChunk.pageNumber}):`);
    console.log(`      Snippet: "${canaryChunk.content.trim().slice(0, 140)}..."`);

    // Verify search indexing in Neon
    const indexedChunks = await db.documentChunk.findMany({
      where: {
        documentId,
        content: { contains: CANARY_TOKEN },
      },
    });

    console.log(`  [+] Neon indexing verification: matched ${indexedChunks.length} chunk(s) for query '${CANARY_TOKEN}'`);
    if (indexedChunks.length === 0) {
      throw new Error("Indexing verification failed: canary chunk not queryable in Neon");
    }

    results.extractionChunking = {
      status: "PASS",
      details: `PDF extraction and chunking verified in Neon (${chunks.length} chunk(s)). Chunk 0 contains '${CANARY_TOKEN}'. Indexed chunk content verified in Neon document_chunks.`,
    };

    // --------------------------------------------------------------------------
    // CHECK 5: Chat Question Answered with Valid Citation
    // --------------------------------------------------------------------------
    console.log("\n>>> CHECK 5: Chat Question Answered with Valid Citation");
    const chatQuestion = "What is the primary operational target stated in Section 4.2 of project Phoenix? State the verification token.";

    const chatRes = await fetch(`${APP_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": sessionCookie,
      },
      body: JSON.stringify({
        message: chatQuestion,
        documentIds: [documentId],
        workspaceId: testWorkspace.id,
        modelId: "gemini-2.5-flash",
      }),
    });

    console.log(`  [+] Chat endpoint HTTP status: ${chatRes.status}`);
    const conversationIdHeader = chatRes.headers.get("X-Conversation-Id");
    console.log(`  [+] X-Conversation-Id: ${conversationIdHeader}`);

    // Read streamed response
    let responseBody = "";
    if (chatRes.body) {
      const reader = chatRes.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        responseBody += decoder.decode(value, { stream: true });
      }
    }

    console.log(`  [+] Received chat response stream (${responseBody.length} chars)`);
    console.log(`      Preview: "${responseBody.replace(/\n+/g, " ").slice(0, 180)}..."`);

    // Verify conversation and message records in Neon
    const dbConv = await db.conversation.findFirst({
      where: {
        workspaceId: testWorkspace.id,
        ...(conversationIdHeader ? { id: conversationIdHeader } : {}),
      },
      include: {
        documents: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!dbConv) {
      throw new Error("Conversation not found in database");
    }
    console.log(`  [+] Neon Conversation record verified: ID=${dbConv.id}, LinkedDocs=${dbConv.documents.length}, MessageCount=${dbConv.messages.length}`);

    const assistantMsg = dbConv.messages.find(m => m.role === "ASSISTANT");
    if (!assistantMsg) {
      throw new Error("Assistant response message was not persisted to Neon database");
    }

    const citations = assistantMsg.metadata?.citations || [];
    console.log(`  [+] Assistant Message verified: ID=${assistantMsg.id}`);
    console.log(`      Content snippet: "${assistantMsg.content.slice(0, 120)}..."`);
    console.log(`      Citations count: ${citations.length}`);
    if (citations.length > 0) {
      console.log(`      Citation 0: documentId=${citations[0].documentId}, name="${citations[0].documentName}", page=${citations[0].pageNumber}`);
    }

    const hasCanaryTokenInResponse =
      assistantMsg.content.includes(CANARY_TOKEN) ||
      responseBody.includes(CANARY_TOKEN) ||
      citations.some(c => c.documentId === documentId);

    if (!hasCanaryTokenInResponse) {
      throw new Error("Chat response did not incorporate the canary document context or citations");
    }

    results.chatCitation = {
      status: "PASS",
      details: `Chat query answered referencing document context; conversation ${dbConv.id} persisted with ${dbConv.messages.length} messages and ${citations.length} valid citation(s) linking document ${documentId}.`,
    };

    // --------------------------------------------------------------------------
    // CHECK 6: Authenticated & Presigned Document Download
    // --------------------------------------------------------------------------
    console.log("\n>>> CHECK 6: Authenticated & Presigned Document Download");

    // 6A. Authenticated application route download (/api/documents/[id]/download)
    console.log(`  [+] 6A. Testing application download route (/api/documents/${documentId}/download)...`);
    const appDownloadRes = await fetch(`${APP_URL}/api/documents/${documentId}/download`, {
      headers: { "Cookie": sessionCookie },
    });

    if (appDownloadRes.status !== 200) {
      throw new Error(`Application download failed (HTTP ${appDownloadRes.status})`);
    }

    const appDownloadBuf = Buffer.from(await appDownloadRes.arrayBuffer());
    const appDownloadSha256 = crypto.createHash("sha256").update(appDownloadBuf).digest("hex");
    console.log(`      HTTP Status: ${appDownloadRes.status}`);
    console.log(`      Content-Type: ${appDownloadRes.headers.get("content-type")}`);
    console.log(`      Content-Disposition: ${appDownloadRes.headers.get("content-disposition")}`);
    console.log(`      Downloaded Size: ${appDownloadBuf.length} bytes`);
    console.log(`      SHA-256 match: ${appDownloadSha256 === pdfSha256 ? "TRUE" : "FALSE"}`);

    if (appDownloadSha256 !== pdfSha256) {
      throw new Error("Application download SHA-256 does not match original uploaded file");
    }

    // 6B. Presigned direct Cloudflare R2 download URL
    console.log(`  [+] 6B. Testing presigned direct R2 download URL...`);
    const presignedCommand = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: storageKey,
    });
    const presignedUrl = await getSignedUrl(r2Client, presignedCommand, { expiresIn: 3600 });
    console.log(`      Presigned URL generated: ${presignedUrl.slice(0, 65)}...`);

    const r2DirectRes = await fetch(presignedUrl);
    if (r2DirectRes.status !== 200) {
      throw new Error(`Direct presigned R2 download failed (HTTP ${r2DirectRes.status})`);
    }

    const r2DirectBuf = Buffer.from(await r2DirectRes.arrayBuffer());
    const r2DirectSha256 = crypto.createHash("sha256").update(r2DirectBuf).digest("hex");
    console.log(`      R2 Direct HTTP Status: ${r2DirectRes.status}`);
    console.log(`      R2 Direct Size: ${r2DirectBuf.length} bytes`);
    console.log(`      SHA-256 match: ${r2DirectSha256 === pdfSha256 ? "TRUE" : "FALSE"}`);

    if (r2DirectSha256 !== pdfSha256) {
      throw new Error("Direct R2 presigned download SHA-256 does not match original uploaded file");
    }

    results.documentDownload = {
      status: "PASS",
      details: `Both authenticated route (HTTP 200, application/pdf) and Cloudflare R2 presigned URL (HTTP 200 direct) downloaded original PDF with byte-level SHA-256 match (${pdfSha256.slice(0, 16)}...).`,
    };

    // --------------------------------------------------------------------------
    // CHECK 7: Document Deletion Behavior (Neon DB, Chunks & R2 Object)
    // --------------------------------------------------------------------------
    console.log("\n>>> CHECK 7: Document Deletion Behavior (Neon DB, Chunks & R2 Object)");
    const deleteRes = await fetch(`${APP_URL}/api/documents/${documentId}`, {
      method: "DELETE",
      headers: { "Cookie": sessionCookie },
    });

    const deleteJson = await deleteRes.json();
    console.log(`  [+] DELETE /api/documents/${documentId} returned HTTP ${deleteRes.status}:`, deleteJson);

    if (deleteRes.status !== 200 || !deleteJson.success) {
      throw new Error(`Document deletion failed: ${JSON.stringify(deleteJson)}`);
    }

    // 7A. Verify Document record removed from Neon
    const deletedDocInDb = await db.document.findUnique({ where: { id: documentId } });
    console.log(`  [+] Neon Document lookup after deletion: ${deletedDocInDb ? "STILL EXISTS (FAIL)" : "NULL (CLEARED)"}`);
    if (deletedDocInDb !== null) {
      throw new Error(`Document record ${documentId} still exists in Neon after deletion`);
    }

    // 7B. Verify DocumentChunk records removed from Neon
    const remainingChunks = await db.documentChunk.count({ where: { documentId } });
    console.log(`  [+] Neon DocumentChunk count after deletion: ${remainingChunks} (CLEARED)`);
    if (remainingChunks > 0) {
      throw new Error(`Found ${remainingChunks} orphaned document chunks remaining in Neon`);
    }

    // 7C. Verify Object removed from Cloudflare R2
    console.log(`  [+] Verifying object removed from Cloudflare R2 ("${storageKey}")...`);
    let r2ObjectStillExists = false;
    try {
      await r2Client.send(new HeadObjectCommand({
        Bucket: R2_BUCKET,
        Key: storageKey,
      }));
      r2ObjectStillExists = true;
    } catch (headErr) {
      const errName = headErr?.name || "";
      const statusCode = headErr?.$metadata?.httpStatusCode;
      if (errName === "NotFound" || errName === "NoSuchKey" || statusCode === 404) {
        console.log(`  [+] Cloudflare R2 confirmed 404 NotFound for key "${storageKey}" (CLEARED)`);
      } else {
        throw headErr;
      }
    }

    if (r2ObjectStillExists) {
      throw new Error(`Object "${storageKey}" still exists in Cloudflare R2 bucket after document deletion!`);
    }

    results.documentDeletion = {
      status: "PASS",
      details: `Document deletion verified: Neon document record removed (null), chunks cascade-deleted (0 chunks), and Cloudflare R2 object deleted (R2 HeadObject returned 404 NotFound).`,
    };

  } catch (error) {
    console.error("\n❌ E2E Verification failed with error:", error);
  } finally {
    // --------------------------------------------------------------------------
    // TEARDOWN: Clean up synthetic test tenant records
    // --------------------------------------------------------------------------
    console.log("\n================================================================================");
    console.log("   TEARDOWN & CLEANUP OF SYNTHETIC TEST USER                                    ");
    console.log("================================================================================");
    try {
      if (documentId) {
        // Fallback cleanup if deletion test failed before cleaning up R2
        try {
          const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
          await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: storageKey }));
        } catch {}
        await db.documentChunk.deleteMany({ where: { documentId } });
        await db.document.deleteMany({ where: { id: documentId } });
      }

      if (testWorkspace?.id) {
        await db.conversationDocument.deleteMany({ where: { conversation: { workspaceId: testWorkspace.id } } });
        await db.message.deleteMany({ where: { conversation: { workspaceId: testWorkspace.id } } });
        await db.conversation.deleteMany({ where: { workspaceId: testWorkspace.id } });
        await db.workspaceMember.deleteMany({ where: { workspaceId: testWorkspace.id } });
        await db.workspace.deleteMany({ where: { id: testWorkspace.id } });
      }

      if (testUser?.id) {
        await db.user.deleteMany({ where: { id: testUser.id } });
      }
      console.log("  [+] Synthetic test tenant records cleanly removed.");
    } catch (cleanupErr) {
      console.warn("  [!] Cleanup warning:", cleanupErr.message);
    } finally {
      await db.$disconnect();
    }
  }

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("   FINAL LIFECYCLE VERIFICATION RESULTS                                         ");
  console.log("================================================================================");
  for (const [key, val] of Object.entries(results)) {
    console.log(`- [${val.status}] ${key}: ${val.details || "Failed before execution"}`);
  }
  console.log("================================================================================\n");

  const allPassed = Object.values(results).every(r => r.status === "PASS");
  process.exit(allPassed ? 0 : 1);
}

runE2EVerification();
