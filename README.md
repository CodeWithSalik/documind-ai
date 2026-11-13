# DocuMind AI

**A workspace-based document Q&A application built with Next.js, TypeScript, PostgreSQL and Google Gemini.**

DocuMind AI lets an authenticated user upload supported documents, organise them in workspaces and ask questions about extracted document content through a streaming chat interface. The project focuses on document-ingestion engineering: upload validation, format-specific extraction, text chunking, workspace-scoped retrieval, persistent conversations and AI responses grounded in retrieved passages.

> **Project status:** Active development / student-built project. This README describes the implementation currently present in this repository. It does not imply that every deployment is production-ready or that every accepted file type has OCR support.

## How it works

1. A user signs in and works inside a personal or shared workspace.
2. Documents are uploaded and validated on the server.
3. A format-specific extractor converts supported files into text and metadata.
4. Extracted text is split into chunks and stored in PostgreSQL.
5. A chat request checks workspace access, retrieves relevant chunks and sends the selected context to the configured Google Gemini model.
6. The response is streamed back to the chat interface, with source metadata available where supported.

**Retrieval note:** the current retrieval module uses lexical relevance scoring over stored chunks. It is not an embedding-based or vector-database search system.

## Features

### Document ingestion

The upload flow includes file-size/type checks, buffer validation, workspace-access checks, storage-key generation and document status tracking.

| Format | Current handling |
|---|---|
| PDF | Text extraction with page-level content where available |
| DOCX | Raw-text extraction with Mammoth; HTML conversion is also collected as metadata |
| XLSX | Workbook and worksheet extraction using ExcelJS |
| CSV | CSV parsing and tabular text representation using PapaParse |
| TXT, Markdown, HTML, JSON | Accepted as text-oriented document types |
| PNG, JPEG, WebP | Accepted by the upload/type layer; OCR or image understanding is **not implemented** in the current image extractor |

Maximum upload size: **50 MB**.

**Known limitations:** scanned or image-only PDFs with no extractable text are rejected with a processing error. Image uploads currently produce basic file metadata rather than OCR text. Password-protected or unsupported PDF structures may also fail extraction.

### Workspace and document management

- Authenticated workspace access.
- Workspace roles: **Owner, Member and Viewer**.
- Documents, folders, chunks and conversations are associated with workspaces.
- Document states: PENDING, PROCESSING, READY and ERROR.
- Document metadata includes file size, MIME type, page count, word count and processing status.
- Chat requests verify that submitted document IDs belong to the active workspace.

### Document-grounded chat

- Streaming chat responses using the Vercel AI SDK.
- Google Gemini is the active AI provider in the current provider implementation.
- Conversations and messages are persisted in PostgreSQL.
- Authentication and workspace permissions are checked before chat requests are processed.
- Retrieved chunks are passed as context; citation metadata can identify the source document and page where available.
- Model definitions are centralised in src/lib/ai/models.ts.

### Storage and processing

The storage layer supports three environment-configured modes:

- **Local** - convenient for development; stores files on the local filesystem.
- **S3** - AWS S3 or another S3-compatible service.
- **R2** - Cloudflare R2 through the AWS S3 SDK.

The repository contains a BullMQ document-processing worker backed by Redis. The environment template also documents a synchronous fallback for single-instance development when Redis is not configured.

**Deployment warning:** local filesystem storage is not durable on ephemeral/serverless deployments. Use persistent S3/R2 storage for a deployed environment and verify bucket credentials and access policies.

## Architecture

~~~text
Browser / Next.js UI
        |
        v
Authenticated App Router API
        |
        +---- Workspace and role checks
        +---- Upload validation (type, size, file buffer)
        |
        v
Storage adapter (local / S3 / R2)
        |
        v
Format-specific extraction
(PDF / DOCX / XLSX / CSV / text)
        |
        v
Text chunking and metadata
        |
        v
PostgreSQL + Prisma
        |
        v
Workspace-scoped lexical retrieval
        |
        v
Google Gemini through Vercel AI SDK
        |
        v
Streaming answer + available source references
~~~

## Technology stack

| Layer | Technologies |
|---|---|
| Web application | Next.js 16.4.3, React 19.3.0, TypeScript 5 |
| UI | Tailwind CSS 4, shadcn/ui components, Lucide |
| AI integration | Vercel AI SDK 7, @ai-sdk/google |
| Authentication | Auth.js / NextAuth 5 beta |
| Database | PostgreSQL, Prisma 6.4.1 |
| Document extraction | pdf-parse, Mammoth, ExcelJS, PapaParse |
| Object storage | AWS SDK for S3-compatible storage; local, S3 and R2 modes |
| Background processing | BullMQ and Redis (optional for the synchronous development path) |
| Validation | Zod and server-side upload validation |

## Getting started

### Prerequisites

- Node.js **20.9 or later** (the minimum required by Next.js 16).
- npm.
- PostgreSQL.
- A Google Gemini API key for AI chat.
- Optional: Redis for BullMQ background processing.
- Optional: an S3-compatible bucket or Cloudflare R2 account for persistent remote file storage.

