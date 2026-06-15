"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Download,
  Copy,
  Check,
  Trash2,
  Key,
  Settings,
  Wand2,
  Shuffle,
  X,
  Loader2,
  Code2,
  Image as ImageIcon,
  RefreshCw,
  AlertCircle,
  Zap,
  Pencil,
  Brain,
  Wifi,
  FileCode,
  LogIn,
  LogOut,
  User as UserIcon,
  Lock,
  ChevronDown,
  Cpu,
  Sparkle,
} from "lucide-react";
import { STYLES, type EmojiStyle, type Generation } from "@/lib/styles";
import {
  loadHistory,
  appendHistory,
  removeFromHistory,
  clearHistory,
  loadSettings,
  saveSettings,
  loadConfigs,
  addConfig,
  removeConfig,
  renameConfig,
  type Settings as AppSettings,
  type ModelConfig,
  getThinkingForModel,
  setThinkingForModel,
} from "@/lib/storage";
import { cn, downloadPng, downloadSvg, extractSvg } from "@/lib/utils";
import { PRESETS as ModelPresets } from "@/lib/presets";

const CHARACTERS = [
  "猫咪", "狗子", "熊猫", "企鹅", "狐狸", "柴犬",
  "兔子", "小熊", "考拉", "水豚", "可达鸭",
  "饭团", "奶茶", "蛋挞", "披萨", "西瓜", "寿司",
  "月亮", "仙人掌", "云朵", "小灯泡", "小蘑菇",
];
const EXPRESSIONS = [
  "开心到飞起", "偷笑", "眼睛亮晶晶", "幸福冒泡", "得意洋洋",
  "委屈巴巴", "气到冒烟", "泪如雨下", "心态崩溃", "社恐发作",
  "一脸懵逼", "摆烂中", "假装很酷", "犯困", "吃瓜表情",
  "捂嘴偷笑", "抱头崩溃", "比耶", "歪头卖萌", "翻白眼",
];

function randomExample(): string {
  const char = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  const expr = EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)];
  return `${expr}的${char}`;
}

const PRESETS = ModelPresets;
const RESTRICTED_MODELS: Set<string> = new Set(
  ModelPresets.filter((p) => p.requireAuth).map((p) => p.model),
);

interface SessionUser {
  id: string;
  username: string;
  isAdmin: boolean;
}

