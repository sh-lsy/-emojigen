"use client";

import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { STYLES, type EmojiStyle, type Generation } from "@/lib/styles";
import {
  loadHistory,
  appendHistory,
  removeFromHistory,
  clearHistory,
  loadSettings,
  saveSettings,
  type Settings as AppSettings,
} from "@/lib/storage";
import { cn, downloadPng, downloadSvg, extractSvg } from "@/lib/utils";

const EXAMPLES = [
  "一只喝咖啡的猫头鹰",
  "生气的西兰花战士",
  "在月球上打盹的狐狸",
  "爆炸头的外卖小哥",
  "赛博风格的招财猫",
  "流泪的可达鸭",
  "戴墨镜的柠檬切片",
  "拿宝剑的饭团勇者",
];

const PRESETS = [
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { label: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  { label: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  { label: "Ollama(本地)", baseUrl: "http://localhost:11434/v1", model: "qwen2.5:7b" },
];

export default function EmojiGenerator() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<EmojiStyle>("kawaii");
  const [streamingText, setStreamingText] = useState("");
  const [finalSvg, setFinalSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Generation[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Load persisted state once on mount. This is a legitimate one-time
    // sync with an external system (localStorage) — the cascading-renders
    // concern this lint rule targets doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadHistory());
    setSettings(loadSettings());
  }, []);

  const currentSvg = (() => {
    const live = extractSvg(streamingText);
    return live || finalSvg;
  })();

  const canGenerate = prompt.trim().length > 0 && !loading;

  async function generate() {
    if (!canGenerate) return;
    setError(null);
    setFinalSvg(null);
    setStreamingText("");
    setLoading(true);

    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;

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
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed: ${res.status}`);
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let lastSvg: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreamingText(acc);
        const found = extractSvg(acc);
        if (found) lastSvg = found;
      }

      if (!lastSvg) {
        throw new Error(
          "模型没按规矩输出 SVG。\n建议:\n• 换更听话的模型(OpenAI gpt-4o-mini、DeepSeek-V3、Claude Haiku 都稳)\n• 提示词写具体一点,别太抽象\n• 点「重新生成」多试几次",
        );
      }
      setFinalSvg(lastSvg);
      setHistory((cur) => appendHistory(cur, prompt.trim(), style, lastSvg!));
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
      abortRef.current = null;
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
    const next = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-amber-50 to-sky-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <Header
        onSettings={() => setShowSettings(true)}
        hasKey={!!settings.apiKey}
      />

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          {/* Left: form */}
          <section className="space-y-5">
            <div className="rounded-3xl border border-black/5 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/70">
              <label
                htmlFor="prompt"
                className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
              >
                描述你想要的 Emoji
              </label>
              <div className="relative">
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  placeholder="例如:一只在云上弹吉他的熊猫"
                  className="w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 pr-12 text-base text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-rose-400 dark:focus:ring-rose-900/40"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      generate();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={shufflePrompt}
                  title="随机示例"
                  className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-zinc-800"
                >
                  <Shuffle className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {EXAMPLES.slice(0, 4).map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setPrompt(ex)}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:border-rose-400/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-black/5 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/70">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  风格
                </span>
                <span className="text-xs text-zinc-400">
                  {STYLES.find((s) => s.id === style)?.name}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {STYLES.map((s) => {
                  const active = s.id === style;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStyle(s.id)}
                      className={cn(
                        "group relative flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition",
                        active
                          ? "border-rose-400 bg-rose-50/80 ring-2 ring-rose-200 dark:border-rose-400/60 dark:bg-rose-500/10 dark:ring-rose-500/30"
                          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950/50 dark:hover:border-zinc-600",
                      )}
                    >
                      <span className="text-2xl leading-none">{s.emoji}</span>
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        {s.name}
                      </span>
                      <span className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {s.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!loading ? (
                <button
                  type="button"
                  onClick={generate}
                  disabled={!canGenerate}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-semibold text-white shadow-sm transition",
                    canGenerate
                      ? "bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 hover:shadow-md active:scale-[0.99]"
                      : "cursor-not-allowed bg-zinc-300 dark:bg-zinc-700",
                  )}
                >
                  <Sparkles className="h-5 w-5" />
                  生成 Emoji
                </button>
              ) : (
                <button
                  type="button"
                  onClick={abort}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-5 py-3.5 text-base font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  <Loader2 className="h-5 w-5 animate-spin" />
                  正在生成… 点击取消
                </button>
              )}
              {finalSvg && !loading && (
                <button
                  type="button"
                  onClick={regenerate}
                  title="重新生成"
                  className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white p-3.5 text-zinc-700 transition hover:border-rose-300 hover:text-rose-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              )}
            </div>

            {!settings.apiKey && (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <Key className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                  未配置 API Key。
                  <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    className="ml-1 underline underline-offset-2"
                  >
                    打开设置 →
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50/80 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div className="whitespace-pre-wrap break-words">{error}</div>
              </div>
            )}
          </section>

          {/* Right: preview */}
          <section className="lg:sticky lg:top-6 lg:self-start">
            <div className="overflow-hidden rounded-3xl border border-black/5 bg-white/80 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/70">
              <div
                className={cn(
                  "relative flex aspect-square w-full items-center justify-center",
                  "bg-[radial-gradient(circle_at_30%_20%,#fff_0%,transparent_50%),radial-gradient(circle_at_70%_80%,#fff_0%,transparent_50%)]",
                  "dark:bg-[radial-gradient(circle_at_30%_20%,#27272a_0%,transparent_50%),radial-gradient(circle_at_70%_80%,#27272a_0%,transparent_50%)]",
                )}
              >
                {currentSvg ? (
                  <div
                    className="h-[80%] w-[80%] transition-opacity duration-300"
                    dangerouslySetInnerHTML={{ __html: currentSvg }}
                  />
                ) : (
                  <EmptyState />
                )}

                {loading && !currentSvg && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm dark:bg-zinc-900/40">
                    <div className="flex flex-col items-center gap-2 text-zinc-500">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="text-xs">正在挥动画笔…</span>
                    </div>
                  </div>
                )}
              </div>

              {currentSvg && (
                <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
                  <ToolButton
                    onClick={downloadCurrentSvg}
                    disabled={!finalSvg}
                    icon={<Download className="h-4 w-4" />}
                    label="SVG"
                  />
                  <ToolButton
                    onClick={downloadCurrentPng}
                    disabled={!finalSvg}
                    icon={<ImageIcon className="h-4 w-4" />}
                    label="PNG"
                  />
                  <ToolButton
                    onClick={copyCode}
                    disabled={!finalSvg}
                    icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    label={copied ? "已复制" : "复制"}
                  />
                  <ToolButton
                    onClick={() => setShowCode((v) => !v)}
                    disabled={!finalSvg}
                    icon={<Code2 className="h-4 w-4" />}
                    label={showCode ? "隐藏代码" : "代码"}
                  />
                  <div className="ml-auto text-xs text-zinc-400">
                    {finalSvg ? `${Math.round(finalSvg.length / 10) / 100} KB` : "—"}
                  </div>
                </div>
              )}

              {showCode && finalSvg && (
                <pre className="max-h-64 overflow-auto border-t border-zinc-100 bg-zinc-50 p-3 text-[11px] leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                  {finalSvg}
                </pre>
              )}
            </div>
          </section>
        </div>

        <HistorySection
          history={history}
          onPick={pickFromHistory}
          onRemove={removeHistoryItem}
          onClear={onClearHistory}
        />
      </main>

      {showSettings && (
        <SettingsDialog
          key="settings-open"
          onClose={() => setShowSettings(false)}
          value={settings}
          onChange={(s) => {
            setSettings(s);
            saveSettings(s);
          }}
        />
      )}

      <footer className="border-t border-black/5 bg-white/40 py-6 text-center text-xs text-zinc-500 backdrop-blur dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-400">
        <p>
          Built with Next.js + Vercel AI SDK · BYO API Key · 生成的 SVG 完全归你所有
        </p>
      </footer>
    </div>
  );
}

function Header({
  onSettings,
  hasKey,
}: {
  onSettings: () => void;
  hasKey: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white/70 backdrop-blur-md dark:border-white/10 dark:bg-zinc-950/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow-sm">
            <Wand2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold leading-none tracking-tight text-zinc-900 dark:text-zinc-50">
              Emojigen
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              AI · SVG · 表情包生成器
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onSettings}
          className="relative inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 transition hover:border-rose-300 hover:text-rose-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">设置</span>
          {hasKey && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950" />
          )}
        </button>
      </div>
    </header>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 text-center text-zinc-400">
      <div className="text-5xl">🎨</div>
      <p className="text-sm">
        描述一个想法,点「生成 Emoji」,
        <br />
        几秒后这里会出现你的专属 SVG。
      </p>
    </div>
  );
}

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
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
        disabled
          ? "cursor-not-allowed text-zinc-300 dark:text-zinc-600"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

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
    <section className="mt-12">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-700 dark:text-zinc-200">
          最近生成 · {history.length}
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 text-xs text-zinc-400 transition hover:text-rose-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
          清空
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {history.map((g) => (
          <HistoryCard
            key={g.id}
            g={g}
            onPick={() => onPick(g)}
            onRemove={() => onRemove(g.id)}
          />
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
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 p-2 shadow-sm transition hover:border-rose-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/70">
      <button
        type="button"
        onClick={onPick}
        className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-50 dark:bg-zinc-950"
        title={g.prompt}
      >
        <div
          className="h-[85%] w-[85%]"
          dangerouslySetInnerHTML={{ __html: g.svg }}
        />
      </button>
      <p className="mt-1.5 line-clamp-1 px-1 text-xs text-zinc-600 dark:text-zinc-300">
        {g.prompt}
      </p>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 rounded-full bg-white/80 p-1 text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:text-rose-500 dark:bg-zinc-900/80"
        title="删除"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function SettingsDialog({
  onClose,
  value,
  onChange,
}: {
  onClose: () => void;
  value: AppSettings;
  onChange: (s: AppSettings) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [show, setShow] = useState(false);
  type TestState =
    | { kind: "idle" }
    | { kind: "testing" }
    | { kind: "ok"; latencyMs: number; sample?: string }
    | { kind: "err"; message: string };
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });

  // ESC to close (clicking outside is intentionally disabled to prevent
  // accidental dismissal).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
        setTestState({
          kind: "ok",
          latencyMs: data.latencyMs,
          sample: data.sample,
        });
      } else {
        setTestState({ kind: "err", message: data.error || "未知错误" });
      }
    } catch (e) {
      setTestState({
        kind: "err",
        message: e instanceof Error ? e.message : "请求失败",
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-black/5 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            API 设置
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          兼容任何 OpenAI 协议接口:OpenAI、DeepSeek、OpenRouter、Ollama(本地)等。
          Key 仅保存在你的浏览器 localStorage,不会上传服务器。
        </p>

        <Field
          label="Base URL"
          value={draft.baseUrl}
          onChange={(v) => setDraft({ ...draft, baseUrl: v })}
          placeholder="https://api.openai.com/v1"
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            快速预设
          </label>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    baseUrl: p.baseUrl,
                    model: p.model,
                  })
                }
                className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:border-rose-400/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <Field
          label="Model"
          value={draft.model}
          onChange={(v) => setDraft({ ...draft, model: v })}
          placeholder="gpt-4o-mini"
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            API Key
          </label>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              placeholder="sk-..."
              autoComplete="off"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 pr-16 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-rose-400 dark:focus:ring-rose-900/40"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {show ? "隐藏" : "显示"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            留空则尝试使用服务端环境变量 <code>OPENAI_API_KEY</code>。
          </p>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={runTest}
            disabled={testState.kind === "testing"}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-rose-400/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
          >
            {testState.kind === "testing" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            测试连接
          </button>
          <TestResult state={testState} />
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <span className="text-[11px] text-zinc-400">
            按 <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] dark:border-zinc-700 dark:bg-zinc-800">ESC</kbd> 关闭
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(draft);
                onClose();
              }}
              className="rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-4 py-2 text-sm font-medium text-white hover:from-rose-600 hover:to-amber-600"
            >
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-rose-400 dark:focus:ring-rose-900/40"
      />
    </div>
  );
}

type TestResultState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok"; latencyMs: number; sample?: string }
  | { kind: "err"; message: string };

function TestResult({ state }: { state: TestResultState }) {
  if (state.kind === "idle") {
    return (
      <span className="text-[11px] text-zinc-400">
        验证 Key / URL / Model 是否可用
      </span>
    );
  }
  if (state.kind === "testing") {
    return <span className="text-[11px] text-zinc-500">正在测试…</span>;
  }
  if (state.kind === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" />
        连接成功 · {state.latencyMs}ms
        {state.sample && (
          <span className="text-zinc-400">· 响应「{state.sample}」</span>
        )}
      </span>
    );
  }
  return (
    <span
      className="text-[11px] text-rose-600 dark:text-rose-400"
      title={state.message}
    >
      ❌ {state.message}
    </span>
  );
}
