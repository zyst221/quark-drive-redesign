import { create } from "zustand";
import type { Account, Settings, Transfer } from "./lib/types";
import { mergeTransferLists } from "./lib/transfers";

export type Page = "files" | "privacy" | "recycle" | "transfers" | "settings";
export type TransferTab = "upload" | "download";
export type ViewMode = "list" | "grid";

export interface Crumb {
  fid: string;
  name: string;
}

interface AppStore {
  account: Account | null;
  settings: Settings;
  dataDir: string;
  transfers: Transfer[];
  page: Page;
  transfersOpen: boolean;
  transfersTab: TransferTab;
  viewMode: ViewMode;
  crumbs: Crumb[];
  selection: string[];
  search: string;
  setAccount: (account: Account | null) => void;
  setSettings: (settings: Settings) => void;
  setDataDir: (dataDir: string) => void;
  setTransfers: (transfers: Transfer[]) => void;
  mergeTransfers: (transfers: Transfer[]) => void;
  upsertTransfer: (transfer: Transfer) => void;
  patchTransfer: (
    id: string,
    patch: Partial<Transfer> & { speedBps?: number },
  ) => void;
  setPage: (page: Page) => void;
  setViewMode: (mode: ViewMode) => void;
  openTransfers: (tab?: TransferTab) => void;
  closeTransfers: () => void;
  toggleTransfers: () => void;
  setTransfersTab: (tab: TransferTab) => void;
  enterFolder: (fid: string, name: string) => void;
  jumpTo: (index: number) => void;
  setSelection: (selection: string[]) => void;
  toggleSelection: (fid: string) => void;
  clearSelection: () => void;
  setSearch: (search: string) => void;
  resetCrumbs: () => void;
}

const defaultSettings: Settings = {
  downloadDir: "",
  concurrency: 2,
  maxSpeedBps: 0,
  theme: "system",
};

export const useAppStore = create<AppStore>((set) => ({
  account: null,
  settings: defaultSettings,
  dataDir: "",
  transfers: [],
  page: "files",
  transfersOpen: typeof window === "undefined" ? true : window.innerWidth >= 1180,
  transfersTab: "upload",
  viewMode: "list",
  crumbs: [{ fid: "0", name: "我的网盘" }],
  selection: [],
  search: "",
  setAccount: (account) => set({ account }),
  setSettings: (settings) => set({ settings }),
  setDataDir: (dataDir) => set({ dataDir }),
  setTransfers: (transfers) => set({ transfers }),
  mergeTransfers: (transfers) =>
    set((state) => ({ transfers: mergeTransferLists(state.transfers, transfers) })),
  upsertTransfer: (transfer) =>
    set((state) => {
      const exists = state.transfers.some((item) => item.id === transfer.id);
      return {
        transfers: exists
          ? state.transfers.map((item) =>
              item.id === transfer.id ? transfer : item,
            )
          : [transfer, ...state.transfers],
      };
    }),
  patchTransfer: (id, patch) =>
    set((state) => ({
      transfers: state.transfers.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    })),
  setPage: (page) => set({ page }),
  setViewMode: (viewMode) => set({ viewMode }),
  openTransfers: (tab) =>
    set((state) => ({
      transfersOpen: true,
      transfersTab: tab ?? state.transfersTab,
    })),
  closeTransfers: () => set({ transfersOpen: false }),
  toggleTransfers: () => set((state) => ({ transfersOpen: !state.transfersOpen })),
  setTransfersTab: (transfersTab) => set({ transfersTab }),
  enterFolder: (fid, name) =>
    set((state) => ({
      crumbs: [...state.crumbs, { fid, name }],
      selection: [],
      search: "",
    })),
  jumpTo: (index) =>
    set((state) => ({
      crumbs: state.crumbs.slice(0, index + 1),
      selection: [],
      search: "",
    })),
  setSelection: (selection) => set({ selection }),
  toggleSelection: (fid) =>
    set((state) => ({
      selection: state.selection.includes(fid)
        ? state.selection.filter((item) => item !== fid)
        : [...state.selection, fid],
    })),
  clearSelection: () => set({ selection: [] }),
  setSearch: (search) => set({ search }),
  resetCrumbs: () =>
    set({ crumbs: [{ fid: "0", name: "我的网盘" }], selection: [], search: "" }),
}));
