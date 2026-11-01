import { create } from "zustand";

export interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  role: "OWNER" | "MEMBER" | "VIEWER";
  plan?: string;
  documentCount?: number;
  conversationCount?: number;
  memberCount?: number;
}

interface WorkspaceState {
  // Current workspace
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  workspaces: WorkspaceItem[];
  setWorkspaces: (workspaces: WorkspaceItem[]) => void;
  isLoadingWorkspaces: boolean;
  loadWorkspaces: () => Promise<WorkspaceItem[]>;

  // Document selection (for multi-select operations)
  selectedDocumentIds: Set<string>;
  toggleDocumentSelection: (id: string) => void;
  selectAllDocuments: (ids: string[]) => void;
  clearDocumentSelection: () => void;

  // Chat context: documents selected as AI context
  contextDocumentIds: string[];
  addContextDocument: (id: string) => void;
  removeContextDocument: (id: string) => void;
  clearContextDocuments: () => void;
  setContextDocuments: (ids: string[]) => void;

  // Active conversation
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  // Workspace
  activeWorkspaceId: null,
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  workspaces: [],
  setWorkspaces: (workspaces) => set({ workspaces }),
  isLoadingWorkspaces: false,

  loadWorkspaces: async () => {
    set({ isLoadingWorkspaces: true });
    try {
      const res = await fetch("/api/workspaces");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.items)) {
          const items: WorkspaceItem[] = json.data.items;
          set({ workspaces: items });

          // Refresh / auto-heal activeWorkspaceId
          const currentId = get().activeWorkspaceId;
          const isValidId = items.some((w) => w.id === currentId);

          if ((!currentId || !isValidId) && items.length > 0) {
            set({ activeWorkspaceId: items[0].id });
          }
          return items;
        }
      }
    } catch (err) {
      console.warn("Failed to load user workspaces:", err);
    } finally {
      set({ isLoadingWorkspaces: false });
    }
    return [];
  },

  // Document selection
  selectedDocumentIds: new Set(),
  toggleDocumentSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedDocumentIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedDocumentIds: next };
    }),
  selectAllDocuments: (ids) =>
    set({ selectedDocumentIds: new Set(ids) }),
  clearDocumentSelection: () =>
    set({ selectedDocumentIds: new Set() }),

  // Context documents
  contextDocumentIds: [],
  addContextDocument: (id) =>
    set((state) => ({
      contextDocumentIds: state.contextDocumentIds.includes(id)
        ? state.contextDocumentIds
        : [...state.contextDocumentIds, id],
    })),
  removeContextDocument: (id) =>
    set((state) => ({
      contextDocumentIds: state.contextDocumentIds.filter((d) => d !== id),
    })),
  clearContextDocuments: () => set({ contextDocumentIds: [] }),
  setContextDocuments: (ids) => set({ contextDocumentIds: ids }),

  // Active conversation
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),
}));
