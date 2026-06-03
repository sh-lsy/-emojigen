"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
} from "@/lib/storage";
import { cn, downloadPng, downloadSvg, extractSvg } from "@/lib/utils";

// 随机组合：角色 + 表情/情绪（emoji 的核心）
const CHARACTERS = [
  // 动物
  "猫咪", "狗子", "熊猫", "企鹅", "狐狸", "柴犬",
  "兔子", "小熊", "考拉", "水豚", "可达鸭",
  // 食物
  "饭团", "奶茶", "蛋挞", "披萨", "西瓜", "寿司",
  // 物品/其他
  "月亮", "仙人掌", "云朵", "小灯泡", "小蘑菇",
];
const EXPRESSIONS = [
  // 正面情绪
  "开心到飞起", "偷笑", "眼睛亮晶晶", "幸福冒泡", "得意洋洋",
  // 负面情绪
  "委屈巴巴", "气到冒烟", "泪如雨下", "心态崩溃", "社恐发作",
  // 中性/搞怪
  "一脸懵逼", "摆烂中", "假装很酷", "犯困", "吃瓜表情",
  // 动作强化情绪
  "捂嘴偷笑", "抱头崩溃", "比耶", "歪头卖萌", "翻白眼",
];

function randomExample(): string {
  const char = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  const expr = EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)];
  return `${expr}的${char}`;
}

