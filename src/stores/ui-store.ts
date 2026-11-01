import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  toggleSidebar: () => void;
  setSidebarMobileOpen: (open: boolean) => void;

  // Document panel
  documentPanelOpen: boolean;
  documentPanelWidth: number;
  toggleDocumentPanel: () => void;
  setDocumentPanelWidth: (width: number) => void;

  // Theme
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar defaults
      sidebarCollapsed: false,
      sidebarMobileOpen: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),

      // Document panel defaults
      documentPanelOpen: true,
      documentPanelWidth: 400,
      toggleDocumentPanel: () =>
        set((state) => ({ documentPanelOpen: !state.documentPanelOpen })),
      setDocumentPanelWidth: (width) => set({ documentPanelWidth: width }),

      // Theme defaults
      theme: "system",
      setTheme: (theme) => set({ theme }),

      // Command palette
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
    }),
    {
      name: "documind-ui",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        documentPanelOpen: state.documentPanelOpen,
        documentPanelWidth: state.documentPanelWidth,
        theme: state.theme,
      }),
    },
  ),
);
