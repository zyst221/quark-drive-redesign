import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  LayoutGrid,
  List,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { backend } from "../lib/backend";
import { cn } from "../lib/utils";
import { useAppStore } from "../store";
import Sidebar from "../components/Sidebar";
import TransferPanel from "../components/TransferPanel";
import FilesPage from "./FilesPage";
import RecycleBinPage from "./RecycleBinPage";
import SettingsPage from "./SettingsPage";
import PrivacyPage from "./PrivacyPage";

const titles: Record<string, string> = {
  files: "我的网盘",
  privacy: "隐私空间",
  recycle: "回收站",
  settings: "设置",
};

const ACTIVE = ["queued", "running", "preparing", "committing", "paused"];

export default function MainShell() {
  const page = useAppStore((state) => state.page);
  const crumbs = useAppStore((state) => state.crumbs);
  const jumpTo = useAppStore((state) => state.jumpTo);
  const account = useAppStore((state) => state.account);
  const search = useAppStore((state) => state.search);
  const setSearch = useAppStore((state) => state.setSearch);
  const viewMode = useAppStore((state) => state.viewMode);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const transfers = useAppStore((state) => state.transfers);
  const transfersOpen = useAppStore((state) => state.transfersOpen);
  const toggleTransfers = useAppStore((state) => state.toggleTransfers);
  const closeTransfers = useAppStore((state) => state.closeTransfers);
  const settings = useAppStore((state) => state.settings);
  const setSettings = useAppStore((state) => state.setSettings);
  const selection = useAppStore((state) => state.selection);
  const clearSelection = useAppStore((state) => state.clearSelection);
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isFiles = page === "files";
  const activeCount = transfers.filter((item) => ACTIVE.includes(item.status)).length;
  const currentFid = crumbs[crumbs.length - 1]?.fid ?? "0";
  const theme = settings.theme;
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  async function refresh() {
    if (!account || refreshing) return;
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        queryKey: ["files", account.id, currentFid],
      });
    } finally {
      window.setTimeout(() => setRefreshing(false), 450);
    }
  }

  async function cycleTheme() {
    const order = ["system", "light", "dark"];
    const next = order[(order.indexOf(theme) + 1) % order.length] ?? "system";
    const optimistic = { ...settings, theme: next };
    setSettings(optimistic);
    try {
      const saved = await backend.updateSettings({ theme: next });
      setSettings(saved);
    } catch (error) {
      setSettings(settings);
      toast.error(`主题保存失败：${error}`);
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(
        (document.activeElement as HTMLElement | null)?.tagName || "",
      );
      if (event.key === "/" && !typing && isFiles) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === "Escape") {
        if (document.activeElement === searchRef.current) {
          setSearch("");
          searchRef.current?.blur();
        } else if (selection.length) {
          clearSelection();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection, isFiles, selection.length, setSearch]);

  return (
    <div className="qd-app">
      <Sidebar />
      <main className="qd-main">
        <header className="qd-topbar">
          {isFiles ? (
            <div className="qd-crumbs">
              {crumbs.map((crumb, index) => (
                <div key={`${crumb.fid}-${index}`} className="flex min-w-0 items-center gap-0.5">
                  {index > 0 ? (
                    <span className="qd-crumb-sep">
                      <ChevronRight size={14} />
                    </span>
                  ) : null}
                  {index === crumbs.length - 1 ? (
                    <span className="qd-crumb">{crumb.name}</span>
                  ) : (
                    <button className="qd-crumb muted" onClick={() => jumpTo(index)}>
                      {crumb.name}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="qd-crumbs">
              <span className="qd-crumb">{titles[page] ?? "夸克网盘"}</span>
            </div>
          )}

          {isFiles ? (
            <div className="qd-search">
              <SearchGlyph />
              <input
                ref={searchRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索当前目录中的文件"
                aria-label="搜索文件"
              />
              {search ? (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--faint)] hover:text-[var(--ink)]"
                  onClick={() => setSearch("")}
                  aria-label="清除搜索"
                >
                  <X size={14} />
                </button>
              ) : (
                <kbd className="qd-kbd">/</kbd>
              )}
            </div>
          ) : (
            <span className="qd-spacer" />
          )}

          {isFiles ? (
            <>
              <button
                className="qd-icon-btn"
                onClick={refresh}
                title="刷新"
                aria-label="刷新"
              >
                <RefreshCw size={16} className={cn(refreshing && "animate-spin")} />
              </button>
              <button
                className="qd-icon-btn"
                onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
                title={viewMode === "list" ? "切换为网格视图" : "切换为列表视图"}
                aria-label="切换视图"
              >
                {viewMode === "list" ? <LayoutGrid size={16} /> : <List size={16} />}
              </button>
            </>
          ) : null}

          <button
            className={cn("qd-icon-btn", transfersOpen && "on")}
            onClick={toggleTransfers}
            title="传输中心"
            aria-label="打开传输中心"
          >
            <TransferGlyph />
            {activeCount > 0 ? <span className="qd-badge">{activeCount}</span> : null}
          </button>

          <button className="qd-icon-btn" onClick={cycleTheme} title={`主题：${themeLabel(theme)}`} aria-label="切换主题">
            <ThemeIcon size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1">
          {page === "files" ? <FilesPage /> : null}
          {page === "privacy" ? <PrivacyPage /> : null}
          {page === "recycle" ? <RecycleBinPage /> : null}
          {page === "settings" ? <SettingsPage /> : null}
        </div>
      </main>

      {transfersOpen ? <TransferPanel /> : null}
      {transfersOpen ? (
        <div className="qd-scrim" onClick={closeTransfers} aria-hidden="true" />
      ) : null}
    </div>
  );
}

function themeLabel(theme: string) {
  if (theme === "light") return "浅色";
  if (theme === "dark") return "深色";
  return "跟随系统";
}

function SearchGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.4-3.4" />
    </svg>
  );
}

function TransferGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M15 4v16" />
    </svg>
  );
}
