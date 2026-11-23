import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import logo from "../assets/quark-logo.png";
import { toast } from "sonner";
import type { Account } from "../lib/types";
import { backend, isDesktop } from "../lib/backend";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";

type LoginStatus = "loading" | "waiting" | "success" | "expired" | "error";

function QrPanel({
  qrUrl,
  status,
  onRefresh,
}: {
  qrUrl: string;
  status: LoginStatus;
  onRefresh: () => void;
}) {
  const unavailable = status === "expired" || status === "error";

  return (
    <div className="relative mx-auto w-[228px] overflow-hidden rounded-[14px] bg-white p-3 pb-2 shadow-[0_16px_40px_-26px_rgba(20,40,80,0.5)] ring-1 ring-black/[0.06]">
      <div className="relative flex h-[202px] items-center justify-center">
        {qrUrl ? (
          <div
            className={cn(
              "transition duration-200",
              unavailable && "scale-[0.98] opacity-15 blur-[2px]",
            )}
          >
            <QRCodeSVG
              value={qrUrl}
              size={190}
              level="M"
              marginSize={1}
              bgColor="#ffffff"
              fgColor="#17192b"
            />
          </div>
        ) : status === "loading" ? (
          <div className="flex flex-col items-center gap-3 text-[#68708d]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f3ff]">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
            </div>
            <span className="text-[11px] font-medium">正在生成二维码…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 px-8 text-center text-[#68708d]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <span className="text-[11px] font-medium">二维码获取失败</span>
          </div>
        )}

        {unavailable ? (
          <button
            onClick={onRefresh}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/40 backdrop-blur-[1px]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/25">
              <RefreshCw className="h-5 w-5" />
            </span>
            <span className="text-[12px] font-semibold text-[var(--ink)]">
              点击刷新二维码
            </span>
          </button>
        ) : null}
      </div>

      <div className="flex h-7 items-center justify-center gap-1.5 border-t border-[#f0f1f6] text-[10px] font-medium text-[#737892]">
        {status === "success" ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <ScanLine className="h-3.5 w-3.5" />
        )}
        {status === "success" ? "登录成功" : "使用夸克 App 扫码"}
      </div>
    </div>
  );
}

