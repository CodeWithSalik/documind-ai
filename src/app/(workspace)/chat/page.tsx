"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { useWorkspaceStore } from "@/stores/workspace-store";

export default function NewChatPage() {
  const router = useRouter();
  const { activeWorkspaceId, setActiveConversationId, loadWorkspaces } = useWorkspaceStore();

  React.useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  return (
    <div className="h-full w-full">
      <ChatPanel
        workspaceId={activeWorkspaceId || "default-workspace"}
        conversationTitle="DocuMind Research Chat"
        onViewArtifact={(artifactName) => {
          router.push(`/artifacts?name=${encodeURIComponent(artifactName)}`);
        }}
        onClearConversation={() => {
          setActiveConversationId(null);
        }}
      />
    </div>
  );
}
