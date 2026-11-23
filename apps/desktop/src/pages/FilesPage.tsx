import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  AlertTriangle,
  ArrowUpDown,
  CloudUpload,
  Download,
  Folder,
  FolderPlus,
  Loader2,
  MoreHorizontal,
  MoveRight,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { backend, isDesktop } from "../lib/backend";
import { classifyBackendError, fileListErrorState } from "../lib/errors";
import { insertFile, removeFiles, renameFile } from "../lib/file-mutations";
import { extensionOf, kindOf, KIND_LABEL } from "../lib/file-types";
import type { FileItem, ListResult } from "../lib/types";
import { cn, formatBytes, formatDate } from "../lib/utils";
import { useAppStore } from "../store";
import { FileTile } from "../components/FileTile";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog } from "../components/ui/dialog";
import { Dropdown, DropdownItem, DropdownSeparator } from "../components/ui/dropdown";
import { Input } from "../components/ui/input";
import { MoveDestinationDialog } from "../components/MoveDestinationDialog";

type SortKey = "name" | "size" | "updatedAt";

const SORT_LABEL: Record<SortKey, string> = {
  name: "名称",
  size: "大小",
  updatedAt: "修改日期",
};

export default function FilesPage() {
  const account = useAppStore((state) => state.account)!;
  const crumbs = useAppStore((state) => state.crumbs);
  const enterFolder = useAppStore((state) => state.enterFolder);
  const viewMode = useAppStore((state) => state.viewMode);
  const selection = useAppStore((state) => state.selection);
  const setSelection = useAppStore((state) => state.setSelection);
  const toggleSelection = useAppStore((state) => state.toggleSelection);
  const clearSelection = useAppStore((state) => state.clearSelection);
  const search = useAppStore((state) => state.search);
  const openTransfers = useAppStore((state) => state.openTransfers);
  const mergeTransfers = useAppStore((state) => state.mergeTransfers);
  const queryClient = useQueryClient();
  const current = crumbs[crumbs.length - 1];
  const scrollRef = useRef<HTMLDivElement>(null);

  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("新建文件夹");
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const query = useQuery({
    queryKey: ["files", account.id, current.fid],
    queryFn: () => backend.listDir(account.id, current.fid),
    retry: (failureCount, error) => classifyBackendError(error) === "other" && failureCount < 1,
  });

  const files = useMemo(() => {
    const entries = query.data?.entries ?? [];
    const keyword = search.trim().toLowerCase();
    const filtered = keyword
      ? entries.filter((item) => item.name.toLowerCase().includes(keyword))
      : [...entries];
    return filtered.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      const dir = sort.dir;
      if (sort.key === "name") return a.name.localeCompare(b.name, "zh-CN") * dir;
      if (sort.key === "size") return ((a.size || 0) - (b.size || 0)) * dir;
      return ((a.updatedAt || 0) - (b.updatedAt || 0)) * dir;
    });
  }, [query.data, search, sort]);

  const selectedItems = useMemo(
    () => files.filter((item) => selection.includes(item.fid)),
    [files, selection],
  );
  const allSelected = files.length > 0 && selectedItems.length === files.length;

  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 54,
    overscan: 10,
  });

  useEffect(() => {
    if (!isDesktop) return;
    let dispose: (() => void) | undefined;
    let active = true;
    getCurrentWebview()
      .onDragDropEvent(async (event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setDragging(true);
          return;
        }
        if (event.payload.type === "leave") {
          setDragging(false);
          return;
        }
        if (event.payload.type === "drop") {
          setDragging(false);
          const paths = event.payload.paths ?? [];
          if (!paths.length) return;
          try {
            const ids = await backend.enqueueUpload(account.id, paths, current.fid);
            await refreshTransfers();
            void queryClient.invalidateQueries({ queryKey: ["files", account.id] });
            toast.success(`已加入上传队列（${ids.length} 项）`);
            openTransfers("upload");
          } catch (error) {
            toast.error(`上传失败：${error}`);
          }
        }
      })
      .then((unlisten) => {
        if (active) dispose = unlisten;
        else unlisten();
      })
      .catch(() => undefined);
    return () => {
      active = false;
      dispose?.();
    };
  }, [account.id, current.fid, openTransfers, queryClient]);

  async function refresh() {
    await query.refetch();
  }

  function updateCurrentFolder(
    updater: (previous: ListResult | undefined) => ListResult | undefined,
  ) {
    queryClient.setQueryData<ListResult>(
      ["files", account.id, current.fid],
      updater,
    );
  }

  function reconcileAfterMutation(reapply?: () => void) {
    void (async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      await refresh();
      reapply?.();
    })();
  }

  async function refreshTransfers() {
    try {
      mergeTransfers(await backend.listTransfers());
    } catch {
      // 面板自身的轮询会兜底
    }
  }

  async function upload(kind: "files" | "folder") {
    try {
      const paths =
        kind === "files"
          ? await backend.pickFiles()
          : await backend.pickFolder().then((path) => (path ? [path] : []));
      if (!paths.length) return;
      setBusy(true);
      const ids = await backend.enqueueUpload(account.id, paths, current.fid);
      await refreshTransfers();
      void queryClient.invalidateQueries({ queryKey: ["files", account.id] });
      toast.success(`已加入上传队列（${ids.length} 个文件）`);
      openTransfers("upload");
    } catch (error) {
      toast.error(`上传失败：${error}`);
    } finally {
      setBusy(false);
    }
  }

  async function download(items: FileItem[]) {
    if (!items.length) return;
    try {
      const ids = await backend.enqueueDownload(
        account.id,
        items.map((item) => ({
          fid: item.fid,
          name: item.name,
          size: item.size,
          isDir: item.isDir,
        })),
      );
      await refreshTransfers();
      toast.success(`已加入下载队列（${ids.length} 项）`);
      openTransfers("download");
    } catch (error) {
      toast.error(`下载失败：${error}`);
    }
  }

  async function createFolder() {
    if (!folderName.trim()) return;
    try {
      setBusy(true);
      const name = folderName.trim();
      const fid = await backend.mkdir(account.id, current.fid, name);
      const created: FileItem | undefined = fid
        ? {
            fid,
            parentFid: current.fid,
            name,
            isDir: true,
            size: 0,
            category: 0,
            formatType: "",
            updatedAt: Date.now(),
            thumbnail: "",
          }
        : undefined;
      if (created) {
        updateCurrentFolder((previous) => insertFile(previous, created));
      }
      setNewFolderOpen(false);
      setFolderName("新建文件夹");
      toast.success("文件夹已创建");
      reconcileAfterMutation(
        created
          ? () => updateCurrentFolder((previous) => insertFile(previous, created))
          : undefined,
      );
    } catch (error) {
      toast.error(`创建失败：${error}`);
    } finally {
      setBusy(false);
    }
  }

  async function confirmRename() {
    const target = renameTarget;
    const name = renameName.trim();
    if (!target || !name) return;
    try {
      setBusy(true);
      await backend.rename(account.id, target.fid, name);
      updateCurrentFolder((previous) => renameFile(previous, target.fid, name));
      setRenameTarget(null);
      toast.success("已重命名");
      reconcileAfterMutation(() =>
        updateCurrentFolder((previous) => renameFile(previous, target.fid, name)),
      );
    } catch (error) {
      toast.error(`重命名失败：${error}`);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!selectedItems.length) return;
    const fids = selectedItems.map((item) => item.fid);
    try {
      setBusy(true);
      await backend.deleteFiles(account.id, fids);
      updateCurrentFolder((previous) => removeFiles(previous, fids));
      void queryClient.invalidateQueries({ queryKey: ["recycle", account.id] });
      clearSelection();
      setDeleteOpen(false);
      toast.success("已移入回收站");
      reconcileAfterMutation(() =>
        updateCurrentFolder((previous) => removeFiles(previous, fids)),
      );
    } catch (error) {
      toast.error(`删除失败：${error}`);
    } finally {
      setBusy(false);
    }
  }

  function openItem(item: FileItem) {
    if (item.isDir) {
      enterFolder(item.fid, item.name);
    } else {
      void download([item]);
    }
  }

  function changeSort(key: SortKey) {
    setSort((previous) =>
      previous.key === key ? { key, dir: previous.dir === 1 ? -1 : 1 } : { key, dir: 1 },
    );
  }

  function cycleSort() {
    const order: SortKey[] = ["name", "size", "updatedAt"];
    const next = order[(order.indexOf(sort.key) + 1) % order.length];
    setSort({ key: next, dir: 1 });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="qd-toolbar">
        <Dropdown
          align="start"
          trigger={
            <button className="qd-btn qd-btn-primary" disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              上传文件
            </button>
          }
        >
          <DropdownItem onSelect={() => upload("files")}>
            <CloudUpload size={14} />
            上传文件
          </DropdownItem>
          <DropdownItem onSelect={() => upload("folder")}>
            <Folder size={14} />
            上传文件夹
          </DropdownItem>
        </Dropdown>
        <button className="qd-btn qd-btn-ghost" onClick={() => setNewFolderOpen(true)}>
          <FolderPlus size={15} />
          新建文件夹
        </button>
        <span className="qd-spacer" />
        <button className="qd-btn qd-btn-quiet" onClick={cycleSort} title="切换排序字段">
          <ArrowUpDown size={14} />
          {SORT_LABEL[sort.key]} {sort.dir === 1 ? "↑" : "↓"}
        </button>
      </div>

      {selection.length > 0 ? (
        <div className="qd-selection">
          <span>
            <strong>{selection.length}</strong> 项已选
          </span>
          <button className="qd-btn qd-btn-ghost" onClick={() => download(selectedItems)}>
            <Download size={14} />
            下载
          </button>
          <button className="qd-btn qd-btn-ghost" onClick={() => setMoveOpen(true)}>
            <MoveRight size={14} />
            移动
          </button>
          <button className="qd-btn qd-btn-danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={14} />
            删除
          </button>
          <span className="qd-spacer" />
          <button className="qd-btn qd-btn-quiet" onClick={clearSelection}>
            取消选择
          </button>
        </div>
      ) : null}

      <div className="qd-content">
        {query.isError ? (
          <FileListError error={query.error} retrying={query.isFetching} onRetry={refresh} />
        ) : viewMode === "list" ? (
          <>
            <div className="qd-list-head">
              <label className="qd-check">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() =>
                    allSelected ? clearSelection() : setSelection(files.map((item) => item.fid))
                  }
                  aria-label="全选"
                />
              </label>
              <button className={cn("qd-hcol", sort.key === "name" && "sorted")} onClick={() => changeSort("name")}>
                文件名 {sort.key === "name" ? (sort.dir === 1 ? "↑" : "↓") : "↕"}
              </button>
              <button className={cn("qd-hcol", sort.key === "size" && "sorted")} onClick={() => changeSort("size")}>
                大小 {sort.key === "size" ? (sort.dir === 1 ? "↑" : "↓") : "↕"}
              </button>
              <button className={cn("qd-hcol", sort.key === "updatedAt" && "sorted")} onClick={() => changeSort("updatedAt")}>
                修改日期 {sort.key === "updatedAt" ? (sort.dir === 1 ? "↑" : "↓") : "↕"}
              </button>
              <span />
            </div>
            <div ref={scrollRef} className="qd-scroll">
              {query.isLoading ? (
                <div className="space-y-2 p-1">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="skeleton h-[46px] rounded-[9px]" />
                  ))}
                </div>
              ) : files.length === 0 ? (
                <EmptyState
                  search={search}
                  onUpload={() => upload("files")}
                  onCreate={() => setNewFolderOpen(true)}
                />
              ) : (
                <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const item = files[virtualRow.index];
                    const selected = selection.includes(item.fid);
                    const kind = kindOf(item.name, item.isDir);
                    return (
                      <div
                        key={item.fid}
                        className={cn("qd-row absolute left-0 top-0 w-full", selected && "selected")}
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        onDoubleClick={() => openItem(item)}
                      >
                        <div className="qd-check" onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggleSelection(item.fid)}
                            aria-label={`选择 ${item.name}`}
                          />
                        </div>
                        <button
                          className="qd-name-cell"
                          onClick={() =>
                            item.isDir ? openItem(item) : toggleSelection(item.fid)
                          }
                        >
                          <FileTile name={item.name} isDir={item.isDir} />
                          <span className="qd-name-wrap">
                            <span className={cn("qd-fname", item.isDir && "folder")}>{item.name}</span>
                            {!item.isDir ? (
                              <span className="qd-fpath">
                                {(item.formatType || extensionOf(item.name) || KIND_LABEL[kind]).toUpperCase()}
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <span className="qd-size">{item.isDir ? "—" : formatBytes(item.size)}</span>
                        <span className="qd-date">{formatDate(item.updatedAt)}</span>
                        <span className="qd-actions">
                          <button
                            className="qd-icon-btn"
                            title="下载"
                            onClick={(event) => {
                              event.stopPropagation();
                              void download([item]);
                            }}
                          >
                            <Download size={15} />
                          </button>
                          <ItemMenu
                            item={item}
                            onOpen={() => openItem(item)}
                            onRename={() => {
                              setRenameTarget(item);
                              setRenameName(item.name);
                            }}
                            onMove={() => {
                              setSelection([item.fid]);
                              setMoveOpen(true);
                            }}
                            onDelete={() => {
                              setSelection([item.fid]);
                              setDeleteOpen(true);
                            }}
                          />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div ref={scrollRef} className="qd-scroll">
            {query.isLoading ? (
              <div className="qd-grid">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="skeleton h-36 rounded-xl" />
                ))}
              </div>
            ) : files.length === 0 ? (
              <EmptyState
                search={search}
                onUpload={() => upload("files")}
                onCreate={() => setNewFolderOpen(true)}
              />
            ) : (
              <div className="qd-grid">
                {files.map((item) => {
                  const selected = selection.includes(item.fid);
                  return (
                    <div
                      key={item.fid}
                      className={cn("qd-card", selected && "selected")}
                      onDoubleClick={() => openItem(item)}
                      onClick={() => toggleSelection(item.fid)}
                    >
                      <div className="qd-card-top">
                        <FileTile name={item.name} isDir={item.isDir} size={22} />
                        <span className="qd-card-acts" onClick={(event) => event.stopPropagation()}>
                          <ItemMenu
                            item={item}
                            onOpen={() => openItem(item)}
                            onRename={() => {
                              setRenameTarget(item);
                              setRenameName(item.name);
                            }}
                            onMove={() => {
                              setSelection([item.fid]);
                              setMoveOpen(true);
                            }}
                            onDelete={() => {
                              setSelection([item.fid]);
                              setDeleteOpen(true);
                            }}
                          />
                        </span>
                      </div>
                      <button
                        className={cn("qd-card-name", item.isDir && "folder")}
                        onClick={(event) => {
                          event.stopPropagation();
                          item.isDir ? openItem(item) : toggleSelection(item.fid);
                        }}
                      >
                        {item.name}
                      </button>
                      <div className="qd-card-meta">
                        <span>{KIND_LABEL[kindOf(item.name, item.isDir)]}</span>
                        <span>{item.isDir ? "" : formatBytes(item.size)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="qd-statusbar">
        <span>
          共 {files.length} 项{selection.length ? ` · 已选 ${selection.length} 项` : ""}
        </span>
        <span className="qd-spacer" />
        <span>
          <span className="qd-dot" />
          已连接 · 传输经 HTTPS 加密
        </span>
      </div>

      {dragging ? (
        <div className="qd-drop">
          <div className="qd-drop-card">
            <div className="qd-empty-icon">
              <CloudUpload size={26} />
            </div>
            <h2>松开即可上传</h2>
            <p>文件会上传到「{current.name}」。</p>
          </div>
        </div>
      ) : null}

      <Dialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        title="新建文件夹"
        description="文件夹会创建在当前目录。"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setNewFolderOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={createFolder} disabled={busy || !folderName.trim()}>
              创建
            </Button>
          </>
        }
      >
        <Input
          value={folderName}
          onChange={(event) => setFolderName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && createFolder()}
          autoFocus
        />
      </Dialog>

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        title="重命名"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button size="sm" onClick={confirmRename} disabled={busy || !renameName.trim()}>
              保存
            </Button>
          </>
        }
      >
        <Input
          value={renameName}
          onChange={(event) => setRenameName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && confirmRename()}
          autoFocus
        />
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`删除 ${selectedItems.length} 项？`}
        description="文件会移入回收站，可随时在回收站中恢复。"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete} disabled={busy}>
              删除
            </Button>
          </>
        }
      />

      <MoveDestinationDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        accountId={account.id}
        fids={selectedItems.map((item) => item.fid)}
        currentParentFid={current.fid}
        onMoved={async (movedFids, destinationFid) => {
          updateCurrentFolder((previous) => removeFiles(previous, movedFids));
          clearSelection();
          void queryClient.invalidateQueries({
            queryKey: ["files", account.id, destinationFid],
          });
          await new Promise((resolve) => window.setTimeout(resolve, 700));
          await refresh();
          updateCurrentFolder((previous) => removeFiles(previous, movedFids));
        }}
      />
    </div>
  );
}

