import * as React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { WorkspaceClientLayout } from "@/components/layout/workspace-client-layout";
import { Sparkles } from "lucide-react";

async function AuthenticatedWorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  let session = null;
  try {
    session = await auth();
  } catch {
    redirect("/login");
  }

  const testUser =
    process.env.NODE_ENV !== "production"
      ? (globalThis as unknown as { __TEST_USER__?: { id: string; email: string; name?: string | null } }).__TEST_USER__
      : undefined;

  const activeUser = session?.user || testUser;

  if (!activeUser?.id && !activeUser?.email) {
    redirect("/login");
  }

  return <WorkspaceClientLayout user={activeUser}>{children}</WorkspaceClientLayout>;
}

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.Suspense
      fallback={
        <div className="h-screen w-full bg-background flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
            <Sparkles className="size-4 text-primary" />
            <span>Loading DocuMind workspace...</span>
          </div>
        </div>
      }
    >
      <AuthenticatedWorkspaceShell>{children}</AuthenticatedWorkspaceShell>
    </React.Suspense>
  );
}
