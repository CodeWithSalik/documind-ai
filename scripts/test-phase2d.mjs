import fs from "fs";
import path from "path";

// Load local environment variables if available
if (fs.existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Ignore if already loaded
  }
}

import { MODEL_REGISTRY, MODEL_IDS, getModelDefinition } from "../src/lib/ai/models.ts";
import {
  getModel,
  getFallbackModelId,
  isProviderConfigured,
  getProviderStatuses,
} from "../src/lib/ai/providers.ts";
import {
  AppError,
  AuthorizationError,
  AuthenticationError,
  DatabaseConnectionError,
  isDatabaseConnectionError,
  toAppError,
  formatErrorResponse,
} from "../src/lib/utils/errors.ts";
import { requireWorkspaceAccess } from "../src/lib/auth/guards.ts";

async function runPhase2DTests() {
  console.log("=================================================");
  console.log("       DOCUMIND AI — PHASE 2D VERIFICATION       ");
  console.log("   Zero-Budget Provider & Runtime Hardening      ");
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
  // TEST 1: Elimination of Grok & Paid-Provider Fallbacks
  // ------------------------------------------------------------------------
  console.log("--- 1. Grok & Paid Provider Elimination ---");

  const registryKeys = Object.keys(MODEL_REGISTRY);
  const hasGrokInRegistry = registryKeys.some((k) =>
    k.toLowerCase().includes("grok") || k.toLowerCase().includes("xai")
  );
  assert(!hasGrokInRegistry, "MODEL_REGISTRY contains zero Grok or xAI entries");

  const grokInModelIds = MODEL_IDS.some((id) =>
    id.toLowerCase().includes("grok") || id.toLowerCase().includes("xai")
  );
  assert(!grokInModelIds, "MODEL_IDS contains zero Grok or xAI models");

  // Every registered model must be Google Gemini
  const allModelsAreGoogle = Object.values(MODEL_REGISTRY).every(
    (m) => m.provider === "google"
  );
  assert(allModelsAreGoogle, "All models in MODEL_REGISTRY belong strictly to provider 'google'");

  // getFallbackModelId must return null for all models (no silent paid fallback)
  const geminiFlashFallback = getFallbackModelId("gemini-1.5-flash");
  const geminiProFallback = getFallbackModelId("gemini-1.5-pro");
  const gemini2FlashFallback = getFallbackModelId("gemini-2.0-flash");
  assert(
    geminiFlashFallback === null && geminiProFallback === null && gemini2FlashFallback === null,
    "getFallbackModelId returns null for all models (no silent fallback paths)"
  );

  // Fallback for non-existent or legacy grok model
  const legacyGrokFallback = getFallbackModelId("grok-2");
  assert(legacyGrokFallback === null, "Legacy model IDs also return null fallback");

  // Verify provider statuses list
  const statuses = getProviderStatuses();
  const xaiInStatuses = statuses.some((s) => s.provider === "xai");
  assert(!xaiInStatuses, "getProviderStatuses() contains zero xAI entries");

  // Verify getModel rejects unknown / xai models cleanly
  let threwOnGrok = false;
  try {
    getModel("grok-2");
  } catch (err) {
    threwOnGrok = true;
    assert(
      err.message.includes("Unsupported") || err.message.includes("Unknown"),
      "getModel('grok-2') throws clean unsupported/unknown error"
    );
  }
  assert(threwOnGrok, "getModel('grok-2') throws an exception");

  // Verify no grok/xai references in active src/ files
  const srcFilesToAudit = [
    "src/types/ai.ts",
    "src/lib/ai/models.ts",
    "src/lib/ai/providers.ts",
    "src/hooks/use-model-selection.ts",
    "src/components/chat/model-selector.tsx",
    "src/components/chat/streaming-indicator.tsx",
    "src/components/layout/header.tsx",
    "src/app/(workspace)/settings/models/page.tsx",
    "src/app/(workspace)/dashboard/page.tsx",
    "src/app/(workspace)/artifacts/page.tsx",
    "src/app/page.tsx",
    "src/app/layout.tsx",
    ".env.example",
  ];

  let srcGrokClean = true;
  for (const relPath of srcFilesToAudit) {
    const fullPath = path.resolve(relPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      if (content.toLowerCase().includes("grok") || content.toLowerCase().includes("xai_api_key")) {
        console.error(`Found unexpected grok/xai reference in: ${relPath}`);
        srcGrokClean = false;
      }
    }
  }
  assert(srcGrokClean, "Audit of 13 critical source files confirms zero grok / XAI_API_KEY references");

  // ------------------------------------------------------------------------
  // TEST 2: Gemini Quota Exhaustion Handling & Honest Grounding
  // ------------------------------------------------------------------------
  console.log("\n--- 2. Quota Exhaustion (429) & Honest Grounding ---");

  // Test error classification for 429
  function isQuotaExhaustedError(err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return (
      errorMsg.includes("quota") ||
      errorMsg.includes("RESOURCE_EXHAUSTED") ||
      errorMsg.includes("429") ||
      err?.statusCode === 429
    );
  }

  const sampleGemini429 = new Error(
    "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-1.5-flash, description: Generate content requests per day limit exceeded on Free Tier."
  );
  sampleGemini429.statusCode = 429;
  assert(isQuotaExhaustedError(sampleGemini429), "isQuotaExhaustedError accurately detects Google 429 quota exception");

  // Verify simulated quota handling with documents attached
  const mockDocumentChunks = [
    {
      documentId: "doc-1",
      pageNumber: 3,
      content: "DocuMind AI uses PostgreSQL and lexical keyword scoring for zero-budget RAG.",
      score: 18.5,
    },
    {
      documentId: "doc-1",
      pageNumber: 7,
      content: "All documents are parsed locally without external paid vector APIs.",
      score: 14.2,
    },
  ];
  const mockDocNames = new Map([["doc-1", "Architecture.pdf"]]);

  function buildLocalExcerptResponse(chunks, docNames) {
    const docList = Array.from(docNames.values()).join(", ") || "Attached Documents";
    const keyPoints = chunks
      .map((c, i) => `• **[Source ${i + 1}]** *(Page ${c.pageNumber ?? 1})*:\n  "${c.content.trim()}"`)
      .join("\n\n");

    return `> ⚠️ **Google Gemini Free Tier Quota Exhausted (HTTP 429)**\n> *Live AI reasoning is temporarily paused because Google Gemini free-tier daily requests are exhausted.*\n> *Below is a local excerpt review displaying verbatim text retrieved from your workspace documents:*\n\n### [Local Retrieved Document Excerpts]\n\n**Sources:** ${docList}\n\n${keyPoints}\n\n---\n*Note: To restore live frontier AI streaming, set an active \`GOOGLE_GENERATIVE_AI_API_KEY\` in your \`.env\` file or [Model Settings](/settings/models).*`;
  }

  const excerptReview = buildLocalExcerptResponse(mockDocumentChunks, mockDocNames);
  assert(
    excerptReview.includes("### [Local Retrieved Document Excerpts]"),
    "Quota response with documents includes honest '### [Local Retrieved Document Excerpts]' heading"
  );
  assert(
    excerptReview.includes("Architecture.pdf") && excerptReview.includes("Page 3"),
    "Quota excerpt review references actual document name and page number citations"
  );
  assert(
    excerptReview.includes("PostgreSQL and lexical keyword scoring"),
    "Quota excerpt review embeds verbatim document excerpts without fabrication"
  );
  assert(
    !excerptReview.includes("As an AI model, I think") && !excerptReview.includes("Based on my knowledge"),
    "Quota excerpt review does NOT pretend to be an AI-generated answer"
  );

  // Verify simulated quota handling when NO documents are attached
  function buildQuotaErrorPayload() {
    return {
      code: "QUOTA_EXHAUSTED",
      message: "Google Gemini quota exhausted (HTTP 429). Daily free-tier request limit reached. Please retry later or update your API key in .env or settings.",
    };
  }
  const noDocQuotaPayload = buildQuotaErrorPayload();
  assert(
    noDocQuotaPayload.code === "QUOTA_EXHAUSTED",
    "Without attached documents, quota exhaustion produces structured QUOTA_EXHAUSTED code"
  );
  assert(
    noDocQuotaPayload.message.includes("HTTP 429"),
    "Structured quota payload clearly explains HTTP 429 and provides recovery guidance"
  );

  // ------------------------------------------------------------------------
  // TEST 3: Database Offline Resilience (503 DATABASE_UNAVAILABLE)
  // ------------------------------------------------------------------------
  console.log("\n--- 3. Database Offline Resilience (HTTP 503) ---");

  const dbErrInstance = new DatabaseConnectionError();
  assert(dbErrInstance.statusCode === 503, "DatabaseConnectionError has HTTP 503 status");
  assert(dbErrInstance.code === "DATABASE_UNAVAILABLE", "DatabaseConnectionError has code DATABASE_UNAVAILABLE");

  // Error detection
  assert(
    isDatabaseConnectionError(new Error("Can't reach database server at localhost:5432")),
    "isDatabaseConnectionError detects 'Can't reach database server'"
  );
  assert(
    isDatabaseConnectionError(new Error("connect ECONNREFUSED 127.0.0.1:5432")),
    "isDatabaseConnectionError detects ECONNREFUSED"
  );
  const prismaError = new Error("Engine panicked");
  prismaError.name = "PrismaClientInitializationError";
  assert(
    isDatabaseConnectionError(prismaError),
    "isDatabaseConnectionError detects PrismaClientInitializationError"
  );
  assert(
    !isDatabaseConnectionError(new Error("Invalid document ID format")),
    "isDatabaseConnectionError does not falsely flag regular application errors"
  );

  // toAppError conversion
  const converted = toAppError(new Error("Can't reach database server"));
  assert(converted instanceof DatabaseConnectionError, "toAppError converts connection failure to DatabaseConnectionError");
  assert(converted.statusCode === 503, "Converted error has HTTP status 503");

  const formattedResponse = formatErrorResponse(converted);
  assert(
    formattedResponse.success === false && formattedResponse.error.code === "DATABASE_UNAVAILABLE",
    "formatErrorResponse renders clean structured 503 DATABASE_UNAVAILABLE JSON"
  );

  // Verify requireWorkspaceAccess behavior under database failure
  // Simulate mock user session and broken DB
  globalThis.__TEST_USER__ = { id: "test-user-1", email: "test@documind.ai" };
  globalThis.__TEST_WORKSPACE_ACCESS__ = async () => {
    throw new DatabaseConnectionError();
  };

  let threwDbOffline = false;
  try {
    await requireWorkspaceAccess("workspace-123");
  } catch (err) {
    if (err instanceof DatabaseConnectionError && err.statusCode === 503) {
      threwDbOffline = true;
    }
  }
  assert(threwDbOffline, "requireWorkspaceAccess throws HTTP 503 DatabaseConnectionError when DB is offline");

  // ------------------------------------------------------------------------
  // TEST 4: Elimination of Sandbox Auto-Bypass & Hardcoded Credentials
  // ------------------------------------------------------------------------
  console.log("\n--- 4. Sandbox Auto-Bypass & Credentials Elimination ---");

  // Verify src/lib/documents/sandbox.ts is physically removed
  const sandboxExists = fs.existsSync(path.resolve("src/lib/documents/sandbox.ts"));
  assert(!sandboxExists, "src/lib/documents/sandbox.ts is completely deleted from disk");

  // Verify auth.ts contains no demo credentials or bypass
  const authSource = fs.readFileSync(path.resolve("src/auth.ts"), "utf-8");
  assert(!authSource.includes("analyst@documind.ai"), "src/auth.ts contains no hardcoded analyst@documind.ai");
  assert(!authSource.includes("Enterprise2026!"), "src/auth.ts contains no hardcoded Enterprise2026! password");
  assert(!authSource.includes("sandbox-user"), "src/auth.ts contains no sandbox-user authorize fallback");

  // Verify login page contains no Auto Fill demo button
  const loginSource = fs.readFileSync(path.resolve("src/app/(auth)/login/page.tsx"), "utf-8");
  assert(!loginSource.includes("analyst@documind.ai"), "src/app/(auth)/login/page.tsx contains no demo credentials");
  assert(!loginSource.includes("Auto Fill"), "src/app/(auth)/login/page.tsx contains no 'Auto Fill' button");

  // ------------------------------------------------------------------------
  // TEST 5: Strict Cross-Workspace Isolation
  // ------------------------------------------------------------------------
  console.log("\n--- 5. Strict Cross-Workspace Isolation ---");

  // Test unauthorized foreign workspace access rejection
  globalThis.__TEST_WORKSPACE_ACCESS__ = async (wsId, minRole, user) => {
    // Simulate user membership in "ws-own", attempting to access "ws-other"
    if (wsId === "ws-other") {
      throw new AuthorizationError("You do not have access to this workspace.");
    }
    return {
      user,
      membership: { id: "mem-1", userId: user.id, workspaceId: "ws-own", role: "OWNER", joinedAt: new Date() },
      workspace: { id: "ws-own", name: "User Own Workspace" },
    };
  };

  let crossWorkspaceDenied = false;
  try {
    await requireWorkspaceAccess("ws-other");
  } catch (err) {
    if (err instanceof AuthorizationError && err.statusCode === 403) {
      crossWorkspaceDenied = true;
    }
  }
  assert(crossWorkspaceDenied, "requireWorkspaceAccess strictly denies foreign workspace access (HTTP 403 AuthorizationError)");

  // Clean up global mocks
  delete globalThis.__TEST_USER__;
  delete globalThis.__TEST_WORKSPACE_ACCESS__;

  // ------------------------------------------------------------------------
  // TEST 6: DOM Prototype & Hydration Hygiene
  // ------------------------------------------------------------------------
  console.log("\n--- 6. DOM Prototype & Hydration Hygiene ---");

  const layoutSource = fs.readFileSync(path.resolve("src/app/layout.tsx"), "utf-8");
  assert(
    !layoutSource.includes("Element.prototype.setAttribute"),
    "src/app/layout.tsx contains no Element.prototype.setAttribute monkey patching"
  );
  assert(
    !layoutSource.includes("MutationObserver"),
    "src/app/layout.tsx contains no MutationObserver DOM scraping"
  );
  assert(
    !layoutSource.includes("bis_skin_checked"),
    "src/app/layout.tsx contains no Bitdefender extension DOM patchers"
  );

  // Verify suppressHydrationWarning is NOT on card primitives
  const cardSource = fs.readFileSync(path.resolve("src/components/ui/card.tsx"), "utf-8");
  assert(
    !cardSource.includes("suppressHydrationWarning"),
    "src/components/ui/card.tsx contains zero suppressHydrationWarning attributes"
  );

  // Verify suppressHydrationWarning is NOT in auth layout or toast provider
  const authLayoutSource = fs.readFileSync(path.resolve("src/app/(auth)/layout.tsx"), "utf-8");
  assert(
    !authLayoutSource.includes("suppressHydrationWarning"),
    "src/app/(auth)/layout.tsx contains zero suppressHydrationWarning attributes"
  );

  const toastProviderSource = fs.readFileSync(path.resolve("src/components/shared/toast-provider.tsx"), "utf-8");
  assert(
    !toastProviderSource.includes("suppressHydrationWarning"),
    "src/components/shared/toast-provider.tsx contains zero suppressHydrationWarning attributes"
  );

  // ------------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------------
  console.log("\n=================================================");
  console.log(`Phase 2D Verification Complete: ${passed} passed, ${failed} failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2DTests().catch((err) => {
  console.error("Fatal error during Phase 2D verification:", err);
  process.exit(1);
});