### 1. Clone and install

~~~bash
git clone https://github.com/CodeWithSalik/documind-ai.git
cd documind-ai
npm ci
~~~

### 2. Configure environment variables

Copy the example file:

~~~bash
cp .env.example .env.local
~~~

On Windows PowerShell:

~~~powershell
Copy-Item .env.example .env.local
~~~

At minimum, configure these values in .env.local:

| Variable | Purpose |
|---|---|
| DATABASE_URL | PostgreSQL connection string used by the application |
| DIRECT_URL | Direct PostgreSQL connection used by Prisma migrations |
| AUTH_SECRET | Secret used by Auth.js; generate a strong random value |
| AUTH_URL | Local application URL, normally http://localhost:3000 |
| GOOGLE_GENERATIVE_AI_API_KEY | Google Gemini API key |
| STORAGE_MODE | local, s3 or r2 |
| LOCAL_STORAGE_DIR | Local file directory when STORAGE_MODE=local |
| NEXT_PUBLIC_APP_URL | Public application URL |

For remote storage, also configure the relevant S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME and S3_FORCE_PATH_STYLE values. For Redis-backed processing, configure REDIS_URL.

The full variable list and configuration examples are in the .env.example file. Never commit .env.local, API keys, database passwords, access keys or production secrets.

### 3. Prepare the database

Apply the checked-in Prisma migrations to your development database:

~~~bash
npx prisma migrate dev
npx prisma generate
~~~

For a deployment environment, use the appropriate migration command (for example, npx prisma migrate deploy) after configuring the production database connection.

### 4. Run the development server

~~~bash
npm run dev
~~~

Open http://localhost:3000.

### 5. Available project scripts

| Command | Purpose |
|---|---|
| npm run dev | Start the Next.js development server |
| npm run lint | Run ESLint |
| npm run build | Generate the Prisma client and build the application |
| npm run start | Start the production Next.js server |

The repository also contains focused processing and storage verification scripts under scripts/. Review each script's environment requirements before running it against a database or remote storage service.

## Deployment notes

A deployed instance needs more than a successful frontend build:

1. Provision PostgreSQL and configure DATABASE_URL and DIRECT_URL.
2. Configure AUTH_SECRET, AUTH_URL and the Gemini API key.
3. Use persistent S3/R2 storage for uploaded files. Do not rely on local filesystem storage for durable files on a serverless host.
4. Configure Redis if the deployment is using the BullMQ worker path; otherwise confirm the synchronous processing path is appropriate for the workload.
5. Apply database migrations and verify upload, processing, document retrieval, chat and download flows in the deployed environment.

A deployment URL is not proof that all external services are configured. Check the live environment and its logs before treating the application as fully operational.

## Security and data handling

The codebase includes server-side authentication and workspace-role checks, file-size/type validation, file-buffer validation, generated storage keys and workspace-scoped document checks in chat requests. These controls are part of the implementation; they should not be interpreted as a third-party security audit.

Before production use, review database and object-storage access policies, rotate credentials, configure deployment secrets, test cross-workspace access boundaries, and establish backups and retention rules.

## Current limitations and next steps

- OCR / visual extraction for image files is not implemented.
- Scanned or image-only PDFs without extractable text are not processed by the current text extractor.
- Retrieval is lexical scoring over stored chunks; embedding generation and vector search are not present in the current retrieval module.
- Markdown-to-PDF and Markdown-to-DOCX conversion are not implemented in the current converter.
- Local storage is intended for development/testing, not durable serverless storage.
- AI responses depend on the configured provider key, quota, model availability and network access.

Potential engineering improvements include a tested OCR pipeline, embedding-based retrieval with relevance evaluation, automated integration tests for tenant isolation and upload security, and operational monitoring for background processing.

## Repository structure

~~~text
src/
  app/
    (auth)/                 # Sign-in and registration pages
    (workspace)/            # Dashboard, chat, documents, settings and artifacts
    api/                    # Auth, chat, documents, upload, processing and workspace routes
  components/
    chat/                   # Chat interface components
    documents/              # Upload, document grid and viewer components
  lib/
    ai/                     # Provider and model configuration
    auth/                   # Authentication and workspace guards
    db/                     # Prisma client and queries
    documents/              # Extractors, chunking, processing and retrieval
    queue/                  # Background processing
    storage/                # Local and S3-compatible storage adapters
    validators/             # Request validation
prisma/
  migrations/               # Database migrations
  schema.prisma             # Data model
scripts/                    # Focused storage and processing checks
.env.example                # Environment variable template
~~~

## Project links

- **Repository:** https://github.com/CodeWithSalik/documind-ai
- **Deployed preview:** https://documind-ai-smoky.vercel.app
- **Developer:** https://github.com/CodeWithSalik

---

Built independently by **Pirzada Salik Hilal** as a full-stack document intelligence project. The repository is maintained as a work in progress; check the source and deployment configuration for the current implementation state.
