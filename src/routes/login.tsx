import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"in" | "up" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(mode: "in" | "up", e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(mode);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: "Оператор",
          callbackURL: "/admin/settings",
        });
        if (err) throw new Error(err.message || "Не удалось создать аккаунт");
      } else {
        const { error: err } = await authClient.signIn.email({
          email,
          password,
          callbackURL: "/admin/settings",
        });
        if (err) throw new Error(err.message || "Неверный email или пароль");
      }
      window.location.href = "/admin/settings";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-fg">
      <div className="glass-card w-full max-w-sm space-y-4 rounded-xl p-6">
        <p className="font-display text-xs tracking-[0.2em] text-accent">ALL SERVIS</p>
        <h1 className="font-display text-2xl font-medium">Вход администратора</h1>
        <p className="text-sm text-muted">
          На своём сервере войдите email + пароль. После входа: Админка → Настройки → токен от @BotFather.
        </p>

        {authEnabled ? (
          <form className="space-y-3" onSubmit={(e) => void submit("in", e)}>
            <label className="block text-sm">
              <span className="text-muted">Email</span>
              <Input
                className="mt-1"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">Пароль (минимум 8 символов)</span>
              <Input
                className="mt-1"
                type="password"
                autoComplete="current-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={busy !== null}>
                {busy === "in" ? "Вхожу…" : "Войти"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={(e) => void submit("up", e)}
              >
                {busy === "up" ? "Создаю…" : "Создать аккаунт оператора"}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted">Вход выключен.</p>
        )}

        {authEnabled ? (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs text-subtle">Google / X работают только на опубликованном Grok-сайте, не на своём VPS.</p>
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/admin/settings" })}
                className="h-11 w-full rounded-md bg-surface-2 text-sm font-medium text-muted ring-1 ring-border"
              >
                Войти через {p.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