export default function LoginPage({
  onLogin,
}: {
  onLogin: (account: Account) => void;
}) {
  const [status, setStatus] = useState<LoginStatus>("loading");
  const [message, setMessage] = useState("正在请求全新的登录二维码…");
  const [qrUrl, setQrUrl] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [cookieBusy, setCookieBusy] = useState(false);
  const [showCookie, setShowCookie] = useState(false);
  const [cookie, setCookie] = useState("");
  const onLoginRef = useRef(onLogin);

  useEffect(() => {
    onLoginRef.current = onLogin;
  }, [onLogin]);

  useEffect(() => {
    let active = true;
    let sessionId: string | undefined;
    let timer: number | undefined;
    let failures = 0;

    const schedulePoll = (delay: number) => {
      timer = window.setTimeout(() => {
        void poll();
      }, delay);
    };

    const poll = async () => {
      if (!active || !sessionId) return;
      try {
        const result = await backend.pollQrLogin(sessionId);
        if (!active) return;
        failures = 0;

        if (result.state === "success" && result.account) {
          setStatus("success");
          setMessage("登录成功，正在进入网盘…");
          toast.success("登录成功");
          onLoginRef.current(result.account);
          return;
        }
        if (result.state === "expired") {
          setStatus("expired");
          setMessage(result.message || "二维码已过期，请刷新后重新扫码");
          return;
        }

        setStatus("waiting");
        setMessage("使用夸克 App 扫描二维码，并在手机上确认登录");
        schedulePoll(2000);
      } catch (error) {
        if (!active) return;
        failures += 1;
        if (failures < 3) {
          setStatus("waiting");
          setMessage(`网络波动，正在重试（${failures}/3）…`);
          schedulePoll(2000);
          return;
        }
        setStatus("error");
        setMessage(String(error));
        toast.error(`扫码登录失败：${error}`);
      }
    };

    const begin = async () => {
      setStatus("loading");
      setMessage("正在请求全新的登录二维码…");
      setQrUrl("");
      try {
        const started = await backend.startQrLogin();
        if (!active) {
          void backend.cancelQrLogin(started.sessionId);
          return;
        }
        sessionId = started.sessionId;
        setQrUrl(started.qrUrl);
        setStatus("waiting");
        setMessage("使用夸克 App 扫描二维码，并在手机上确认登录");
        schedulePoll(1200);
      } catch (error) {
        if (!active) return;
        setStatus("error");
        setMessage(String(error));
        toast.error(`获取二维码失败：${error}`);
      }
    };

    void begin();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
      if (sessionId) void backend.cancelQrLogin(sessionId);
    };
  }, [attempt]);

  function refreshQr() {
    setAttempt((value) => value + 1);
  }

  async function importCookie() {
    if (!cookie.trim()) {
      toast.error("请先粘贴 Cookie");
      return;
    }
    setCookieBusy(true);
    try {
      const account = await backend.importCookie(cookie.trim());
      toast.success("Cookie 验证通过");
      onLogin(account);
    } catch (error) {
      toast.error(`Cookie 验证失败：${error}`);
    } finally {
      setCookieBusy(false);
    }
  }

  async function enterDemo() {
    setCookieBusy(true);
    try {
      const account = await backend.importCookie("demo");
      toast.success("已进入演示模式");
      onLogin(account);
    } finally {
      setCookieBusy(false);
    }
  }

  return (
    <div className="qd-login">
      <div className="qd-login-card">
        <div className="qd-login-brand">
          <img src={logo} alt="" />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">夸克网盘</div>
            <div className="text-[11px] text-[var(--muted)]">Linux 客户端 · 非官方</div>
          </div>
        </div>

        <h1 className="text-[20px] font-semibold tracking-tight text-[var(--ink)]">扫码登录</h1>
        <p className="mt-1 mb-5 text-[12px] leading-5 text-[var(--muted)]">
          使用夸克 App 扫描二维码，登录信息只保存在本机。
        </p>

        <QrPanel qrUrl={qrUrl} status={status} onRefresh={refreshQr} />

        <div
          className={cn(
            "mt-4 flex min-h-[40px] items-center justify-center gap-2 rounded-[9px] px-3 py-2 text-center text-[11px] leading-5",
            status === "error"
              ? "bg-[var(--danger-soft)] text-[var(--danger)]"
              : status === "success"
                ? "bg-[var(--success-soft)] text-[var(--success)]"
                : "bg-[var(--panel-2)] text-[var(--muted)]",
          )}
        >
          {status === "loading" || status === "waiting" ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : status === "expired" || status === "error" ? (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{message}</span>
        </div>

        <button
          onClick={refreshQr}
          disabled={status === "loading"}
          className="mt-3 flex w-full items-center justify-center gap-1.5 text-[11px] text-[var(--muted)] transition hover:text-[var(--accent)] disabled:cursor-default disabled:opacity-45"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          刷新二维码
        </button>

        {!isDesktop ? (
          <button
            className="qd-btn qd-btn-ghost mt-3 w-full justify-center"
            onClick={enterDemo}
            disabled={cookieBusy}
          >
            浏览器预览：进入演示界面
          </button>
        ) : null}

        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <button
            onClick={() => setShowCookie((value) => !value)}
            className="flex w-full items-center justify-between text-[11px] text-[var(--muted)] transition hover:text-[var(--ink)]"
          >
            <span className="inline-flex items-center gap-1.5">
              <TerminalSquare className="h-3.5 w-3.5" />
              Cookie 导入（验收 / 备用）
            </span>
            <span>{showCookie ? "收起" : "展开"}</span>
          </button>
          {showCookie ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={cookie}
                onChange={(event) => setCookie(event.target.value)}
                placeholder="__puus=...; __pus=...; __uid=..."
                className="h-20 w-full resize-none rounded-[9px] border border-[var(--border)] bg-[var(--panel-2)] p-3 font-mono text-[11px] leading-5 text-[var(--ink)] outline-none transition placeholder:text-[var(--faint)] focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[var(--accent-soft)]"
              />
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={importCookie}
                disabled={cookieBusy}
              >
                {cookieBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                验证并登录
              </Button>
              <p className="text-[10px] leading-4 text-[var(--faint)]">
                Cookie 只保存在本机 0600 权限文件中，不会上传。
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="qd-login-foot">
        <ShieldCheck className="h-3 w-3" />
        登录信息仅存储在本机 · 第三方客户端，与夸克官方无关
      </div>
    </div>
  );
}