export default function EmojiGenerator() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<EmojiStyle>("kawaii");
  const [streamingText, setStreamingText] = useState("");
  const [reasoningText, setReasoningText] = useState("");
  const [finalSvg, setFinalSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [bytesReceived, setBytesReceived] = useState(0);
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const [history, setHistory] = useState<Generation[]>([]);
  const [exampleButtons, setExampleButtons] = useState<React.ReactNode[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    apiKey: "",
    baseUrl: "https://token.sensenova.cn/v1",
    model: "sensenova-6.7-flash-lite",
    thinkingByModel: {},
  });
  const [showSettings, setShowSettings] = useState(false);
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const reasoningScrollRef = useRef<HTMLDivElement>(null);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [serverBase, setServerBase] = useState<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setHistory(loadHistory());
    setConfigs(loadConfigs());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const effectivePresets = useMemo(
    () =>
      PRESETS.map((p) => ({
        ...p,
        useServerKey: !!serverBase && p.baseUrl === serverBase,
        isDefault: !!serverBase && p.baseUrl === serverBase,
      })),
    [serverBase],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [meRes, cfgRes] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/config", { cache: "no-store" }),
        ]);
        const me = await meRes.json();
        const cfg = await cfgRes.json();
        if (cancelled) return;
        setUser(me.user || null);
        if (cfg.hasServerKey) setServerBase(cfg.serverBase);
        const loaded = loadSettings();
        if (!me.user && RESTRICTED_MODELS.has(loaded.model)) {
          loaded.model = "sensenova-6.7-flash-lite";
        }
        setSettings(loaded);
      } catch {
        if (!cancelled) {
          setUser(null);
          setSettings(loadSettings());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    setUser(null);
    if (RESTRICTED_MODELS.has(settings.model)) {
      const next = { ...settings, model: "sensenova-6.7-flash-lite" };
      setSettings(next);
      saveSettings(next);
    }
  }

  useEffect(() => {
    if (!loading) return;
    const start = performance.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setElapsedMs(0);
    const id = setInterval(() => setElapsedMs(performance.now() - start), 100);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    const el = reasoningScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [reasoningText]);

  const currentSvg = (() => {
    const live = extractSvg(streamingText);
    return live || finalSvg;
  })();

  const canGenerate = prompt.trim().length > 0 && !loading;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExampleButtons(
      [0, 1, 2, 3].map((i) => {
        const ex = randomExample();
        return (
          <button
            key={i}
            type="button"
            onClick={() => setPrompt(ex)}
            className="rounded-full border border-stone-200/80 bg-white/70 px-2.5 py-1 text-[11px] text-stone-600 transition hover:scale-105 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 active:scale-95 sm:px-3 sm:text-xs dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:border-rose-400/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
          >
            {ex}
          </button>
        );
      }),
    );
  }, []);

  async function generate() {
    if (!canGenerate) return;
    setError(null);
    setFinalSvg(null);
    setStreamingText("");
    setReasoningText("");
    setBytesReceived(0);
    setFirstTokenReceived(false);
    setLoading(true);

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      previewRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }

    abortRef.current?.abort();
    await new Promise((r) => setTimeout(r, 50));

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    const READ_TIMEOUT_MS = 120_000;

    function readWithTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`__TIMEOUT__:${label}`)),
          ms,
        );
        promise.then(
          (v) => { clearTimeout(timer); resolve(v); },
          (e) => { clearTimeout(timer); reject(e); },
        );
      });
    }

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          style,
          apiKey: settings.apiKey || undefined,
          baseUrl: settings.baseUrl || undefined,
          model: settings.model || undefined,
          reasoningEffort: (() => {
            const tc = getThinkingForModel(settings, settings.model);
            return tc.enabled ? tc.effort : "none";
          })(),
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed: ${res.status}`);
      }
      if (!res.body) throw new Error("No response body");

      reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let textAcc = "";
      let lastSvg: string | null = null;

      while (true) {
        const { value, done } = await readWithTimeout(
          reader.read(),
          READ_TIMEOUT_MS,
          "stream",
        );
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        setBytesReceived((n) => n + value.byteLength);

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const { t, c } = JSON.parse(line);
            if (t === "h") {
              setFirstTokenReceived(true);
            } else if (t === "r") {
              setFirstTokenReceived(true);
              setReasoningText((prev) => prev + c);
            } else if (t === "t") {
              setFirstTokenReceived(true);
              textAcc += c;
              setStreamingText(textAcc);
              const found = extractSvg(textAcc);
              if (found) lastSvg = found;
            } else if (t === "e") {
              throw new Error(c);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      if (!lastSvg) {
        throw new Error(
          "模型没按规矩输出 SVG。\n建议:\n• 换更听话的模型(OpenAI gpt-4o-mini、DeepSeek-V4、Claude Haiku 都稳)\n• 提示词写具体一点,别太抽象\n• 点「重新生成」多试几次",
        );
      }
      setFinalSvg(lastSvg);
      setHistory((cur) => appendHistory(cur, prompt.trim(), style, lastSvg!));
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      const errMsg = e instanceof Error ? e.message : "Something went wrong";
      if (errMsg.startsWith("__TIMEOUT__")) {
        setError(
          `⏱️ 流式读取超时（${READ_TIMEOUT_MS / 1000}秒无新数据）\n\n可能原因:\n• 模型服务器负载过高或暂时不可用\n• 网络连接不稳定\n• API Key 无效或额度用尽\n\n建议:\n• 稍等片刻后点「重新生成」再试一次\n• 换一个更快的模型（如 glm-4-flash、gpt-4o-mini）\n• 检查 API Key 和网络连接`,
        );
      } else {
        setError(errMsg);
      }
    } finally {
      try {
        await reader?.cancel();
      } catch {
        /* noop */
      }
      setLoading(false);
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }

  function abort() {
    abortRef.current?.abort();
    setLoading(false);
  }

  function regenerate() {
    if (prompt.trim()) generate();
  }

  function shufflePrompt() {
    const next = randomExample();
    setPrompt(next);
  }

  async function copyCode() {
    if (!finalSvg) return;
    await navigator.clipboard.writeText(finalSvg);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadCurrentSvg() {
    if (!finalSvg) return;
    const safe = prompt.trim().slice(0, 24).replace(/[^\p{L}\p{N}]+/gu, "-") || "emoji";
    downloadSvg(finalSvg, `${safe}-${style}.svg`);
  }

  async function downloadCurrentPng() {
    if (!finalSvg) return;
    const safe = prompt.trim().slice(0, 24).replace(/[^\p{L}\p{N}]+/gu, "-") || "emoji";
    await downloadPng(finalSvg, `${safe}-${style}.png`);
  }

  function pickFromHistory(g: Generation) {
    setPrompt(g.prompt);
    setStyle(g.style);
    setFinalSvg(g.svg);
    setStreamingText("");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function removeHistoryItem(id: string) {
    setHistory((cur) => removeFromHistory(cur, id));
  }

  function onClearHistory() {
    if (!confirm("清空所有历史记录?")) return;
    setHistory(clearHistory());
  }

  const currentPreset = useMemo(
    () => effectivePresets.find((p) => p.baseUrl === settings.baseUrl && p.model === settings.model),
    [effectivePresets, settings.baseUrl, settings.model]
  );
  const needsApiKey = !settings.apiKey && !currentPreset?.useServerKey;

  return (
    <div className="relative min-h-screen bg-stone-50 text-stone-900 dark:bg-zinc-950 dark:text-stone-100">
      <div className="aurora-bg">
        <div className="blob-3" />
      </div>

      <Header
        onSettings={() => setShowSettings(true)}
        hasKey={!!settings.apiKey || !!currentPreset?.useServerKey}
        user={user}
        onLogout={logout}
      />

      <main className="relative mx-auto max-w-6xl px-3 pb-28 pt-4 sm:px-6 sm:pb-24 sm:pt-8 lg:pb-16">
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-7">
          {/* Left: form */}
          <section className="order-2 space-y-4 sm:space-y-5 lg:order-1">
            <PromptCard
              prompt={prompt}
              setPrompt={setPrompt}
              generate={generate}
              abort={abort}
              regenerate={regenerate}
              canGenerate={canGenerate}
              loading={loading}
              finalSvg={finalSvg}
              firstTokenReceived={firstTokenReceived}
              reasoningText={reasoningText}
              streamingText={streamingText}
              currentSvg={currentSvg}
              elapsedMs={elapsedMs}
              bytesReceived={bytesReceived}
              shufflePrompt={shufflePrompt}
              exampleButtons={exampleButtons}
            />

            <StyleGrid style={style} setStyle={setStyle} />

            <ModelRow
              settings={settings}
              setSettings={(s) => { setSettings(s); saveSettings(s); }}
              user={user}
              presets={effectivePresets}
            />

            {needsApiKey && (
              <InfoBanner
                tone="amber"
                icon={<Key className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                onClick={() => setShowSettings(true)}
                action="打开设置 →"
              >
                未配置 API Key。
              </InfoBanner>
            )}

            {!user && (
              <InfoBanner
                tone="sky"
                icon={<Lock className="mt-0.5 h-4 w-4 flex-shrink-0" />}
              >
                当前为访客模式，仅可使用{" "}
                <span className="font-semibold">sensenova-6.7-flash-lite</span>。
                <Link
                  href="/login"
                  className="ml-1 font-semibold underline underline-offset-2"
                >
                  登录
                </Link>
                <span className="mx-1 opacity-50">·</span>
                <Link
                  href="/register"
                  className="font-semibold underline underline-offset-2"
                >
                  注册
                </Link>
                解锁 deepseek-v4-flash 等高级模型。
              </InfoBanner>
            )}

            {error && (
              <InfoBanner
                tone="rose"
                icon={<AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
              >
                <div className="whitespace-pre-wrap break-words">{error}</div>
              </InfoBanner>
            )}
          </section>

          {/* Right: preview */}
          <section
            ref={previewRef}
            className="order-1 lg:sticky lg:top-20 lg:order-2 lg:self-start"
          >
            <PreviewCard
              currentSvg={currentSvg}
              finalSvg={finalSvg}
              loading={loading}
              streamingText={streamingText}
              reasoningText={reasoningText}
              firstTokenReceived={firstTokenReceived}
              elapsedMs={elapsedMs}
              showCode={showCode}
              setShowCode={setShowCode}
              copied={copied}
              copyCode={copyCode}
              downloadCurrentSvg={downloadCurrentSvg}
              downloadCurrentPng={downloadCurrentPng}
            />

            {reasoningText && !loading && (
              <button
                onClick={() => setReasoningExpanded(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-2xl border border-stone-200/60 bg-white/70 px-3 py-2 text-xs font-medium text-stone-500 shadow-sm backdrop-blur transition hover:bg-white hover:text-stone-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
              >
                <Brain className="h-3.5 w-3.5 text-violet-500" />
                查看思考过程
                <span className="font-mono text-stone-400">
                  ({(elapsedMs / 1000).toFixed(1)}s)
                </span>
              </button>
            )}

            {reasoningExpanded && (
              <ReasoningModal
                reasoningText={reasoningText}
                elapsedMs={elapsedMs}
                onClose={() => setReasoningExpanded(false)}
              />
            )}
          </section>
        </div>

        <HistorySection
          history={history}
          onPick={pickFromHistory}
          onRemove={removeHistoryItem}
          onClear={onClearHistory}
        />
      </main>

      {/* Sticky bottom CTA on mobile */}
      <MobileActionBar
        loading={loading}
        canGenerate={canGenerate}
        finalSvg={finalSvg}
        generate={generate}
        abort={abort}
        regenerate={regenerate}
        firstTokenReceived={firstTokenReceived}
        reasoningText={reasoningText}
        streamingText={streamingText}
        currentSvg={currentSvg}
        elapsedMs={elapsedMs}
        bytesReceived={bytesReceived}
      />

      {showSettings && (
        <SettingsDialog
          key="settings-open"
          onClose={() => setShowSettings(false)}
          value={settings}
          onChange={(s) => {
            setSettings(s);
            saveSettings(s);
          }}
          configs={configs}
          activeConfigId={activeConfigId}
          onAddConfig={(input) => {
            const next = addConfig(configs, input);
            setConfigs(next);
            setActiveConfigId(next[0]?.id ?? null);
          }}
          onRemoveConfig={(id) => {
            setConfigs(removeConfig(configs, id));
            if (activeConfigId === id) setActiveConfigId(null);
          }}
          onRenameConfig={(id, name) => {
            setConfigs(renameConfig(configs, id, name));
          }}
          onActivateConfig={(id) => {
            const c = configs.find((x) => x.id === id);
            if (!c) return;
            if (!user && RESTRICTED_MODELS.has(c.model)) {
              alert(`模型 "${c.model}" 需要登录后才能使用。`);
              return;
            }
            const newSettings = {
              ...settings,
              apiKey: c.apiKey,
              baseUrl: c.baseUrl,
              model: c.model,
            };
            setSettings(newSettings);
            saveSettings(newSettings);
            setActiveConfigId(id);
          }}
          user={user}
          presets={effectivePresets}
        />
      )}

      <footer className="hidden border-t border-stone-200/40 bg-white/30 py-6 text-center text-xs text-stone-400 backdrop-blur sm:block dark:border-zinc-800/40 dark:bg-zinc-950/30 dark:text-zinc-500">
        <p>
          Built with Next.js + Vercel AI SDK · BYO API Key · 生成的 SVG 完全归你所有
        </p>
      </footer>
    </div>
  );
}

/* ─────────────────────────── Header ─────────────────────────── */

function Header({
  onSettings,
  hasKey,
  user,
  onLogout,
}: {
  onSettings: () => void;
  hasKey: boolean;
  user: SessionUser | null;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/50 bg-white/70 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-950/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-amber-500 text-white shadow-lg shadow-rose-500/25 transition-transform group-hover:scale-105">
            <Wand2 className="h-4.5 w-4.5" strokeWidth={2.5} />
            <div className="absolute inset-0 bg-gradient-to-tl from-transparent via-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="hidden sm:block">
            <div className="text-base font-bold leading-none tracking-tight text-stone-900 dark:text-stone-50">
              Emojigen
            </div>
            <div className="mt-0.5 text-[10px] font-medium tracking-wide text-stone-500 dark:text-zinc-400">
              AI · SVG · 表情包生成器
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {user ? (
            <div className="flex items-center gap-1.5 rounded-full border border-stone-200/60 bg-white/80 py-1 pl-2.5 pr-1 text-xs shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
              <UserIcon className="h-3.5 w-3.5 text-stone-400" />
              <span className="max-w-[64px] truncate font-medium text-stone-700 sm:max-w-[100px] dark:text-stone-200">
                {user.username}
              </span>
              {user.isAdmin && (
                <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-1.5 py-px text-[9px] font-semibold text-white shadow-sm">
                  管理员
                </span>
              )}
              <button
                type="button"
                onClick={onLogout}
                title="退出登录"
                className="ml-0.5 rounded-full p-1 text-stone-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-stone-200/60 bg-white/80 px-3 text-xs font-medium text-stone-700 shadow-sm backdrop-blur transition hover:border-stone-300 hover:text-stone-900 sm:h-9 sm:text-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-stone-200"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>登录</span>
              </Link>
              <Link
                href="/register"
                className="btn-primary hidden h-8 items-center gap-1.5 px-3 text-xs sm:inline-flex sm:h-9 sm:px-4 sm:text-sm"
              >
                <span>注册</span>
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={onSettings}
            className="relative inline-flex h-8 items-center gap-1.5 rounded-full border border-stone-200/60 bg-white/80 px-2.5 text-xs font-medium text-stone-700 shadow-sm backdrop-blur transition hover:border-stone-300 hover:text-stone-900 sm:h-9 sm:px-3 sm:text-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-stone-200"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">设置</span>
            {hasKey && (
              <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 ring-2 ring-white dark:ring-zinc-950" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────────── PromptCard ─────────────────────────── */

function PromptCard({
  prompt,
  setPrompt,
  generate,
  abort,
  regenerate,
  canGenerate,
  loading,
  finalSvg,
  firstTokenReceived,
  reasoningText,
  streamingText,
  currentSvg,
  elapsedMs,
  bytesReceived,
  shufflePrompt,
  exampleButtons,
}: {
  prompt: string;
  setPrompt: (s: string) => void;
  generate: () => void;
  abort: () => void;
  regenerate: () => void;
  canGenerate: boolean;
  loading: boolean;
  finalSvg: string | null;
  firstTokenReceived: boolean;
  reasoningText: string;
  streamingText: string;
  currentSvg: string | null;
  elapsedMs: number;
  bytesReceived: number;
  shufflePrompt: () => void;
  exampleButtons: React.ReactNode[];
}) {
  const phase = getPhase(loading, firstTokenReceived, reasoningText, currentSvg, streamingText);
  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="mb-2.5 flex items-center justify-between">
        <label
          htmlFor="prompt"
          className="text-sm font-semibold tracking-tight text-stone-700 dark:text-stone-200"
        >
          <span className="text-gradient">✨</span> 描述你想要的 Emoji
        </label>
        <button
          type="button"
          onClick={shufflePrompt}
          title="随机示例"
          className="rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-500 active:scale-95 dark:hover:bg-rose-500/10"
        >
          <Shuffle className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="relative">
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="例如：一只在云上弹吉他的熊猫 🐼"
          className="w-full resize-none rounded-2xl border border-stone-200/80 bg-white/90 px-3.5 py-3 text-sm text-stone-900 shadow-inner outline-none transition placeholder:text-stone-400 focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-100 sm:text-base dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-stone-100 dark:placeholder:text-zinc-500 dark:focus:border-rose-400 dark:focus:bg-zinc-900 dark:focus:ring-rose-500/10"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              generate();
            }
          }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">{exampleButtons}</div>
      <div className="mt-4 flex items-center gap-2">
        {!loading ? (
          <>
            <button
              type="button"
              onClick={generate}
              disabled={!canGenerate}
              className="btn-primary inline-flex h-11 flex-1 items-center justify-center gap-2 px-5 text-sm"
            >
              <Sparkles className="h-4 w-4" strokeWidth={2.5} />
              生成 Emoji
            </button>
            {finalSvg && (
              <button
                type="button"
                onClick={regenerate}
                title="重新生成"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200/80 bg-white/80 text-stone-600 transition hover:border-rose-300 hover:text-rose-500 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-stone-200"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={abort}
            className={cn(
              "btn-primary inline-flex h-11 flex-1 items-center justify-center gap-2 text-sm",
              `bg-gradient-to-r ${PHASE_GRADIENT[phase]}`
            )}
          >
            {PHASE_ICON[phase]}
            {PHASE_LABEL[phase]}…
            <span className="ml-1 font-mono text-[10px] font-normal opacity-80">
              {(elapsedMs / 1000).toFixed(1)}s · {(bytesReceived / 1024).toFixed(1)}KB
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── StyleGrid ─────────────────────────── */

function StyleGrid({
  style,
  setStyle,
}: {
  style: EmojiStyle;
  setStyle: (s: EmojiStyle) => void;
}) {
  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight text-stone-700 dark:text-stone-200">
          <span className="text-gradient">🎨</span> 选择风格
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
          {STYLES.find((s) => s.id === style)?.name}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {STYLES.map((s) => {
          const active = s.id === style;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.id)}
              className={cn(
                "group relative flex flex-col items-center gap-1 rounded-2xl border p-2.5 text-center transition-all duration-200 sm:p-3",
                active
                  ? "scale-[1.02] border-rose-400/60 bg-gradient-to-br from-rose-50 to-amber-50 shadow-md shadow-rose-500/10 dark:border-rose-400/40 dark:from-rose-500/10 dark:to-amber-500/10"
                  : "border-stone-200/80 bg-white/60 hover:-translate-y-0.5 hover:border-stone-300 hover:bg-white hover:shadow-sm active:translate-y-0 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/60"
              )}
            >
              {active && (
                <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-amber-500 text-white">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
              )}
              <span className="text-2xl transition-transform group-hover:scale-110 sm:text-3xl">
                {s.emoji}
              </span>
              <span className="text-[11px] font-semibold leading-tight text-stone-800 sm:text-xs dark:text-stone-100">
                {s.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── ModelRow (dropdown + thinking) ─────────────────────────── */

// Group presets for the dropdown: server-key first, then need-user-key
function groupPresets(
  presets: typeof ModelPresets,
): { key: string; label: string; presets: typeof ModelPresets }[] {
  const serverKey: typeof ModelPresets = [];
  const userKey: typeof ModelPresets = [];
  for (const p of presets) {
    if (p.useServerKey) serverKey.push(p);
    else userKey.push(p);
  }
  const groups: { key: string; label: string; presets: typeof ModelPresets }[] = [];
  if (serverKey.length) groups.push({ key: "server", label: "已配置 (服务器自带 Key)", presets: serverKey });
  if (userKey.length) groups.push({ key: "user", label: "自备 API Key", presets: userKey });
  return groups;
}

function ModelRow({
  settings,
  setSettings,
  user,
  presets,
}: {
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  user: SessionUser | null;
  presets: typeof ModelPresets;
}) {
  const current = presets.find(
    (p) => p.baseUrl === settings.baseUrl && p.model === settings.model,
  );
  const supportsThinking = !!current?.supportsThinking;
  const tc = supportsThinking ? getThinkingForModel(settings, settings.model) : null;

  function selectPreset(p: typeof ModelPresets[number]) {
    setSettings({
      ...settings,
      baseUrl: p.baseUrl,
      model: p.model,
      apiKey: p.useServerKey ? "" : settings.apiKey,
    });
  }

  return (
    <div className="glass-card p-3.5 sm:p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300">
          <Cpu className="h-3.5 w-3.5 text-rose-500" />
          <span className="hidden sm:inline">模型</span>
        </div>
        <ModelSelect
          settings={settings}
          onSelect={selectPreset}
          user={user}
          presets={presets}
        />
        {supportsThinking && tc && (
          <ThinkingToggle
            enabled={tc.enabled}
            effort={tc.effort}
            onToggle={() => setSettings(setThinkingForModel(settings, settings.model, { enabled: !tc.enabled }))}
            onEffort={(e) => setSettings(setThinkingForModel(settings, settings.model, { effort: e }))}
          />
        )}
      </div>
    </div>
  );
}

function ModelSelect({
  settings,
  onSelect,
  user,
  presets,
}: {
  settings: AppSettings;
  onSelect: (p: typeof ModelPresets[number]) => void;
  user: SessionUser | null;
  presets: typeof ModelPresets;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = presets.find(
    (p) => p.baseUrl === settings.baseUrl && p.model === settings.model,
  );

  const groups = groupPresets(presets);

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group flex h-9 w-full items-center gap-2 rounded-xl border px-2.5 text-left text-xs transition sm:gap-2.5 sm:px-3 sm:text-sm",
          open
            ? "border-rose-400/60 bg-white shadow-md shadow-rose-500/5 ring-4 ring-rose-100 dark:border-rose-400/40 dark:bg-zinc-900 dark:ring-rose-500/10"
            : "border-stone-200/80 bg-white/80 hover:border-stone-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
        )}
      >
        <div className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold",
          current?.useServerKey
            ? "bg-gradient-to-br from-emerald-400 to-emerald-500 text-white"
            : "bg-gradient-to-br from-rose-500 to-amber-500 text-white"
        )}>
          {current?.useServerKey ? <Sparkle className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
        </div>
        <div className="min-w-0 flex-1 truncate">
          <span className="font-semibold text-stone-800 dark:text-stone-100">
            {current?.label ?? "自定义"}
          </span>
        </div>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 shrink-0 text-stone-400 transition-transform",
          open && "rotate-180 text-rose-500"
        )} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[60vh] overflow-auto rounded-2xl border border-stone-200/80 bg-white/95 p-1.5 shadow-2xl shadow-stone-900/10 backdrop-blur-xl animate-fade-in dark:border-zinc-800 dark:bg-zinc-900/95">
          {groups.map((g) => (
            <div key={g.key} className="mb-1 last:mb-0">
              <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                {g.label}
              </div>
              {g.presets.map((p) => {
                const locked = p.requireAuth && !user;
                const active = p.baseUrl === settings.baseUrl && p.model === settings.model;
                return (
                  <button
                    key={`${p.baseUrl}::${p.model}`}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      if (locked) return;
                      onSelect(p);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition disabled:cursor-not-allowed sm:text-sm",
                      active
                        ? "bg-gradient-to-r from-rose-50 to-amber-50 dark:from-rose-500/15 dark:to-amber-500/15"
                        : locked
                          ? "opacity-50"
                          : "hover:bg-stone-100 dark:hover:bg-zinc-800/80"
                    )}
                  >
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold",
                      p.useServerKey
                        ? "bg-gradient-to-br from-emerald-400 to-emerald-500 text-white"
                        : "bg-gradient-to-br from-stone-200 to-stone-300 text-stone-600 dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-300"
                    )}>
                      {p.useServerKey ? <Sparkle className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn(
                        "truncate font-semibold",
                        active ? "text-rose-700 dark:text-rose-300" : "text-stone-800 dark:text-stone-100"
                      )}>
                        {p.label}
                      </div>
                      <div className="truncate text-[10px] text-stone-400">{p.model}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {p.requireAuth && !user ? (
                        <Lock className="h-3 w-3 text-stone-400" />
                      ) : p.useServerKey ? (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">免费</span>
                      ) : null}
                      {p.supportsThinking && (
                        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">思考</span>
                      )}
                      {active && <Check className="h-3.5 w-3.5 text-rose-500" />}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThinkingToggle({
  enabled,
  effort,
  onToggle,
  onEffort,
}: {
  enabled: boolean;
  effort: "low" | "medium" | "high";
  onToggle: () => void;
  onEffort: (e: "low" | "medium" | "high") => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex h-9 items-center gap-1 rounded-xl border px-2.5 text-xs font-medium transition sm:px-3",
          enabled
            ? "border-violet-400/50 bg-gradient-to-r from-violet-50 to-fuchsia-50 text-violet-700 shadow-sm dark:border-violet-400/40 dark:from-violet-500/15 dark:to-fuchsia-500/15 dark:text-violet-300"
            : "border-stone-200/80 bg-white/80 text-stone-400 hover:text-stone-600 dark:border-zinc-800 dark:bg-zinc-900/60"
        )}
        title="开启思考模式"
      >
        <Brain className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">思考</span>
      </button>
      {enabled && (
        <div className="flex h-9 items-center gap-0.5 rounded-xl bg-violet-100/60 p-1 dark:bg-violet-500/15">
          {(["low", "medium", "high"] as const).map((level) => {
            const labels = { low: "低", medium: "中", high: "高" };
            const active = effort === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => onEffort(level)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-semibold transition sm:text-[11px]",
                  active
                    ? "bg-white text-violet-700 shadow-sm dark:bg-violet-400 dark:text-zinc-900"
                    : "text-violet-600 hover:text-violet-800 dark:text-violet-300 dark:hover:text-white"
                )}
              >
                {labels[level]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Phases & Helpers ─────────────────────────── */

type Phase = "connecting" | "waiting" | "thinking" | "drawing";

type TestState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok"; latencyMs: number; sample?: string }
  | { kind: "err"; message: string };

function getPhase(
  loading: boolean,
  firstTokenReceived: boolean,
  reasoningText: string,
  currentSvg: string | null,
  streamingText: string,
): Phase {
  if (!loading) return "waiting";
  if (!firstTokenReceived) return "connecting";
  if (reasoningText && !streamingText) return "thinking";
  if (currentSvg || streamingText) return "drawing";
  return "waiting";
}

const PHASE_LABEL: Record<Phase, string> = {
  connecting: "连接中",
  waiting: "等待模型",
  thinking: "思考中",
  drawing: "绘制中",
};

const PHASE_ICON: Record<Phase, React.ReactNode> = {
  connecting: <Wifi className="h-4 w-4 animate-pulse" />,
  waiting: <Loader2 className="h-4 w-4 animate-spin" />,
  thinking: <Brain className="h-4 w-4 animate-pulse" />,
  drawing: <Sparkles className="h-4 w-4 animate-pulse" />,
};

const PHASE_GRADIENT: Record<Phase, string> = {
  connecting: "from-sky-500 to-indigo-500",
  waiting: "from-indigo-500 to-violet-500",
  thinking: "from-violet-500 to-fuchsia-500",
  drawing: "from-rose-500 to-amber-500",
};

const PHASE_MESSAGES: Record<Phase, string[]> = {
  connecting: ["正在连接 AI 模型…", "建立安全连接中…", "准备生成环境…"],
  waiting: ["已连接，等待模型响应…", "模型正在准备中…", "排队等待推理…"],
  thinking: ["正在理解你的描述…", "构思视觉方案…", "规划图形结构…", "设计配色方案…", "确定布局构图…"],
  drawing: ["正在绘制 SVG…", "生成图形元素…", "组装表情符号…"],
};

/* ─────────────────────────── MobileActionBar ─────────────────────────── */

function MobileActionBar(props: {
  loading: boolean;
  canGenerate: boolean;
  finalSvg: string | null;
  generate: () => void;
  abort: () => void;
  regenerate: () => void;
  firstTokenReceived: boolean;
  reasoningText: string;
  streamingText: string;
  currentSvg: string | null;
  elapsedMs: number;
  bytesReceived: number;
}) {
  const { loading, canGenerate, finalSvg, generate, abort, regenerate, firstTokenReceived, reasoningText, streamingText, currentSvg, elapsedMs, bytesReceived } = props;
  const phase = getPhase(loading, firstTokenReceived, reasoningText, currentSvg, streamingText);
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200/60 bg-white/85 px-3 pt-2.5 shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.1)] backdrop-blur-xl safe-bottom lg:hidden dark:border-zinc-800/60 dark:bg-zinc-950/85">
      <div className="mx-auto flex max-w-6xl items-center gap-2">
        {!loading ? (
          <>
            <button type="button" onClick={generate} disabled={!canGenerate} className="btn-primary inline-flex h-11 flex-1 items-center justify-center gap-2 text-sm">
              <Sparkles className="h-4 w-4" strokeWidth={2.5} />
              生成 Emoji
            </button>
            {finalSvg && (
              <button type="button" onClick={regenerate} title="重新生成" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200/80 bg-white/80 text-stone-600 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-stone-200">
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <button type="button" onClick={abort} className={cn("btn-primary inline-flex h-11 flex-1 items-center justify-center gap-2 text-sm", `bg-gradient-to-r ${PHASE_GRADIENT[phase]}`)}>
            {PHASE_ICON[phase]}
            {PHASE_LABEL[phase]}…
            <span className="ml-1 font-mono text-[10px] font-normal opacity-80">
              {(elapsedMs / 1000).toFixed(1)}s · {(bytesReceived / 1024).toFixed(1)}KB
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── InfoBanner ─────────────────────────── */

function InfoBanner({
  tone,
  icon,
  children,
  onClick,
  action,
}: {
  tone: "amber" | "sky" | "rose";
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  action?: string;
}) {
  const tones = {
    amber: "border-amber-200/80 bg-amber-50/80 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    sky: "border-sky-200/80 bg-sky-50/80 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
    rose: "border-rose-200/80 bg-rose-50/80 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
  } as const;
  return (
    <div className={cn("flex items-start gap-2 rounded-2xl border p-3 text-xs sm:text-sm", tones[tone])}>
      {icon}
      <div className="flex-1">
        {children}
        {onClick && action && (
          <button type="button" onClick={onClick} className="ml-1 font-semibold underline underline-offset-2">
            {action}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── PreviewCard ─────────────────────────── */

function PreviewCard({
  currentSvg,
  finalSvg,
  loading,
  streamingText,
  reasoningText,
  firstTokenReceived,
  elapsedMs,
  showCode,
  setShowCode,
  copied,
  copyCode,
  downloadCurrentSvg,
  downloadCurrentPng,
}: {
  currentSvg: string | null;
  finalSvg: string | null;
  loading: boolean;
  streamingText: string;
  reasoningText: string;
  firstTokenReceived: boolean;
  elapsedMs: number;
  showCode: boolean;
  setShowCode: React.Dispatch<React.SetStateAction<boolean>>;
  copied: boolean;
  copyCode: () => void;
  downloadCurrentSvg: () => void;
  downloadCurrentPng: () => void;
}) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="relative flex aspect-square w-full max-h-[70vh] min-h-[280px] items-center justify-center bg-gradient-to-br from-stone-50 via-white to-rose-50/40 dark:from-zinc-900 dark:via-zinc-900 dark:to-rose-950/20">
        <div
          className="absolute inset-0 opacity-[0.5] dark:opacity-[0.25]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            color: "rgb(244 63 94 / 0.18)",
          }}
        />

        {currentSvg ? (
          <div
            className="relative z-10 h-[78%] w-[78%] sticker-shadow"
            dangerouslySetInnerHTML={{ __html: currentSvg }}
          />
        ) : loading && reasoningText && !streamingText ? (
          <ReasoningLive reasoningText={reasoningText} elapsedMs={elapsedMs} />
        ) : loading && streamingText ? (
          <StreamingCode text={streamingText} />
        ) : (
          <EmptyState />
        )}

        {loading && !currentSvg && !streamingText && !reasoningText && (
          <ThinkingAnimation
            phase={!firstTokenReceived ? "connecting" : "waiting"}
            reasoningText={reasoningText}
            elapsedMs={elapsedMs}
          />
        )}
      </div>

      {currentSvg && (
        <>
          <div className="flex flex-wrap items-center gap-1 border-t border-stone-200/40 p-2.5 sm:gap-1.5 sm:p-3 dark:border-zinc-800/60">
            <ToolButton onClick={downloadCurrentSvg} disabled={!finalSvg} icon={<Download className="h-3.5 w-3.5" />} label="SVG" />
            <ToolButton onClick={downloadCurrentPng} disabled={!finalSvg} icon={<ImageIcon className="h-3.5 w-3.5" />} label="PNG" />
            <ToolButton
              onClick={copyCode}
              disabled={!finalSvg}
              icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              label={copied ? "已复制" : "复制"}
            />
            <ToolButton
              onClick={() => setShowCode((v) => !v)}
              disabled={!finalSvg}
              icon={<Code2 className="h-3.5 w-3.5" />}
              label={showCode ? "隐藏" : "代码"}
            />
            <div className="ml-auto font-mono text-[10px] text-stone-400">
              {finalSvg ? `${Math.round(finalSvg.length / 10) / 100} KB` : "—"}
            </div>
          </div>

          {showCode && finalSvg && (
            <pre className="max-h-64 overflow-auto border-t border-stone-200/40 bg-stone-50/80 p-3 font-mono text-[10px] leading-relaxed text-stone-700 sm:text-[11px] dark:border-zinc-800/60 dark:bg-zinc-950/80 dark:text-zinc-300">
              {finalSvg}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────── ReasoningLive ─────────────────────────── */

function ReasoningLive({
  reasoningText,
  elapsedMs,
}: {
  reasoningText: string;
  elapsedMs: number;
}) {
  const localRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = localRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [reasoningText]);
  return (
    <div className="absolute inset-0 z-10 flex flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-violet-200/60 bg-gradient-to-r from-violet-50/80 to-fuchsia-50/80 px-3 py-2 backdrop-blur sm:px-4 dark:border-violet-500/20 dark:from-violet-500/10 dark:to-fuchsia-500/10">
        <Brain className="h-3.5 w-3.5 animate-pulse text-violet-500" />
        <span className="text-[11px] font-semibold text-violet-700 sm:text-xs dark:text-violet-300">AI 正在思考…</span>
        <span className="ml-auto font-mono text-[10px] text-stone-400">{(elapsedMs / 1000).toFixed(1)}s</span>
      </div>
      <div ref={localRef} className="flex-1 overflow-auto p-3 sm:p-4">
        <div className="max-w-full whitespace-pre-wrap break-words text-[11px] leading-relaxed text-stone-600 sm:text-xs dark:text-zinc-300">
          {reasoningText}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── StreamingCode ─────────────────────────── */

function StreamingCode({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-emerald-200/60 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 px-3 py-2 backdrop-blur sm:px-4 dark:border-emerald-500/20 dark:from-emerald-500/10 dark:to-teal-500/10">
        <FileCode className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-[11px] font-semibold text-emerald-700 sm:text-xs dark:text-emerald-300">正在绘制 SVG…</span>
      </div>
      <div className="flex-1 overflow-auto p-3 sm:p-4">
        <pre className="max-w-full whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-stone-500 sm:text-[11px] dark:text-zinc-400">
          {text}
        </pre>
      </div>
    </div>
  );
}

/* ─────────────────────────── EmptyState ─────────────────────────── */

function EmptyState() {
  return (
    <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
      <div className="relative">
        <div className="absolute inset-0 -m-4 rounded-full bg-gradient-to-br from-rose-200/50 to-amber-200/50 blur-2xl dark:from-rose-500/20 dark:to-amber-500/20" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-white to-stone-50 text-5xl shadow-lg ring-1 ring-stone-200/60 sm:h-24 sm:w-24 sm:text-6xl dark:from-zinc-800 dark:to-zinc-900 dark:ring-zinc-700/60">
          🎨
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">让想象变成表情</p>
        <p className="text-xs text-stone-500 sm:text-sm dark:text-zinc-400">
          描述一个想法，点「生成 Emoji」，
          <br className="hidden sm:block" />
          稍后这里会出现你的专属 SVG。
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── ThinkingAnimation ─────────────────────────── */

function ThinkingAnimation({
  phase,
  reasoningText,
  elapsedMs,
}: {
  phase: Phase;
  reasoningText: string;
  elapsedMs: number;
}) {
  const [msgIndex, setMsgIndex] = useState(0);
  const messages = PHASE_MESSAGES[phase];
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMsgIndex(0);
    const id = setInterval(() => setMsgIndex((i) => (i + 1) % messages.length), 2800);
    return () => clearInterval(id);
  }, [phase, messages.length]);

  const phaseIcon = {
    connecting: <Wifi className="h-7 w-7 text-sky-500 animate-pulse" />,
    waiting: <Loader2 className="h-7 w-7 text-indigo-500 animate-spin" />,
    thinking: <Brain className="h-7 w-7 text-violet-500 animate-pulse" />,
    drawing: <Sparkles className="h-7 w-7 text-amber-500 animate-pulse" />,
  }[phase];

  const phaseColor = {
    connecting: "from-sky-500/30 to-indigo-500/30",
    waiting: "from-indigo-500/30 to-violet-500/30",
    thinking: "from-violet-500/30 to-fuchsia-500/30",
    drawing: "from-amber-500/30 to-rose-500/30",
  }[phase];

  const dotColor = {
    connecting: "bg-sky-500",
    waiting: "bg-indigo-500",
    thinking: "bg-violet-500",
    drawing: "bg-amber-500",
  }[phase];

  const reasoningPreview = reasoningText ? reasoningText.slice(-180) : null;
  const phaseIndex = phase === "connecting" ? 0 : phase === "waiting" ? 1 : phase === "thinking" ? 2 : 3;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/70 backdrop-blur-md dark:bg-zinc-950/70">
      <div className="flex flex-col items-center gap-4 px-8">
        <div className="relative">
          <div className={cn("absolute inset-0 rounded-full bg-gradient-to-br blur-2xl animate-pulse", phaseColor)} style={{ width: "80px", height: "80px", margin: "-12px" }} />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/60 bg-white/90 shadow-lg dark:border-white/10 dark:bg-zinc-800/80">
            {phaseIcon}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", dotColor)} />
              <span className={cn("relative inline-flex h-2 w-2 rounded-full", dotColor)} />
            </span>
            <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">{PHASE_LABEL[phase]}</span>
            <span className="font-mono text-xs text-stone-400">{(elapsedMs / 1000).toFixed(1)}s</span>
          </div>
          <p key={`${phase}-${msgIndex}`} className="animate-fade-in text-center text-xs text-stone-500 dark:text-zinc-400">
            {messages[msgIndex]}
          </p>
        </div>
        {reasoningPreview && (
          <div className="mt-1 max-h-32 w-full max-w-xs overflow-hidden rounded-2xl border border-violet-200/60 bg-violet-50/70 px-3 py-2 dark:border-violet-500/20 dark:bg-violet-500/5">
            <div className="mb-1 flex items-center gap-1.5">
              <Brain className="h-3 w-3 text-violet-500" />
              <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400">AI 思考过程</span>
            </div>
            <p className="line-clamp-4 text-[11px] leading-relaxed text-stone-600 dark:text-zinc-400">{reasoningPreview}</p>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                i === phaseIndex
                  ? "w-6 bg-stone-700 dark:bg-stone-200"
                  : i < phaseIndex
                    ? "w-1.5 bg-stone-400 dark:bg-stone-500"
                    : "w-1.5 bg-stone-300 dark:bg-stone-600"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── ToolButton ─────────────────────────── */

function ToolButton({
  onClick,
  disabled,
  icon,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition sm:gap-1.5 sm:px-2.5 sm:text-xs",
        disabled
          ? "cursor-not-allowed text-stone-300 dark:text-zinc-600"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* ─────────────────────────── ReasoningModal ─────────────────────────── */

function ReasoningModal({
  reasoningText,
  elapsedMs,
  onClose,
}: {
  reasoningText: string;
  elapsedMs: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-md sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass-card relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200/40 px-4 py-3 sm:px-5 dark:border-zinc-800/60">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-500" />
            <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">思考过程</span>
            <span className="font-mono text-xs text-stone-400">{(elapsedMs / 1000).toFixed(1)}s</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 sm:p-5">
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-600 dark:text-zinc-300">
            {reasoningText}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── HistorySection ─────────────────────────── */

function HistorySection({
  history,
  onPick,
  onRemove,
  onClear,
}: {
  history: Generation[];
  onPick: (g: Generation) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (history.length === 0) return null;
  return (
    <section className="mt-10 sm:mt-14">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold tracking-tight text-stone-700 dark:text-stone-200">
          <span className="text-gradient">🕒</span> 最近生成 · {history.length}
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-stone-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          清空
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
        {history.map((g) => (
          <HistoryCard key={g.id} g={g} onPick={() => onPick(g)} onRemove={() => onRemove(g.id)} />
        ))}
      </div>
    </section>
  );
}

function HistoryCard({
  g,
  onPick,
  onRemove,
}: {
  g: Generation;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group glass-card relative overflow-hidden p-1.5 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-2">
      <button
        type="button"
        onClick={onPick}
        className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-stone-50 to-rose-50/40 dark:from-zinc-900 dark:to-rose-950/20"
        title={g.prompt}
      >
        <div className="h-[82%] w-[82%] sticker-shadow" dangerouslySetInnerHTML={{ __html: g.svg }} />
      </button>
      <p className="mt-1.5 line-clamp-1 px-1 text-[10px] text-stone-600 sm:text-[11px] dark:text-zinc-300">{g.prompt}</p>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-stone-400 opacity-0 shadow-sm transition group-hover:opacity-100 hover:text-rose-500 dark:bg-zinc-900/90"
        title="删除"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/* ─────────────────────────── SettingsDialog ─────────────────────────── */

function SettingsDialog(props: {
  onClose: () => void;
  value: AppSettings;
  onChange: (s: AppSettings) => void;
  configs: ModelConfig[];
  activeConfigId: string | null;
  onAddConfig: (input: { name: string; baseUrl: string; model: string; apiKey: string }) => void;
  onRemoveConfig: (id: string) => void;
  onRenameConfig: (id: string, name: string) => void;
  onActivateConfig: (id: string) => void;
  user: SessionUser | null;
  presets: typeof ModelPresets;
}) {
  const { onClose, value, onChange, configs, activeConfigId, onAddConfig, onRemoveConfig, onRenameConfig, onActivateConfig, user, presets } = props;
  const [draft, setDraft] = useState(value);
  const [show, setShow] = useState(false);
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function saveCurrentAsConfig() {
    const url = draft.baseUrl.trim();
    const model = draft.model.trim();
    if (!url || !model) {
      alert("Base URL 和 Model 都不能为空才能保存为配置");
      return;
    }
    const name = window.prompt(
      "给这个配置起个名字(例:工作 DeepSeek、个人 OpenAI、本地 Ollama):",
      (() => {
        try {
          const host = new URL(url).hostname;
          const clean = host
            .replace(/^(?:api|www)\./i, "")
            .replace(/\.(?:com|cn|net|org|io|ai|co|app|edu|gov)$/i, "");
          return `${clean} · ${model}`;
        } catch {
          return `${url} · ${model}`;
        }
      })(),
    );
    if (!name || !name.trim()) return;
    onAddConfig({
      name: name.trim().slice(0, 24),
      baseUrl: url,
      model,
      apiKey: draft.apiKey.trim(),
    });
  }

  function renameConfigPrompt(id: string, currentName: string) {
    const name = window.prompt("重命名这个配置:", currentName);
    if (!name || !name.trim()) return;
    onRenameConfig(id, name.trim().slice(0, 24));
  }

  async function runTest() {
    setTestState({ kind: "testing" });
    try {
      const res = await fetch("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: draft.apiKey || undefined,
          baseUrl: draft.baseUrl || undefined,
          model: draft.model || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestState({ kind: "ok", latencyMs: data.latencyMs, sample: data.sample });
      } else {
        setTestState({ kind: "err", message: data.error || "未知错误" });
      }
    } catch (e) {
      setTestState({ kind: "err", message: e instanceof Error ? e.message : "请求失败" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-md sm:items-center sm:p-4">
      <div className="glass-card flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:max-h-[85vh] sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200/40 px-5 py-4 dark:border-zinc-800/60">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500/10 to-amber-500/10 text-rose-500">
              <Settings className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-base font-semibold text-stone-900 dark:text-stone-50">API 设置</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-4 text-xs leading-relaxed text-stone-500 dark:text-zinc-400">
            兼容任何 OpenAI 协议接口：OpenAI、DeepSeek、OpenRouter、Ollama(本地)等。
            Key 仅保存在你的浏览器 localStorage，不会上传服务器。
          </p>

          {!user && (
            <div className="mb-4 flex items-start gap-2 rounded-2xl border border-sky-200/80 bg-sky-50/80 p-2.5 text-xs text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
              <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <div>
                访客模式：仅可使用 <span className="font-medium">sensenova-6.7-flash-lite</span>。
                <Link href="/login" className="ml-1 font-medium underline">登录</Link>
                或
                <Link href="/register" className="ml-1 font-medium underline">注册</Link>
                解锁更多模型。
              </div>
            </div>
          )}

          {(() => {
            const matchedPreset = presets.find(
              (p) => p.baseUrl === draft.baseUrl && p.model === draft.model,
            );
            if (!matchedPreset && draft.baseUrl && draft.model) {
              return (
                <Field
                  label="Base URL"
                  value={draft.baseUrl}
                  onChange={(v) => setDraft({ ...draft, baseUrl: v })}
                  placeholder="https://api.openai.com/v1"
                  hint="支持任意 OpenAI 兼容服务"
                />
              );
            }
            return null;
          })()}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-stone-700 dark:text-stone-300">快速预设</label>
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {presets.map((p) => {
                const locked = p.requireAuth && !user;
                const active = draft.baseUrl === p.baseUrl && draft.model === p.model;
                return (
                  <button
                    key={p.label}
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      !locked &&
                      setDraft({
                        ...draft,
                        baseUrl: p.baseUrl,
                        model: p.model,
                        apiKey: p.useServerKey ? "" : draft.apiKey,
                      })
                    }
                    title={locked ? "该模型需要登录后才能使用" : undefined}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] transition sm:text-xs",
                      locked
                        ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-500"
                        : active
                          ? "border-rose-400/50 bg-gradient-to-r from-rose-50 to-amber-50 text-rose-700 shadow-sm dark:border-rose-400/40 dark:from-rose-500/10 dark:to-amber-500/10 dark:text-rose-300"
                          : "border-stone-200/80 bg-white/60 text-stone-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300 dark:hover:border-rose-400/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                    )}
                  >
                    {p.label}
                    {locked && <Lock className="h-3 w-3" />}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setDraft({ ...draft, baseUrl: "", model: "" });
                }}
                className={cn(
                  "rounded-full border border-dashed px-3 py-1 text-[11px] transition sm:text-xs",
                  !draft.baseUrl && !draft.model
                    ? "border-rose-400/50 bg-rose-50 text-rose-600 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-300"
                    : "border-stone-300 text-stone-500 hover:border-rose-300 hover:text-rose-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-rose-400/40 dark:hover:text-rose-300"
                )}
              >
                + Custom
              </button>
            </div>
          </div>

          <div className="mb-3">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">我的配置</label>
              <button
                type="button"
                onClick={saveCurrentAsConfig}
                className="text-[11px] font-semibold text-rose-600 hover:underline dark:text-rose-400"
              >
                + 保存当前为新配置
              </button>
            </div>
            {configs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-stone-200 px-3 py-2.5 text-[11px] text-stone-400 dark:border-zinc-800">
                还没保存任何配置。填好下面三项，点「保存当前为新配置」即可。
              </p>
            ) : (
              <ul className="space-y-1.5">
                {configs.map((c) => {
                  const active = c.id === activeConfigId;
                  return (
                    <li
                      key={c.id}
                      className={cn(
                        "flex items-center gap-2 rounded-2xl border px-2.5 py-2 text-xs transition",
                        active
                          ? "border-rose-300 bg-rose-50/60 dark:border-rose-400/40 dark:bg-rose-500/10"
                          : "border-stone-200/80 bg-white/60 dark:border-zinc-800 dark:bg-zinc-900/40"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "truncate font-medium",
                              active ? "text-rose-700 dark:text-rose-300" : "text-stone-800 dark:text-stone-100"
                            )}
                            title={c.name}
                          >
                            {c.name}
                          </span>
                          {active && (
                            <span className="rounded-full bg-gradient-to-r from-rose-500 to-amber-500 px-1.5 py-px text-[9px] font-semibold text-white">
                              当前
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[10px] text-stone-400" title={`${c.baseUrl} · ${c.model}`}>
                          {c.baseUrl} · {c.model}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft({ ...draft, apiKey: c.apiKey, baseUrl: c.baseUrl, model: c.model });
                          onActivateConfig(c.id);
                        }}
                        className="shrink-0 rounded-md px-1.5 py-0.5 text-stone-500 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/20"
                        title="加载到此表单并设为当前"
                      >
                        使用
                      </button>
                      <button
                        type="button"
                        onClick={() => renameConfigPrompt(c.id, c.name)}
                        className="shrink-0 rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-zinc-800"
                        title="重命名"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`删除配置「${c.name}」?`)) onRemoveConfig(c.id);
                        }}
                        className="shrink-0 rounded-md p-1 text-stone-400 hover:bg-rose-100 hover:text-rose-500 dark:hover:bg-rose-500/20"
                        title="删除"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {(() => {
            const matchedPreset = presets.find(
              (p) => p.baseUrl === draft.baseUrl && p.model === draft.model,
            );
            const isCustom = !draft.baseUrl && !draft.model;
            if (matchedPreset) {
              return (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2.5 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <span className="font-medium">{matchedPreset.label}</span>
                    {matchedPreset.useServerKey
                      ? " — 使用服务端默认 API Key，无需配置。"
                      : " — 需要你自己的 API Key。"}
                  </div>
                  {!matchedPreset.useServerKey && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-stone-700 dark:text-stone-300">API Key</label>
                      <div className="relative">
                        <input
                          type={show ? "text" : "password"}
                          value={draft.apiKey}
                          onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                          placeholder="sk-..."
                          autoComplete="off"
                          className="w-full rounded-xl border border-stone-200 bg-white/90 px-3 py-2 pr-16 text-sm outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100 dark:border-zinc-700 dark:bg-zinc-900/60 dark:focus:border-rose-400 dark:focus:ring-rose-500/10"
                        />
                        <button
                          type="button"
                          onClick={() => setShow((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-0.5 text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800"
                        >
                          {show ? "隐藏" : "显示"}
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-stone-400">Key 仅保存在浏览器 localStorage，不会上传服务器。</p>
                    </div>
                  )}
                  {matchedPreset.supportsThinking && (
                    <div className="space-y-2 rounded-2xl border border-violet-200/80 bg-violet-50/80 px-3 py-2.5 dark:border-violet-500/30 dark:bg-violet-500/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                          <Brain className="h-3.5 w-3.5" />
                          思考模式
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={getThinkingForModel(draft, draft.model).enabled}
                          onClick={() => {
                            const tc = getThinkingForModel(draft, draft.model);
                            setDraft(setThinkingForModel(draft, draft.model, { enabled: !tc.enabled }));
                          }}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                            getThinkingForModel(draft, draft.model).enabled
                              ? "bg-violet-500"
                              : "bg-stone-200 dark:bg-zinc-700"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
                              getThinkingForModel(draft, draft.model).enabled ? "translate-x-4" : "translate-x-0.5"
                            )}
                          />
                        </button>
                      </div>
                      {getThinkingForModel(draft, draft.model).enabled && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-violet-600 dark:text-violet-400">推理力度:</span>
                          {(["low", "medium", "high"] as const).map((level) => {
                            const labels = { low: "低", medium: "中", high: "高" };
                            const active = getThinkingForModel(draft, draft.model).effort === level;
                            return (
                              <button
                                key={level}
                                type="button"
                                onClick={() =>
                                  setDraft(setThinkingForModel(draft, draft.model, { effort: level }))
                                }
                                className={cn(
                                  "rounded-md px-2 py-0.5 text-[11px] font-medium transition",
                                  active
                                    ? "bg-violet-500 text-white"
                                    : "bg-violet-100 text-violet-600 hover:bg-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:hover:bg-violet-500/30"
                                )}
                              >
                                {labels[level]}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <>
                {isCustom && (
                  <Field
                    label="Base URL"
                    value={draft.baseUrl}
                    onChange={(v) => setDraft({ ...draft, baseUrl: v })}
                    placeholder="https://api.openai.com/v1"
                  />
                )}
                <Field
                  label="Model"
                  value={draft.model}
                  onChange={(v) => setDraft({ ...draft, model: v })}
                  placeholder="deepseek-v4-flash"
                  hint={
                    !user && RESTRICTED_MODELS.has(draft.model.trim())
                      ? "该模型需要登录后才能使用"
                      : undefined
                  }
                />
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700 dark:text-stone-300">API Key</label>
                  <div className="relative">
                    <input
                      type={show ? "text" : "password"}
                      value={draft.apiKey}
                      onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                      placeholder="sk-..."
                      autoComplete="off"
                      className="w-full rounded-xl border border-stone-200 bg-white/90 px-3 py-2 pr-16 text-sm outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100 dark:border-zinc-700 dark:bg-zinc-900/60 dark:focus:border-rose-400 dark:focus:ring-rose-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-0.5 text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800"
                    >
                      {show ? "隐藏" : "显示"}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-stone-400">留空则尝试使用服务端环境变量 <code>OPENAI_API_KEY</code>。</p>
                </div>
              </>
            );
          })()}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={runTest}
              disabled={testState.kind === "testing"}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-stone-200 dark:hover:border-rose-400/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
            >
              {testState.kind === "testing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              测试连接
            </button>
            <TestResult state={testState} />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-stone-200/40 bg-white/40 px-5 py-3 dark:border-zinc-800/60 dark:bg-zinc-950/40">
          <span className="text-[11px] text-stone-400">
            按 <kbd className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[10px] dark:border-zinc-700 dark:bg-zinc-800">ESC</kbd> 关闭
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-stone-200 px-4 py-1.5 text-sm text-stone-700 transition hover:bg-stone-50 dark:border-zinc-700 dark:text-stone-200 dark:hover:bg-zinc-800"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(draft);
                onClose();
              }}
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 text-sm"
            >
              <Check className="h-3.5 w-3.5" />
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-semibold text-stone-700 dark:text-stone-300">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-stone-200 bg-white/90 px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100 dark:border-zinc-700 dark:bg-zinc-900/60 dark:focus:border-rose-400 dark:focus:ring-rose-500/10"
      />
      {hint && <p className="mt-1 text-[11px] text-stone-400">{hint}</p>}
    </div>
  );
}

function TestResult({ state }: { state: TestState }) {
  if (state.kind === "idle") {
    return <span className="text-[11px] text-stone-400">验证 Key / URL / Model 是否可用</span>;
  }
  if (state.kind === "testing") {
    return <span className="text-[11px] text-stone-500">正在测试…</span>;
  }
  if (state.kind === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" />
        连接成功 · {state.latencyMs}ms
        {state.sample && <span className="text-stone-400">· 响应「{state.sample}」</span>}
      </span>
    );
  }
  return (
    <span className="text-[11px] text-rose-600 dark:text-rose-400" title={state.message}>
      ❌ {state.message}
    </span>
  );
}
