import type { Transfer } from "./types";

const TERMINAL = ["done", "failed", "canceled"];

/** 以数据库列表为基准，保留前端事件的更新的进度/速度，避免刷新时进度倒退。 */
export function mergeTransferLists(previous: Transfer[], incoming: Transfer[]): Transfer[] {
  const byId = new Map(previous.map((item) => [item.id, item]));
  return incoming.map((fresh) => {
    const old = byId.get(fresh.id);
    if (!old) return fresh;
    const oldTerminal = TERMINAL.includes(old.status);
    const freshTerminal = TERMINAL.includes(fresh.status);
    const status = oldTerminal && !freshTerminal ? old.status : fresh.status;
    const phase = status === fresh.status ? fresh.phase : old.phase;
    const doneBytes = Math.max(fresh.doneBytes || 0, old.doneBytes || 0);
    const active = ["running", "preparing", "committing"].includes(status);
    return {
      ...fresh,
      status,
      phase,
      doneBytes,
      speedBps: active ? old.speedBps || fresh.speedBps : 0,
    };
  });
}