const PRESETS = [
  { label: "智谱 GLM-4-Flash ⭐", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { label: "DeepSeek V4-Flash", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash" },
  { label: "DeepSeek V4-Pro", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-pro" },
  { label: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  { label: "Ollama(本地)", baseUrl: "http://localhost:11434/v1", model: "qwen2.5:7b" },
];

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
  const [settings, setSettings] = useState<AppSettings>({
    apiKey: "",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-flash",
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

  useEffect(() => {
    // Load persisted state once on mount. This is a legitimate one-time
    // sync with an external system (localStorage) — the cascading-renders
    // concern this lint rule targets doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadHistory());
    setSettings(loadSettings());
    setConfigs(loadConfigs());
  }, []);

  useEffect(() => {
    if (!loading) return;
    const start = performance.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setElapsedMs(0);
    const id = setInterval(() => setElapsedMs(performance.now() - start), 100);
    return () => clearInterval(id);
  }, [loading]);

  // Auto-scroll reasoning text to bottom as new content streams in
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

  const exampleButtons = useMemo(
    () =>
      [0, 1, 2, 3].map((i) => {
        const ex = randomExample();
        return (
          <button
            key={i}
            type="button"
            onClick={() => setPrompt(ex)}
            className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:border-rose-400/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
          >
            {ex}
          </button>
        );
      }),
    [],
  );

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

    // Abort any in-flight request first, then wait a tick for the previous
    // stream's resources to fully release before opening a new one. Without
    // this small gap, the next fetch can race the cleanup and hang.
    abortRef.current?.abort();
    await new Promise((r) => setTimeout(r, 50));

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    // --- timeout helpers ---
    // No connect timeout: the backend sends a heartbeat immediately,
    // so if the connection fails the read timeout below will catch it.
    // Reasoning models (DeepSeek V4) can take 60-120s before first token,
    // a hard connect timeout would kill valid requests.
    const READ_TIMEOUT_MS = 120_000; // 120s without any new chunk → abort

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
              // heartbeat: server is alive, exit "connecting" phase
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
      // Explicitly release the reader so the underlying connection is
      // freed immediately, instead of waiting for GC.
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
                {exampleButtons}
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
                  {(() => {
                    const phase = !firstTokenReceived
                      ? "connecting"
                      : reasoningText
                      ? "thinking"
                      : currentSvg
                      ? "drawing"
                      : "waiting";
                    const icon = {
                      connecting: <Wifi className="h-5 w-5 animate-pulse" />,
                      thinking: <Brain className="h-5 w-5 animate-pulse" />,
                      drawing: <Sparkles className="h-5 w-5 animate-pulse" />,
                      waiting: <Loader2 className="h-5 w-5 animate-spin" />,
                    }[phase];
                    const label = {
                      connecting: "连接中",
                      thinking: "思考中",
                      drawing: "绘制中",
                      waiting: "等待模型",
                    }[phase];
                    return <>{icon}{label}… {(elapsedMs / 1000).toFixed(1)}s · {(bytesReceived / 1024).toFixed(1)}KB</>;
                  })()}
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
          <section ref={previewRef} className="lg:sticky lg:top-6 lg:self-start">
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
                ) : loading && reasoningText && !streamingText ? (
                  /* Reasoning stream: show AI thinking process live */
                  <div className="absolute inset-0 flex flex-col overflow-hidden">
                    <div className="flex shrink-0 items-center gap-1.5 border-b border-violet-100 px-4 py-2.5 dark:border-violet-900/50">
                      <Brain className="h-3.5 w-3.5 animate-pulse text-violet-500" />
                      <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">
                        AI 正在思考…
                      </span>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {(elapsedMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div ref={reasoningScrollRef} className="flex-1 overflow-auto p-4">
                      <div className="max-w-full whitespace-pre-wrap break-words text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                        {reasoningText}
                      </div>
                    </div>
                  </div>
                ) : loading && streamingText ? (
                  /* SVG code streaming: show raw code */
                  <div className="absolute inset-0 flex flex-col overflow-hidden">
                    <div className="flex shrink-0 items-center gap-1.5 border-b border-emerald-100 px-4 py-2.5 dark:border-emerald-900/50">
                      <FileCode className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        正在绘制…
                      </span>
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                      <pre className="max-w-full whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {streamingText}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <EmptyState />
                )}

                {loading &&
                  !currentSvg &&
                  !streamingText &&
                  !reasoningText && (
                    <ThinkingAnimation
                      phase={
                        !firstTokenReceived
                          ? "connecting"
                          : "waiting"
                      }
                      reasoningText={reasoningText}
                      elapsedMs={elapsedMs}
                    />
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

            {/* Reasoning overlay: compact trigger + modal */}
            {reasoningText && !loading && (
              <div className="mt-2">
                <button
                  onClick={() => setReasoningExpanded(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-black/5 bg-white/80 px-3 py-2 text-xs font-medium text-zinc-500 shadow-sm backdrop-blur transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <Brain className="h-3.5 w-3.5 text-violet-500" />
                  💭 查看思考过程
                  <span className="text-zinc-400">({(elapsedMs / 1000).toFixed(1)}s)</span>
                </button>
              </div>
            )}

            {/* Reasoning modal overlay */}
            {reasoningExpanded && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                onClick={() => setReasoningExpanded(false)}
              >
                <div
                  className="relative mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-zinc-200 bg-white p-0 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-violet-500" />
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">💭 思考过程</span>
                      <span className="font-mono text-xs text-zinc-400">{(elapsedMs / 1000).toFixed(1)}s</span>
                    </div>
                    <button
                      onClick={() => setReasoningExpanded(false)}
                      className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-5">
                    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                      {reasoningText}
                    </div>
                  </div>
                </div>
              </div>
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
            const newSettings = {
              apiKey: c.apiKey,
              baseUrl: c.baseUrl,
              model: c.model,
            };
            setSettings(newSettings);
            saveSettings(newSettings);
            setActiveConfigId(id);
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
        稍后这里会出现你的专属 SVG。
      </p>
    </div>
  );
}

type ThinkingPhase = "connecting" | "waiting" | "thinking" | "drawing";

const PHASE_MESSAGES: Record<ThinkingPhase, string[]> = {
  connecting: [
    "正在连接 AI 模型…",
    "建立安全连接中…",
    "准备生成环境…",
  ],
  waiting: [
    "已连接，等待模型响应…",
    "模型正在准备中…",
    "排队等待推理…",
  ],
  thinking: [
    "正在理解你的描述…",
    "构思视觉方案…",
    "规划图形结构…",
    "设计配色方案…",
    "确定布局构图…",
  ],
  drawing: [
    "正在绘制 SVG…",
    "生成图形元素…",
    "组装表情符号…",
  ],
};

function ThinkingAnimation({
  phase,
  reasoningText,
  elapsedMs,
}: {
  phase: ThinkingPhase;
  reasoningText: string;
  elapsedMs: number;
}) {
  const [msgIndex, setMsgIndex] = useState(0);
  const messages = PHASE_MESSAGES[phase];

  useEffect(() => {
    // Reset message index when phase changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMsgIndex(0);
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length);
    }, 2800);
    return () => clearInterval(id);
  }, [phase, messages.length]);

  const phaseIcon = {
    connecting: <Wifi className="h-7 w-7 text-sky-500 animate-pulse" />,
    waiting: <Loader2 className="h-7 w-7 text-indigo-500 animate-spin" />,
    thinking: <Brain className="h-7 w-7 text-violet-500 animate-pulse" />,
    drawing: <Sparkles className="h-7 w-7 text-amber-500 animate-pulse" />,
  }[phase];

  const phaseLabel = {
    connecting: "连接中",
    waiting: "等待模型",
    thinking: "思考中",
    drawing: "绘制中",
  }[phase];

  const phaseColor = {
    connecting: "from-sky-500/20 to-blue-500/20",
    waiting: "from-indigo-500/20 to-sky-500/20",
    thinking: "from-violet-500/20 to-purple-500/20",
    drawing: "from-amber-500/20 to-rose-500/20",
  }[phase];

  // Show last N chars of reasoning text as a live preview
  const reasoningPreview = reasoningText
    ? reasoningText.slice(-180)
    : null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm dark:bg-zinc-900/60">
      <div className="flex flex-col items-center gap-4 px-8">
        {/* Animated icon with ring */}
        <div className="relative">
          <div className={cn(
            "absolute inset-0 rounded-full bg-gradient-to-br blur-xl animate-pulse", phaseColor
          )} style={{ width: "80px", height: "80px", margin: "-12px" }} />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/40 bg-white/80 shadow-lg dark:border-white/10 dark:bg-zinc-800/80">
            {phaseIcon}
          </div>
        </div>

        {/* Phase label + timer */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                phase === "connecting" ? "bg-sky-400" : phase === "waiting" ? "bg-indigo-400" : phase === "thinking" ? "bg-violet-400" : "bg-amber-400"
              )} />
              <span className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                phase === "connecting" ? "bg-sky-500" : phase === "waiting" ? "bg-indigo-500" : phase === "thinking" ? "bg-violet-500" : "bg-amber-500"
              )} />
            </span>
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              {phaseLabel}
            </span>
            <span className="font-mono text-xs text-zinc-400">
              {(elapsedMs / 1000).toFixed(1)}s
            </span>
          </div>

          {/* Cycling message */}
          <p
            key={`${phase}-${msgIndex}`}
            className="text-center text-xs text-zinc-500 dark:text-zinc-400 animate-fade-in"
          >
            {messages[msgIndex]}
          </p>
        </div>

        {/* Reasoning preview */}
        {reasoningPreview && (
          <div className="mt-1 max-h-32 w-full max-w-xs overflow-hidden rounded-xl border border-violet-200/60 bg-violet-50/60 px-3 py-2 dark:border-violet-500/20 dark:bg-violet-500/5">
            <div className="mb-1 flex items-center gap-1.5">
              <Brain className="h-3 w-3 text-violet-500" />
              <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400">AI 思考过程</span>
            </div>
            <p className="line-clamp-4 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {reasoningPreview}
            </p>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3].map((i) => {
            const phaseIndex = phase === "connecting" ? 0 : phase === "waiting" ? 1 : phase === "thinking" ? 2 : 3;
            return (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500",
                  i === phaseIndex
                    ? "w-6 bg-zinc-700 dark:bg-zinc-200"
                    : i < phaseIndex
                    ? "w-1.5 bg-zinc-400 dark:bg-zinc-500"
                    : "w-1.5 bg-zinc-300 dark:bg-zinc-600"
                )}
              />
            );
          })}
        </div>
      </div>
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
  configs,
  activeConfigId,
  onAddConfig,
  onRemoveConfig,
  onRenameConfig,
  onActivateConfig,
}: {
  onClose: () => void;
  value: AppSettings;
  onChange: (s: AppSettings) => void;
  configs: ModelConfig[];
  activeConfigId: string | null;
  onAddConfig: (input: {
    name: string;
    baseUrl: string;
    model: string;
    apiKey: string;
  }) => void;
  onRemoveConfig: (id: string) => void;
  onRenameConfig: (id: string, name: string) => void;
  onActivateConfig: (id: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [show, setShow] = useState(false);
  type TestState =
    | { kind: "idle" }
    | { kind: "testing" }
    | { kind: "ok"; latencyMs: number; sample?: string }
    | { kind: "err"; message: string };
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });

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
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900">
        <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-2">
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

        <div className="flex-1 overflow-y-auto px-6 pb-6">

        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          兼容任何 OpenAI 协议接口:OpenAI、DeepSeek、OpenRouter、Ollama(本地)等。
          Key 仅保存在你的浏览器 localStorage,不会上传服务器。
        </p>

        <Field
          label="Base URL"
          value={draft.baseUrl}
          onChange={(v) => setDraft({ ...draft, baseUrl: v })}
          placeholder="https://api.openai.com/v1"
          hint="支持任意 OpenAI 兼容服务,例:商汤日日新 /token.sensenova.cn/v1、Minimax、硅基智能等"
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            快速预设
          </label>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
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
            <button
              type="button"
              onClick={() => {
                setDraft({ ...draft, baseUrl: "", model: "" });
              }}
              className="rounded-full border border-dashed border-zinc-300 bg-transparent px-3 py-1 text-xs text-zinc-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-rose-400/40 dark:hover:text-rose-300"
            >
              + Custom
            </button>
          </div>
        </div>

        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              我的配置
              <span className="ml-1.5 text-[10px] font-normal text-zinc-400">
                (含 API Key)
              </span>
            </label>
            <button
              type="button"
              onClick={saveCurrentAsConfig}
              className="text-[11px] text-rose-600 hover:underline dark:text-rose-400"
            >
              + 保存当前为新配置
            </button>
          </div>
          {configs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-2.5 text-[11px] text-zinc-400 dark:border-zinc-800">
              还没保存任何配置。填好下面三项,点「保存当前为新配置」即可。
            </p>
          ) : (
            <ul className="space-y-1.5">
              {configs.map((c) => {
                const active = c.id === activeConfigId;
                return (
                  <li
                    key={c.id}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs transition",
                      active
                        ? "border-rose-300 bg-rose-50/60 dark:border-rose-400/40 dark:bg-rose-500/10"
                        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "truncate font-medium",
                            active
                              ? "text-rose-700 dark:text-rose-300"
                              : "text-zinc-800 dark:text-zinc-100",
                          )}
                          title={c.name}
                        >
                          {c.name}
                        </span>
                        {active && (
                          <span className="rounded-full bg-rose-500 px-1.5 py-px text-[9px] font-semibold text-white">
                            当前
                          </span>
                        )}
                      </div>
                      <div
                        className="truncate text-[10px] text-zinc-400"
                        title={`${c.baseUrl} · ${c.model}`}
                      >
                        {c.baseUrl} · {c.model}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          apiKey: c.apiKey,
                          baseUrl: c.baseUrl,
                          model: c.model,
                        });
                        onActivateConfig(c.id);
                      }}
                      className="shrink-0 rounded-md px-1.5 py-0.5 text-zinc-500 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/20"
                      title="加载到此表单并设为当前"
                    >
                      使用
                    </button>
                    <button
                      type="button"
                      onClick={() => renameConfigPrompt(c.id, c.name)}
                      className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                      title="重命名"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`删除配置「${c.name}」?`))
                          onRemoveConfig(c.id);
                      }}
                      className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-rose-100 hover:text-rose-500 dark:hover:bg-rose-500/20"
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
        <Field
          label="Model"
          value={draft.model}
          onChange={(v) => setDraft({ ...draft, model: v })}
          placeholder="deepseek-v4-flash"
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
      {hint && <p className="mt-1 text-[11px] text-zinc-400">{hint}</p>}
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