function ItemMenu({
  item,
  onOpen,
  onRename,
  onMove,
  onDelete,
}: {
  item: FileItem;
  onOpen: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <Dropdown
      trigger={
        <button className="qd-icon-btn" title="更多" onClick={(event) => event.stopPropagation()}>
          <MoreHorizontal size={15} />
        </button>
      }
    >
      <DropdownItem onSelect={onOpen}>
        {item.isDir ? <Folder size={14} /> : <Download size={14} />}
        {item.isDir ? "打开" : "下载"}
      </DropdownItem>
      <DropdownItem onSelect={onRename}>
        <Pencil size={14} />
        重命名
      </DropdownItem>
      <DropdownItem onSelect={onMove}>
        <MoveRight size={14} />
        移动到…
      </DropdownItem>
      <DropdownSeparator />
      <DropdownItem danger onSelect={onDelete}>
        <Trash2 size={14} />
        删除
      </DropdownItem>
    </Dropdown>
  );
}

function FileListError({
  error,
  retrying,
  onRetry,
}: {
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
}) {
  const state = fileListErrorState(error);
  return (
    <div className="qd-empty" role="alert">
      <div className="qd-empty-icon" style={{ color: "var(--warning)", background: "var(--warning-soft)" }}>
        <AlertTriangle size={24} />
      </div>
      <h3>{state.title}</h3>
      <p>{state.description}</p>
      {state.canRetry ? (
        <Button className="mt-3" size="sm" variant="secondary" onClick={onRetry} disabled={retrying}>
          <RefreshCw className={cn("h-3.5 w-3.5", retrying && "animate-spin")} />
          {retrying ? "正在重试…" : "重试"}
        </Button>
      ) : null}
    </div>
  );
}

function EmptyState({
  search,
  onUpload,
  onCreate,
}: {
  search: string;
  onUpload: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="qd-empty">
      <div className="qd-empty-icon">{search ? <Search size={24} /> : <Folder size={24} />}</div>
      <h3>{search ? "没有匹配的文件" : "这里还没有文件"}</h3>
      <p>
        {search
          ? "换个关键词试试，搜索只作用于当前目录。"
          : "拖入文件或点击上传，把资料放进这个文件夹。"}
      </p>
      {!search ? (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={onUpload}>
            <Upload className="h-3.5 w-3.5" />
            上传文件
          </Button>
          <Button size="sm" variant="secondary" onClick={onCreate}>
            <FolderPlus className="h-3.5 w-3.5" />
            新建文件夹
          </Button>
        </div>
      ) : null}
    </div>
  );
}
