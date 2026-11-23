import { useEffect, useState } from "react";
import {
  ArrowUpDown,
  ChevronRight,
  HardDrive,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import logo from "../assets/quark-logo.png";
import { cn, formatBytes, vipLabel } from "../lib/utils";
import { useAppStore, type Page } from "../store";

const nav: Array<{ page: Page; label: string }> = [
  { page: "files", label: "我的网盘" },
  { page: "privacy", label: "隐私空间" },
  { page: "recycle", label: "回收站" },
];

export default function Sidebar() {
  const account = useAppStore((state) => state.account);
  const page = useAppStore((state) => state.page);
  const setPage = useAppStore((state) => state.setPage);
  const transfers = useAppStore((state) => state.transfers);
  const transfersOpen = useAppStore((state) => state.transfersOpen);
  const openTransfers = useAppStore((state) => state.openTransfers);
  const activeCount = transfers.filter((item) =>
    ["queued", "running", "preparing", "committing", "paused"].includes(item.status),
  ).length;
  const used = account?.usedSpace ?? 0;
  const total = account?.totalSpace ?? 0;
  const ratio = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const initial = (account?.nickname || "Q").slice(0, 1).toUpperCase();

  return (
    <aside className="qd-sidebar">
      <div className="qd-brand">
        <img src={logo} alt="" />
        <div className="min-w-0">
          <div className="qd-brand-name">夸克网盘</div>
          <div className="qd-brand-sub">
            Linux 客户端 <span className="qd-chip">非官方</span>
          </div>
        </div>
      </div>

      <nav className="qd-nav">
        <div className="qd-nav-label">网盘</div>
        {nav.map(({ page: item, label }) => (
          <button
            key={item}
            onClick={() => setPage(item)}
            className={cn("qd-nav-item", page === item && "active")}
          >
            {item === "files" ? <HardDrive size={17} strokeWidth={1.8} /> : null}
            {item === "privacy" ? <ShieldCheck size={17} strokeWidth={1.8} /> : null}
            {item === "recycle" ? <Trash2 size={17} strokeWidth={1.8} /> : null}
            <span className="flex-1">{label}</span>
          </button>
        ))}
        <div className="qd-nav-label">其他</div>
        <button
          onClick={() => openTransfers()}
          className={cn("qd-nav-item", transfersOpen && "active")}
        >
          <ArrowUpDown size={17} strokeWidth={1.8} />
          <span className="flex-1">传输中心</span>
          {activeCount > 0 ? <span className="qd-count">{activeCount}</span> : null}
        </button>
      </nav>

      <div className="qd-side-foot">
        <div className="qd-storage">
          <div className="qd-storage-top">
            <span>存储空间</span>
            <span className="qd-storage-val">
              {formatBytes(used)} / {formatBytes(total)}
            </span>
          </div>
          <div className="qd-meter">
            <span style={{ width: `${Math.max(ratio, ratio > 0 ? 1.5 : 0)}%` }} />
          </div>
          <div className="qd-storage-bottom">
            <span>{total > 0 ? `剩余 ${formatBytes(Math.max(total - used, 0))}` : "未获取容量"}</span>
            <button className="qd-link-btn" onClick={() => setPage("settings")}>
              管理空间
            </button>
          </div>
        </div>

        <button className="qd-nav-item" onClick={() => setPage("settings")}>
          <SettingsIcon size={17} strokeWidth={1.8} />
          <span className="flex-1">设置</span>
        </button>

        <button className="qd-account" onClick={() => setPage("settings")}>
          <AccountAvatar src={account?.avatarUrl} initial={initial} />
          <div className="min-w-0 flex-1">
            <div className="qd-account-name">{account?.nickname || "未登录"}</div>
            <div className="qd-account-sub">
              {account?.isVip ? vipLabel(account.vipType) : "普通用户"}
            </div>
          </div>
          <ChevronRight size={14} className="shrink-0 text-[var(--faint)]" />
        </button>
      </div>
    </aside>
  );
}

function AccountAvatar({ src, initial }: { src?: string; initial: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <div className="qd-avatar">
        <img src={src} alt="" onError={() => setFailed(true)} />
      </div>
    );
  }
  return <div className="qd-avatar">{initial}</div>;
}
