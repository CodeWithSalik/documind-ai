"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Layers,
  FileSpreadsheet,
  FileText,
  FileCode,
  Lock,
  Cpu,
  Database,
  BarChart3,
  Bot,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  FileSearch,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const [activeTab, setActiveTab] = React.useState<"chat" | "spreadsheet" | "artifact">("chat");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-primary-foreground shadow-md shadow-primary/25 transition-transform group-hover:scale-105">
              <Sparkles className="size-5" />
            </div>
            <span className="font-heading text-lg font-bold tracking-tight">
              DocuMind<span className="text-primary font-extrabold">.AI</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#models" className="hover:text-foreground transition-colors">
              Models
            </a>
            <a href="#mockup" className="hover:text-foreground transition-colors">
              Workspace
            </a>
            <a href="#security" className="hover:text-foreground transition-colors">
              Security
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "font-medium")}
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5 shadow-sm shadow-primary/30")}
            >
              Launch Workspace
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-24 md:pt-28 md:pb-32">
          {/* Subtle Ambient Radial Lighting */}
          <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
            <div className="h-[450px] w-[650px] rounded-full bg-gradient-to-tr from-primary/15 via-indigo-500/10 to-pink-500/10 blur-[130px]" />
          </div>
          <div className="pointer-events-none absolute top-12 left-1/2 -translate-x-1/2 -z-10 h-72 w-full max-w-5xl bg-radial from-primary/5 via-transparent to-transparent blur-2xl" />

          <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary backdrop-blur-md shadow-xs animate-in fade-in-0 duration-700">
              <Sparkles className="size-3.5 animate-pulse text-primary" />
              <span>Next-Gen Document Intelligence</span>
              <span className="h-1 w-1 rounded-full bg-primary" />
              <span className="text-muted-foreground font-normal">Google Gemini Frontier</span>
            </div>

            {/* Main Headline */}
            <h1 className="mt-6 font-heading text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Turn Every Document Into{" "}
              <span className="bg-gradient-to-r from-primary via-indigo-500 to-purple-600 bg-clip-text text-transparent">
                Instant Intelligence
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 max-w-2xl mx-auto text-base sm:text-xl text-muted-foreground leading-relaxed">
              Upload dense PDFs, multi-tab spreadsheets, reports, and code. Reason
              across 1M+ context tokens with Google Gemini 1.5 Pro and 2.0 Flash, verify exact citations,
              and generate downloadable artifacts in seconds.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-11 px-6 text-sm font-semibold gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                )}
              >
                Launch Workspace
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#models"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-11 px-6 text-sm font-semibold gap-2 border-border/80 hover:bg-muted/80"
                )}
              >
                <Bot className="size-4 text-primary" />
                Explore Models
              </a>
            </div>

            {/* Trust metrics */}
            <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4 max-w-3xl mx-auto pt-8 border-t border-border/40 text-left sm:text-center">
              <div>
                <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-heading">
                  1,000,000+
                </div>
                <div className="text-xs text-muted-foreground mt-1">Context Window Tokens</div>
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-heading">
                  11+ Formats
                </div>
                <div className="text-xs text-muted-foreground mt-1">PDF, Excel, Docs, CSV, Code</div>
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-heading">
                  {"<600ms"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Streaming First-Token Latency</div>
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-heading">
                  100%
                </div>
                <div className="text-xs text-muted-foreground mt-1">Encrypted S3 Zero-Leakage</div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Workspace Mockup Preview */}
        <section id="mockup" className="py-16 md:py-24 bg-muted/30 border-y border-border/60">
          <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <Badge variant="outline" className="mb-3 border-primary/30 text-primary">
                Live Studio Interface
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl font-heading">
                Designed for Deep Analysis & Zero Friction
              </h2>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground">
                Experience dual-pane document previewing, source-anchored citations, and real-time artifact compilation.
              </p>

              {/* View Switcher Pills */}
              <div className="mt-6 inline-flex rounded-lg border border-border/80 bg-background/80 p-1 backdrop-blur-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("chat")}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                    activeTab === "chat"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  AI Document Chat
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("spreadsheet")}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                    activeTab === "spreadsheet"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Spreadsheet Pivot Engine
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("artifact")}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                    activeTab === "artifact"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Artifact Generator
                </button>
              </div>
            </div>

            {/* Mockup Frame */}
            <div className="relative rounded-2xl border border-border/80 bg-card shadow-2xl shadow-black/10 overflow-hidden ring-1 ring-border/50">
              {/* Window Header */}
              <div className="flex h-11 items-center justify-between border-b border-border/80 bg-muted/40 px-4">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-red-400/80" />
                  <div className="size-3 rounded-full bg-amber-400/80" />
                  <div className="size-3 rounded-full bg-emerald-400/80" />
                  <span className="ml-3 font-mono text-xs text-muted-foreground hidden sm:inline-block">
                    documind-ai.workspace / FY25_Quarterly_Strategy.pdf
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Gemini 2.5 Pro (Active)
                  </span>
                </div>
              </div>

              {/* Window Body */}
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[460px] bg-background">
                {/* Left Sidebar Mockup */}
                <div className="hidden md:block md:col-span-3 border-r border-border/60 bg-muted/20 p-4 space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Selected Context (2)
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-xs">
                      <FileText className="size-4 text-red-500 shrink-0" />
                      <div className="min-w-0 flex-1 truncate">
                        <div className="font-medium text-foreground truncate">FY25_Strategy.pdf</div>
                        <div className="text-[10px] text-muted-foreground">42 pages • 4.2 MB</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card p-2.5 text-xs">
                      <FileSpreadsheet className="size-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0 flex-1 truncate">
                        <div className="font-medium text-foreground truncate">Operating_Metrics.xlsx</div>
                        <div className="text-[10px] text-muted-foreground">3 sheets • 1.1 MB</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/50">
                    <div className="text-[11px] font-medium text-muted-foreground mb-1.5">Context Utilization</div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-indigo-500 w-[18%]" />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>182,400 tokens</span>
                      <span>1,048,576 max</span>
                    </div>
                  </div>
                </div>

                {/* Central Workspace Panel */}
                <div className="md:col-span-9 flex flex-col p-5 sm:p-6 justify-between bg-card/30">
                  {activeTab === "chat" && (
                    <div className="space-y-4">
                      {/* User message */}
                      <div className="flex justify-end">
                        <div className="max-w-md rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-xs sm:text-sm shadow-xs">
                          Compare the projected operating margin for Q3 vs Q4 and highlight the key risk factors cited in Section 4.
                        </div>
                      </div>

                      {/* AI message */}
                      <div className="flex items-start gap-3">
                        <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                          <Sparkles className="size-4" />
                        </div>
                        <div className="space-y-3 max-w-xl text-xs sm:text-sm text-foreground">
                          <p className="leading-relaxed">
                            Based on <strong>FY25_Strategy.pdf (p. 18)</strong> and the <strong>Operating_Metrics.xlsx</strong> model, here is the margin breakdown:
                          </p>

                          <div className="rounded-xl border border-border/80 overflow-hidden text-xs">
                            <table className="w-full border-collapse text-left">
                              <thead className="bg-muted/60 text-muted-foreground font-semibold">
                                <tr>
                                  <th className="p-2 border-b">Quarter</th>
                                  <th className="p-2 border-b">Revenue Target</th>
                                  <th className="p-2 border-b">Operating Margin</th>
                                  <th className="p-2 border-b">Delta YoY</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60">
                                <tr>
                                  <td className="p-2 font-medium">Q3 FY25</td>
                                  <td className="p-2">$18.4M</td>
                                  <td className="p-2 text-emerald-500 font-semibold">23.8%</td>
                                  <td className="p-2">+340 bps</td>
                                </tr>
                                <tr>
                                  <td className="p-2 font-medium">Q4 FY25</td>
                                  <td className="p-2">$22.1M</td>
                                  <td className="p-2 text-emerald-500 font-semibold">27.4%</td>
                                  <td className="p-2">+510 bps</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-[11px] font-medium text-muted-foreground">Sources verified:</span>
                            <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted/80 cursor-pointer">
                              <FileText className="size-3 text-red-500" />
                              Page 18, ¶ 3
                            </span>
                            <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted/80 cursor-pointer">
                              <FileSpreadsheet className="size-3 text-emerald-500" />
                              Sheet: Summary, Col F
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "spreadsheet" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="size-5 text-emerald-500" />
                          <span className="font-semibold text-sm">Operating_Metrics.xlsx — Live Grid Pivot</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">3 Sheets Detected</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-3 rounded-lg border bg-card">
                          <div className="text-xs text-muted-foreground">Total Revenue</div>
                          <div className="text-lg font-bold text-foreground mt-1">$40.5M</div>
                        </div>
                        <div className="p-3 rounded-lg border bg-card">
                          <div className="text-xs text-muted-foreground">Blended Margin</div>
                          <div className="text-lg font-bold text-emerald-500 mt-1">25.6%</div>
                        </div>
                        <div className="p-3 rounded-lg border bg-card">
                          <div className="text-xs text-muted-foreground">Formula Health</div>
                          <div className="text-lg font-bold text-blue-500 mt-1">100% Valid</div>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/40 font-mono text-xs text-muted-foreground">
                        AI Reasoning: Detected dynamic SUMIFS across multiple sheet ranges without formula degradation.
                      </div>
                    </div>
                  )}

                  {activeTab === "artifact" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div className="flex items-center gap-2">
                          <Layers className="size-5 text-purple-500" />
                          <span className="font-semibold text-sm">Executive_Summary_Deck.docx</span>
                        </div>
                        <Button size="xs" variant="outline" className="text-xs gap-1">
                          <ExternalLink className="size-3" /> Download Artifact
                        </Button>
                      </div>
                      <div className="p-4 rounded-xl border border-border/80 bg-muted/20 font-sans text-xs space-y-2 leading-relaxed">
                        <h4 className="font-bold text-sm text-foreground">Section 1: Strategic Priorities for H2</h4>
                        <p className="text-muted-foreground">
                          Synthesized across 4 ingested documents. Operational targets indicate a 24% increase in infrastructure investments balanced by streamlined automation.
                        </p>
                        <div className="p-2 rounded bg-primary/10 text-primary font-mono text-[11px]">
                          Artifact Type: DOCX • Size: 84 KB • Status: Generated in 1.4s
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Input Mockup Box */}
                  <div className="mt-6 pt-3 border-t border-border/60 flex items-center gap-2">
                    <div className="flex-1 rounded-xl border border-input bg-background/80 px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between">
                      <span>Ask anything about your documents, compare sheets, or request an artifact...</span>
                      <kbd className="hidden sm:inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">⌘K</kbd>
                    </div>
                    <Button size="sm" className="h-9 px-4">
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Feature Highlights */}
        <section id="features" className="py-20 md:py-28">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <Badge variant="outline" className="mb-3 border-primary/30 text-primary">
                Core Architecture
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-5xl font-heading">
                Built for High-Stakes Document Analysis
              </h2>
              <p className="mt-4 text-base sm:text-lg text-muted-foreground">
                Everything you need to process unformatted records, conduct financial cross-examinations,
                and generate actionable deliverables with enterprise fidelity.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Feature 1 */}
              <div className="group relative rounded-2xl border border-border/70 bg-card p-6 shadow-xs hover:border-primary/50 hover:shadow-md transition-all duration-300">
                <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Cpu className="size-6" />
                </div>
                <h3 className="text-lg font-semibold font-heading mb-2">Multi-Model Intelligence</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Toggle seamlessly between <strong>Gemini 1.5 Flash</strong>, <strong>Gemini 1.5 Pro</strong>, and <strong>Gemini 2.0 Flash</strong>.
                  Utilize up to 2,097,152 tokens to reason through book-length files without chunk loss.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="group relative rounded-2xl border border-border/70 bg-card p-6 shadow-xs hover:border-primary/50 hover:shadow-md transition-all duration-300">
                <div className="size-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <FileSearch className="size-6" />
                </div>
                <h3 className="text-lg font-semibold font-heading mb-2">Universal Format Support</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Ingest PDFs, Word DOCX, multi-tab Excel sheets, CSV, Markdown, JSON, and scanned images.
                  High-fidelity text and table extraction with zero data distortion.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="group relative rounded-2xl border border-border/70 bg-card p-6 shadow-xs hover:border-primary/50 hover:shadow-md transition-all duration-300">
                <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <BarChart3 className="size-6" />
                </div>
                <h3 className="text-lg font-semibold font-heading mb-2">Spreadsheet Pivot AI</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Direct formula evaluation across Excel & CSV files. Compute YoY delta, synthesize pivot metrics,
                  and generate visual chart data from numeric tables.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="group relative rounded-2xl border border-border/70 bg-card p-6 shadow-xs hover:border-primary/50 hover:shadow-md transition-all duration-300">
                <div className="size-11 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Layers className="size-6" />
                </div>
                <h3 className="text-lg font-semibold font-heading mb-2">Artifacts & Conversion</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Turn chat findings into polished files. Produce downloadable Word briefs, Excel worksheets,
                  and structured Markdown reports ready for stakeholder distribution.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Model Showcase Section */}
        <section id="models" className="py-20 bg-muted/20 border-t border-border/60">
          <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <Badge variant="outline" className="mb-3 border-primary/30 text-primary">
                Frontier Engines
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl font-heading">
                State-of-the-Art Model Roster
              </h2>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground">
                Engineered with native Google Generative AI & Gemini models.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Gemini 1.5 Pro Card */}
              <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      G
                    </div>
                    <div>
                      <h4 className="font-bold text-base">Gemini 1.5 Pro</h4>
                      <p className="text-xs text-muted-foreground">Deep Reasoning & Synthesis</p>
                    </div>
                  </div>
                  <Badge variant="secondary">2,097,152 Tokens</Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                  Massive context window ideal for ingesting entire regulatory binders, annual financial filings, and cross-document correlation.
                </p>
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-500">
                  <CheckCircle2 className="size-4" /> Multimodal Vision & Native Table Extraction
                </div>
              </div>

              {/* Gemini 2.0 Flash Card */}
              <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold">
                      ⚡
                    </div>
                    <div>
                      <h4 className="font-bold text-base">Gemini 2.0 Flash</h4>
                      <p className="text-xs text-muted-foreground">Next-Gen Speed & Tooling</p>
                    </div>
                  </div>
                  <Badge variant="secondary">1,048,576 Tokens</Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                  Ultra-low latency streaming, fast JSON synthesis, and rapid document chunk analysis for interactive workspace research.
                </p>
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-500">
                  <CheckCircle2 className="size-4" /> Real-time Streaming & Tool Execution
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security & Privacy Guarantee Banner */}
        <section id="security" className="py-16 bg-card border-y border-border/60">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 sm:p-10 relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ShieldCheck className="size-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold font-heading text-foreground">
                      Zero Client Exposure & Encrypted Storage
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground max-w-xl leading-relaxed">
                      Your documents are stored with AES-256 server-side encryption via AWS S3 presigned URLs.
                      Never trained on by public AI models. Every workspace is completely isolated with strict RBAC access controls.
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0">
                  <Link
                    href="/dashboard"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                    )}
                  >
                    Learn About Security
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Sleek Modern Footer */}
      <footer className="border-t border-border/60 bg-muted/20 py-12 text-sm text-muted-foreground">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="size-4" />
                </div>
                <span className="font-heading text-base font-bold text-foreground">
                  DocuMind<span className="text-primary">.AI</span>
                </span>
              </Link>
              <p className="mt-3 text-xs text-muted-foreground max-w-sm leading-relaxed">
                Next-generation intelligent document workspace. Empowering analysts, researchers, and enterprises
                to reason across documents with multimodal frontier models.
              </p>
            </div>

            <div>
              <h5 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-3">Workspace</h5>
              <ul className="space-y-2 text-xs">
                <li><Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link></li>
                <li><Link href="/documents" className="hover:text-foreground transition-colors">Documents</Link></li>
                <li><Link href="/chat" className="hover:text-foreground transition-colors">AI Studio Chat</Link></li>
                <li><Link href="/artifacts" className="hover:text-foreground transition-colors">Artifacts</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-3">Supported Models</h5>
              <ul className="space-y-2 text-xs">
                <li><Link href="/settings/models" className="hover:text-foreground transition-colors">Gemini 1.5 Flash</Link></li>
                <li><Link href="/settings/models" className="hover:text-foreground transition-colors">Gemini 1.5 Pro (2M Context)</Link></li>
                <li><Link href="/settings/models" className="hover:text-foreground transition-colors">Gemini 2.0 Flash</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-3">Enterprise</h5>
              <ul className="space-y-2 text-xs">
                <li><a href="#security" className="hover:text-foreground transition-colors">Security Architecture</a></li>
                <li><Link href="/login" className="hover:text-foreground transition-colors">Single Sign-On (SSO)</Link></li>
                <li><Link href="/settings/team" className="hover:text-foreground transition-colors">Team Access & RBAC</Link></li>
                <li><a href="mailto:support@documind.ai" className="hover:text-foreground transition-colors">Contact Engineering</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <p>© 2026 DocuMind AI, Inc. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-foreground transition-colors">Security Notice</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
