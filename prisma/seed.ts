import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PRODUCTION_SEED) {
    console.warn("Database seeding aborted: Seeding is disabled in production environments.");
    process.exit(0);
  }

  console.log("Seeding DocuMind AI database...");

  // 1. Create Demo User
  const demoUser = await prisma.user.upsert({
    where: { email: "alex@documind.ai" },
    update: {},
    create: {
      email: "alex@documind.ai",
      name: "Alex Vance",
      image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
  });

  console.log("Demo user created:", demoUser.email);

  // 2. Create Workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: "documind-hq" },
    update: {},
    create: {
      name: "DocuMind Research HQ",
      slug: "documind-hq",
      plan: "PRO",
      ownerId: demoUser.id,
      members: {
        create: {
          userId: demoUser.id,
          role: "OWNER",
        },
      },
    },
  });

  console.log("Demo workspace created:", workspace.name);

  // 3. Create Sample Documents
  const sampleDoc1 = await prisma.document.upsert({
    where: { storageKey: "demo/q3-financial-report.pdf" },
    update: {},
    create: {
      name: "Q3 2026 Strategic Financial Report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024 * 480, // 480 KB
      storageKey: "demo/q3-financial-report.pdf",
      status: "READY",
      pageCount: 14,
      wordCount: 4200,
      workspaceId: workspace.id,
      uploadedById: demoUser.id,
      metadata: {
        author: "Finance & Strategy Group",
        title: "Q3 2026 Strategic Financial Report",
        quarter: "Q3 2026",
      },
      chunks: {
        create: [
          {
            index: 0,
            pageNumber: 1,
            content:
              "# Q3 2026 Financial Highlights\n\nTotal revenue surged 34% year-over-year to $48.2M, driven primarily by enterprise SaaS adoption and automated AI workflow expansion. Net recurring revenue retention stood at 128%. Gross margin expanded by 240 bps to 78.4%. Operating cash flow reached a record $14.1M.",
          },
          {
            index: 1,
            pageNumber: 2,
            content:
              "## Segment Performance\n\n- Enterprise Document Automation: $26.4M (+41% YoY)\n- AI Data Extraction & Analytics: $15.1M (+28% YoY)\n- Platform Customization & Integrations: $6.7M (+18% YoY)\n\nOperating expenses increased by 14% to $22.6M, reflecting continued investment in machine learning infrastructure and engineering headcount.",
          },
        ],
      },
    },
  });

  const sampleDoc2 = await prisma.document.upsert({
    where: { storageKey: "demo/enterprise-contract-sla.docx" },
    update: {},
    create: {
      name: "Enterprise Service Level Agreement v4.2.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 1024 * 125,
      storageKey: "demo/enterprise-contract-sla.docx",
      status: "READY",
      pageCount: 6,
      wordCount: 1850,
      workspaceId: workspace.id,
      uploadedById: demoUser.id,
      metadata: {
        title: "Master Enterprise SLA",
        jurisdiction: "Delaware",
        availabilityTarget: "99.95%",
      },
      chunks: {
        create: [
          {
            index: 0,
            pageNumber: 1,
            content:
              "# Master Service Level Agreement\n\nThis Service Level Agreement governs the availability, maintenance windows, and resolution guarantees for DocuMind AI Enterprise services.\n\n### Availability Commitment\nProvider commits to 99.95% monthly uptime across document processing, API endpoints, and chat streaming services, calculated on a calendar monthly basis excluding scheduled maintenance.",
          },
        ],
      },
    },
  });

  console.log("Sample documents created:", sampleDoc1.name, sampleDoc2.name);

  // 4. Create Sample Conversation
  const conversation = await prisma.conversation.create({
    data: {
      title: "Q3 Revenue Analysis & SLA Inquiry",
      model: "gemini-2.5-flash",
      workspaceId: workspace.id,
      userId: demoUser.id,
      documents: {
        create: [
          { documentId: sampleDoc1.id },
          { documentId: sampleDoc2.id },
        ],
      },
      messages: {
        create: [
          {
            role: "USER",
            content: "What were our top revenue drivers in Q3 2026, and what uptime does our enterprise SLA guarantee?",
          },
          {
            role: "ASSISTANT",
            model: "gemini-2.5-flash",
            tokenCount: 148,
            content:
              "Based on your uploaded documents, here is the breakdown:\n\n### 1. Q3 2026 Revenue Drivers\nAccording to **[Q3 2026 Strategic Financial Report.pdf (Page 2)]**:\n- **Enterprise Document Automation** was the primary growth driver at **$26.4M** (+41% YoY).\n- **AI Data Extraction & Analytics** contributed **$15.1M** (+28% YoY).\n- **Platform Customization & Integrations** added **$6.7M** (+18% YoY).\n\nTotal revenue reached **$48.2M** (+34% YoY) with 128% net retention.\n\n### 2. Enterprise SLA Guarantee\nAccording to **[Enterprise Service Level Agreement v4.2.docx (Page 1)]**:\n- The provider commits to a **99.95% monthly uptime** across document processing, API endpoints, and chat streaming.",
          },
        ],
      },
    },
  });

  console.log("Sample conversation created:", conversation.title);
  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
