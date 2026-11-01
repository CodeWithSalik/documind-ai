"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Loader2 } from "lucide-react";

function ConversationPageInner() {
  const params = useParams();
  const router = useRouter();
  const conversationId = (params?.id as string) || "default";

  const { activeWorkspaceId, setActiveConversationId, loadWorkspaces } = useWorkspaceStore();
  const [threadTitle, setThreadTitle] = React.useState("DocuMind Conversation");

  React.useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  React.useEffect(() => {
    if (conversationId && conversationId !== "default") {
      setActiveConversationId(conversationId);
    }
  }, [conversationId, setActiveConversationId]);

  return (
    <div className="h-full w-full">
      <ChatPanel
        conversationId={conversationId}
        workspaceId={activeWorkspaceId || "default-workspace"}
        conversationTitle={threadTitle}
        onTitleChange={setThreadTitle}
        onViewArtifact={(artifactName) => {
          router.push(`/artifacts?name=${encodeURIComponent(artifactName)}`);
        }}
        onClearConversation={() => {
          router.push("/chat");
        }}
      />
    </div>
  );
}

export default function ConversationPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground animate-pulse">
          <Loader2 className="mr-2 size-4 animate-spin text-primary" />
          <span>Loading conversation thread...</span>
        </div>
      }
    >
      <ConversationPageInner />
    </React.Suspense>
  );
}
