"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wand2, Eye, EyeOff, UserPlus, AlertCircle, Loader2, Sparkles } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data.loggedIn) {
          router.replace("/");
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "注册失败");
        return;
      }
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok || !loginData.ok) {
        router.replace("/login");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <div className="aurora-bg"><div className="blob-3" /></div>
        <Loader2 className="relative h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-stone-50 px-4 py-10 dark:bg-zinc-950">
      <div className="aurora-bg"><div className="blob-3" /></div>

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-amber-500 text-white shadow-lg shadow-rose-500/25">
            <Wand2 className="h-6 w-6" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
            创建 <span className="text-gradient">Emojigen</span> 账号
          </h1>
          <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">
            注册即可使用全部模型
          </p>
        </div>

        <form onSubmit={onSubmit} className="glass-card space-y-4 p-6">
          <div>
            <label htmlFor="username" className="mb-1.5 block text-xs font-semibold text-stone-700 dark:text-stone-300">
              用户名
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={2}
              maxLength={24}
              required
              className="w-full rounded-xl border border-stone-200 bg-white/90 px-3.5 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-rose-400 focus:ring-4 focus:ring-rose-100 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-stone-100 dark:placeholder:text-zinc-500 dark:focus:border-rose-400 dark:focus:ring-rose-500/10"
              placeholder="2-24 位字符"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-stone-700 dark:text-stone-300">
              密码
            </label>
            <div className="relative">
              <input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                className="w-full rounded-xl border border-stone-200 bg-white/90 px-3.5 py-2.5 pr-10 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-rose-400 focus:ring-4 focus:ring-rose-100 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-stone-100 dark:placeholder:text-zinc-500 dark:focus:border-rose-400 dark:focus:ring-rose-500/10"
                placeholder="至少 6 位"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                tabIndex={-1}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-xs font-semibold text-stone-700 dark:text-stone-300">
              确认密码
            </label>
            <input
              id="confirm"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              required
              className="w-full rounded-xl border border-stone-200 bg-white/90 px-3.5 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-rose-400 focus:ring-4 focus:ring-rose-100 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-stone-100 dark:placeholder:text-zinc-500 dark:focus:border-rose-400 dark:focus:ring-rose-500/10"
              placeholder="再输入一次"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-rose-200/80 bg-rose-50/80 p-2.5 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            创建账号并登录
          </button>

          <p className="text-center text-xs text-stone-500 dark:text-zinc-400">
            已有账号？
            <Link href="/login" className="ml-1 font-semibold text-rose-600 hover:underline dark:text-rose-400">
              立即登录
            </Link>
          </p>
        </form>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-stone-200/60 bg-white/50 p-2.5 text-[11px] text-stone-500 backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-500">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>注册后立即可用 deepseek-v4-flash 等高级模型</span>
        </div>
      </div>
    </div>
  );
}
