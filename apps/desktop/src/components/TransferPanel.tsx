import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Pause, Play, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { backend } from "../lib/backend";
import type { Transfer } from "../lib/types";
import { cn, formatBytes, formatSpeed, percent, phaseLabel } from "../lib/utils";
import { useAppStore } from "../store";
import { FileTile } from "./FileTile";

const ACTIVE = ["queued", "running", "preparing", "committing"];
const RANK: Record<string, number> = {
  running: 0,
  preparing: 1,
  committing: 2,
  queued: 3,
  paused: 4,
  failed: 5,
  done: 6,
  canceled: 7,
};

export default function TransferPanel() {
  const transfers = useAppStore((state) => state.transfers);
  const setTransfers = useAppStore((state) => state.setTransfers);
  const mergeTransfers = useAppStore((state) => state.mergeTransfers);
  const tab = useAppStore((state) => state.transfersTab);
  const setTab = useAppStore((state) => state.setTransfersTab);
  const close = useAppStore((state) => state.closeTransfers);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const tick = () => {
      backend
        .listTransfers()
        .then((list) => {
          if (active) mergeTransfers(list);
        })
        .catch(() => undefined);
    };
    tick();
    const timer = window.setInterval(tick, 1500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [mergeTransfers]);

  const uploads = useMemo(() => transfers.filter((item) => item.kind === "upload"), [transfers]);
  const downloads = useMemo(
    () => transfers.filter((item) => item.kind === "download"),
    [transfers],
  );
  const list = useMemo(() => {
    const source = tab === "upload" ? uploads : downloads;
    return [...source].sort((a, b) => {
      const rank = (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9);
      return rank !== 0 ? rank : b.createdAt - a.createdAt;
    });
  }, [tab, uploads, downloads]);

  const active = transfers.filter((item) => ACTIVE.includes(item.status));
  const totalSpeed = active.reduce((sum, item) => sum + (item.speedBps || 0), 0);
  const finished = transfers.filter((item) => ["done", "failed", "canceled"].includes(item.status));

  async function act(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await action();
      const next = await backend.listTransfers();
      setTransfers(next);
    } catch (error) {
      toast.error(`${error}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <aside className="qd-transfers" aria-label="传输中心">
      <div className="qd-panel-head">
        <span className="qd-panel-title">传输中心</span>
        <button className="qd-icon-btn" onClick={close} aria-label="关闭传输中心">
          <X size={16} />
        </button>
      </div>

      <div className="qd-seg" role="tablist">
        <button
          className={cn(tab === "upload" && "on")}
          role="tab"
          aria-selected={tab === "upload"}
          onClick={() => setTab("upload")}
        >
          上传 <span className="qd-n">{uploads.length}</span>
        </button>
        <button
          className={cn(tab === "download" && "on")}
          role="tab"
          aria-selected={tab === "download"}
          onClick={() => setTab("download")}
        >
          下载 <span className="qd-n">{downloads.length}</span>
        </button>
      </div>

      <div className="qd-tasks">
        {list.length === 0 ? (
          <div className="qd-empty" style={{ padding: "44px 12px" }}>
            <span className="qd-empty-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
              {tab === "upload" ? <Play size={20} /> : <FolderOpen size={20} />}
            </span>
            <h3>暂无{tab === "upload" ? "上传" : "下载"}任务</h3>
            <p>从文件区上传或下载后，进度会显示在这里。</p>
          </div>
        ) : (
          list.map((item) => (
            <TaskRow
              key={item.id}
              transfer={item}
              busy={busyId === item.id}
              onAction={(action) => act(item.id, action)}
            />
          ))
        )}
      </div>

      <div className="qd-panel-foot">
        <span>
          {active.length ? (
            <>
              {active.length} 个任务进行中 ·{" "}
              <span className="qd-speed">{formatSpeed(totalSpeed)}</span>
            </>
          ) : (
            "没有进行中的任务"
          )}
        </span>
        <span className="qd-spacer" />
        <button
          className="qd-link-btn disabled:opacity-40"
          disabled={!finished.length || busyId === "clear"}
          onClick={() =>
            act("clear", async () => {
              await backend.clearFinished();
              toast.success("已清理结束的任务");
            })
          }
        >
          清空已完成
        </button>
      </div>
    </aside>
  );
}

function TaskRow({
  transfer,
  busy,
  onAction,
}: {
  transfer: Transfer;
  busy: boolean;
  onAction: (action: () => Promise<unknown>) => void;
}) {
  const running = ACTIVE.includes(transfer.status) && transfer.status !== "queued";
  const progress = percent(transfer.doneBytes, transfer.totalBytes);
  const statusText =
    transfer.status === "done"
      ? "已完成"
      : transfer.status === "failed"
        ? "失败"
        : transfer.status === "paused"
          ? "已暂停"
          : transfer.status === "canceled"
            ? "已取消"
            : phaseLabel(transfer.phase || transfer.status);
  const done = transfer.status === "done";

  return (
    <div
      className={cn(
        "qd-task",
        done && "done",
        transfer.status === "paused" && "paused",
      )}
    >
      <FileTile name={transfer.remoteName} size={16} />
      <div className="qd-task-main">
        <div className="qd-task-top">
          <span className="qd-tname" title={transfer.remoteName}>
            {transfer.remoteName}
          </span>
          <span className="qd-tpct">{done ? "" : `${progress.toFixed(0)}%`}</span>
        </div>
        <div className="qd-bar">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="qd-tmeta">
          <span className={cn(done && "st-done", transfer.status === "paused" && "st-pause")}>
            {statusText}
            {transfer.status === "failed" && transfer.errorMessage
              ? ` · ${transfer.errorMessage}`
              : ""}
          </span>
          <span>
            {done
              ? formatBytes(transfer.totalBytes)
              : running
                ? formatSpeed(transfer.speedBps)
                : `${formatBytes(transfer.doneBytes)} / ${formatBytes(transfer.totalBytes)}`}
          </span>
        </div>
      </div>
      <div className="qd-task-acts">
        {running || transfer.status === "queued" ? (
          <button
            className="qd-icon-btn"
            title="暂停"
            disabled={busy || transfer.status === "queued"}
            onClick={() => onAction(() => backend.pauseTransfer(transfer.id))}
          >
            <Pause size={14} />
          </button>
        ) : null}
        {transfer.status === "paused" ? (
          <button
            className="qd-icon-btn"
            title="继续"
            disabled={busy}
            onClick={() => onAction(() => backend.resumeTransfer(transfer.id))}
          >
            <Play size={14} />
          </button>
        ) : null}
        {transfer.status === "failed" ? (
          <button
            className="qd-icon-btn"
            title="重试"
            disabled={busy}
            onClick={() => onAction(() => backend.retryTransfer(transfer.id))}
          >
            <RotateCcw size={14} />
          </button>
        ) : null}
        {transfer.kind === "download" && done ? (
          <button
            className="qd-icon-btn"
            title="打开所在文件夹"
            disabled={busy}
            onClick={() => onAction(() => backend.openPath(transfer.localPath))}
          >
            <FolderOpen size={14} />
          </button>
        ) : null}
        {!done && transfer.status !== "canceled" ? (
          <button
            className="qd-icon-btn"
            title="取消"
            disabled={busy}
            onClick={() => onAction(() => backend.cancelTransfer(transfer.id))}
          >
            <X size={14} />
          </button>
        ) : null}
        {["done", "canceled", "failed"].includes(transfer.status) ? (
          <button
            className="qd-icon-btn"
            title="移除记录"
            disabled={busy}
            onClick={() => onAction(() => backend.removeTransfer(transfer.id))}
          >
            <Trash2 size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
