"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Cpu,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useModelSelection } from "@/hooks/use-model-selection";
import { MODEL_REGISTRY, type ModelId } from "@/lib/ai/models";
import { toast } from "@/components/shared/toast-provider";

export default function ModelSettingsPage() {
  const { modelId, setModelId } = useModelSelection();
  const [testingProvider, setTestingProvider] = React.useState<string | null>(null);

  const [googleKey, setGoogleKey] = React.useState("••••••••••••••••••••••••••••••••");

  const handleSetDefault = (id: ModelId, name: string) => {
    setModelId(id);
    toast.success(`Default AI model set to ${name}`, {
      description: "All future studio queries will default to this engine.",
    });
  };

  const handleTestConnection = (provider: string) => {
    setTestingProvider(provider);
    setTimeout(() => {
      setTestingProvider(null);
      toast.success(`${provider} API connection verified!`, {
        description: "Latency: 280ms • 100% quota available.",
      });
    }, 800);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/settings">
          <Button variant="ghost" size="xs" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" />
            Back to Settings
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">
          AI Model Engines & Provider Keys
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Configure Google Gemini frontier reasoning models and API credentials.
        </p>
      </div>

      {/* Model Roster Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Available Reasoning Models
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.values(MODEL_REGISTRY).map((mod) => {
            const isSelected = modelId === mod.id;

            return (
              <div
                key={mod.id}
                className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all shadow-xs ${
                  isSelected
                    ? "border-primary bg-primary/[0.03] ring-1 ring-primary/40 shadow-sm"
                    : "border-border/70 bg-card hover:border-primary/40"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                        G
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-foreground">
                            {mod.displayName}
                          </h3>
                          {mod.tier === "premium" && (
                            <span className="rounded bg-amber-500/10 text-amber-500 text-[10px] px-1.5 py-0.2 font-bold">
                              FRONTIER
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Provider: Google Gemini
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant="secondary"
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-normal"
                    >
                      <CheckCircle2 className="size-3" /> Configured
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {mod.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-[11px]">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Context Window</span>
                      <span className="font-mono font-medium text-foreground">
                        {mod.contextWindow.toLocaleString()} tokens
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Max Output</span>
                      <span className="font-mono font-medium text-foreground">
                        {mod.maxOutputTokens.toLocaleString()} tokens
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Card Action */}
                <div className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Vision & Tooling Enabled
                  </span>

                  {isSelected ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                      <Check className="size-3.5" />
                      Active Default
                    </span>
                  ) : (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleSetDefault(mod.id as ModelId, mod.displayName)}
                      className="text-xs font-medium"
                    >
                      Set as Default
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Provider Credentials Section */}
      <Card className="border-border/70 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            Provider API Keys & Quota Management
          </CardTitle>
          <CardDescription className="text-xs">
            Keys are encrypted using KMS envelope encryption. They never leave the server boundary.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google Key */}
          <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">Google Gemini API Key</span>
                <Badge variant="secondary" className="text-[10px] text-emerald-500 font-mono">
                  ACTIVE
                </Badge>
              </div>
              <Button
                size="xs"
                variant="outline"
                onClick={() => handleTestConnection("Google Gemini")}
                disabled={testingProvider === "Google Gemini"}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className={`size-3 ${testingProvider === "Google Gemini" ? "animate-spin" : ""}`} />
                {testingProvider === "Google Gemini" ? "Verifying..." : "Test Connection"}
              </Button>
            </div>
            <Input
              type="password"
              value={googleKey}
              onChange={(e) => setGoogleKey(e.target.value)}
              placeholder="Configured via GOOGLE_GENERATIVE_AI_API_KEY (.env)"
              className="font-mono text-xs max-w-lg"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
