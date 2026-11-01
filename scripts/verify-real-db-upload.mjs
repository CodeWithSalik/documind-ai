const hasOptIn =
  process.env.RUN_DB_VERIFICATION === "true" ||
  process.argv.includes("--run-verification") ||
  process.argv.includes("--confirm");

if (!hasOptIn) {
  console.log("ℹ️ Database upload verification requires explicit opt-in before creating test records.");
  console.log("To run this test against configured database, execute with:");
  console.log("   RUN_DB_VERIFICATION=true node scripts/verify-real-db-upload.mjs");
  console.log("   or: node scripts/verify-real-db-upload.mjs --run-verification\n");
  process.exit(0);
}

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const db = new PrismaClient();

async function runRealDbUploadVerification() {
  console.log("=================================================");
  console.log("   DOCUMIND AI — REAL POSTGRESQL UPLOAD TEST     ");
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

  let testUser = null;
  let testWorkspace = null;
  let uploadedDocId1 = null;
  let uploadedDocId2 = null;



  try {
    // 1. Verify table exists in PostgreSQL
    const tableCheck = await db.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'workspace_members';
    `;
    assert(tableCheck.length === 1, "Table 'public.workspace_members' exists in PostgreSQL");

    // 2. Create actual User in DB
    const timestamp = Date.now();
    testUser = await db.user.create({
      data: {
        email: `real-test-${timestamp}@documind.ai`,
        name: "Verification User",
        password: "hashed_dummy_password",
      },
    });
    assert(!!testUser.id, `Created test user in database (id: ${testUser.id})`);

    // 3. Create actual Workspace & WorkspaceMember in DB
    testWorkspace = await db.workspace.create({
      data: {
        name: "Verification Workspace",
        slug: `ws-${timestamp}`,
        ownerId: testUser.id,
        members: {
          create: {
            userId: testUser.id,
            role: "OWNER",
          },
        },
      },
    });
    assert(!!testWorkspace.id, `Created test workspace in database (id: ${testWorkspace.id})`);

    // 4. Verify workspace membership query via Prisma
    const memberRecord = await db.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: testUser.id,
          workspaceId: testWorkspace.id,
        },
      },
      include: {
        workspace: true,
        user: true,
      },
    });
    assert(!!memberRecord, "db.workspaceMember.findUnique returns real membership record");
    assert(memberRecord.role === "OWNER", "Membership role is OWNER");
    assert(memberRecord.workspace.id === testWorkspace.id, "Membership links to correct workspace");
    assert(memberRecord.user.id === testUser.id, "Membership links to correct user");

    // 5. Import actual upload route handler
    const { POST: uploadRouteHandler } = await import("../src/app/api/documents/upload/route.ts");

    // Configure test user authentication hook for requireAuth()
    globalThis.__TEST_USER__ = { id: testUser.id, email: testUser.email };
    delete globalThis.__TEST_WORKSPACE_ACCESS__; // Ensure real DB access queries execute!

    // 6. Test Document Upload with explicit workspaceId
    const fileContent = `# DocuMind Enterprise Security Architecture
## 1. Zero-Trust Access Control
All platform communications require mutual TLS and cryptographic token verification.
All document processing occurs in isolated tenant workspaces with strict role-based access control.

## 2. Storage Durability
Document assets are stored durably using content-addressable storage keys and indexed lexically for retrieval.`;

    const blob1 = new Blob([fileContent], { type: "text/plain" });
    const formData1 = new FormData();
    formData1.append("file", blob1, "Security_Architecture.txt");
    formData1.append("workspaceId", testWorkspace.id);

    const req1 = new NextRequest("http://localhost:3000/api/documents/upload", {
      method: "POST",
      body: formData1,
    });

    const res1 = await uploadRouteHandler(req1);
    assert(res1.status === 200, `Upload with explicit workspaceId returned HTTP 200 (status: ${res1.status})`);

    const json1 = await res1.json();
    assert(json1.success === true, "Upload response reports success: true");
    assert(!!json1.data?.documentId, `Received valid documentId: ${json1.data?.documentId}`);
    assert(json1.data?.status === "READY", `Document status is READY (status: ${json1.data?.status})`);
    uploadedDocId1 = json1.data.documentId;

    // 7. Verify Document and Chunks exist in PostgreSQL tables
    const dbDoc = await db.document.findUnique({
      where: { id: uploadedDocId1 },
      include: { chunks: true },
    });
    assert(!!dbDoc, "Uploaded document record found in PostgreSQL 'documents' table");
    assert(dbDoc.name === "Security_Architecture.txt", "Document name matches uploaded file");
    assert(dbDoc.workspaceId === testWorkspace.id, "Document workspaceId matches test workspace");
    assert(dbDoc.uploadedById === testUser.id, "Document uploadedById matches test user");
    assert(dbDoc.status === "READY", "Document status in database is READY");
    assert(dbDoc.chunks.length > 0, `Document has ${dbDoc.chunks.length} chunks in 'document_chunks' table`);
    assert(dbDoc.chunks[0].content.includes("Zero-Trust Access Control"), "First chunk content persisted accurately");

    // 8. Test Document Upload with default-workspace (auto-resolves via workspace_members table)
    const blob2 = new Blob(["# Financial Summary\nRevenue grew by 25%."], { type: "text/plain" });
    const formData2 = new FormData();
    formData2.append("file", blob2, "Financial_Summary.txt");
    formData2.append("workspaceId", "default-workspace");

    const req2 = new NextRequest("http://localhost:3000/api/documents/upload", {
      method: "POST",
      body: formData2,
    });

    const res2 = await uploadRouteHandler(req2);
    assert(res2.status === 200, `Upload with default-workspace returned HTTP 200 (status: ${res2.status})`);
    const json2 = await res2.json();
    assert(json2.success === true, "Default workspace upload reports success: true");
    assert(json2.data?.document?.workspaceId === testWorkspace.id, "Auto-resolved to user's real workspace");
    uploadedDocId2 = json2.data.documentId;

    // 9. Test Cross-Tenant Access Prevention (Unauthorized User)
    const foreignUser = await db.user.create({
      data: {
        email: `foreign-${timestamp}@documind.ai`,
        name: "Foreign User",
        password: "foreign_password",
      },
    });

    globalThis.__TEST_USER__ = { id: foreignUser.id, email: foreignUser.email };
    const blob3 = new Blob(["malicious file"], { type: "text/plain" });
    const formData3 = new FormData();
    formData3.append("file", blob3, "exploit.txt");
    formData3.append("workspaceId", testWorkspace.id);

    const req3 = new NextRequest("http://localhost:3000/api/documents/upload", {
      method: "POST",
      body: formData3,
    });

    const res3 = await uploadRouteHandler(req3);
    assert(res3.status === 403, `Unauthorized user upload returned HTTP 403 (status: ${res3.status})`);
    const json3 = await res3.json();
    assert(json3.error?.code === "AUTHORIZATION_ERROR", "Error code is AUTHORIZATION_ERROR");

    // Cleanup foreign user
    await db.user.delete({ where: { id: foreignUser.id } });

  } catch (err) {
    console.error("[ERROR] Unexpected error during verification:", err);
    failed++;
  } finally {
    // Clean up created test data
    console.log("\nCleaning up test records from database...");
    try {
      if (uploadedDocId1) {
        await db.documentChunk.deleteMany({ where: { documentId: uploadedDocId1 } });
        await db.document.delete({ where: { id: uploadedDocId1 } }).catch(() => {});
      }
      if (uploadedDocId2) {
        await db.documentChunk.deleteMany({ where: { documentId: uploadedDocId2 } });
        await db.document.delete({ where: { id: uploadedDocId2 } }).catch(() => {});
      }
      if (testWorkspace?.id) {
        await db.workspaceMember.deleteMany({ where: { workspaceId: testWorkspace.id } });
        await db.workspace.delete({ where: { id: testWorkspace.id } }).catch(() => {});
      }
      if (testUser?.id) {
        await db.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
      console.log("Cleanup completed.");
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr.message);
    }
    await db.$disconnect();
  }

  console.log("\n=================================================");
  console.log(`Verification Complete: ${passed} passed, ${failed} failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runRealDbUploadVerification();
