import { useState, type FormEvent } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { authClient, authEnabled, persistSessionToken } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/login")({ component: Login });

function authErrorText(err: { message?: string; status?: number; code?: string } | null, fallback: string) {
  if (!err) return fallback;
  const bits = [err.status ? String(err.status) : "", err.code ?? "", err.message ?? ""].filter(Boolean);
  return bits.join(" · ") || fallback;
}

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"in" | "up" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isPending && user) return <Navigate to="/admin/settings" />;

  async function submit(mode: "in" | "up", e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(mode);
    try {
      if (mode === "up") {
        const { data, error: err } = await authClient.signUp.email({
          email,
          password,
          name: "Оператор",
        });
        if (err) throw new Error(authErrorText(err, "Не удалось создать аккаунт"));
        if (data?.token) persistSessionToken(data.token);
      } else {
        const { data, error: err } = await authClient.signIn.email({
          email,
          password,
        });
        if (err) throw new Error(authErrorText(err, "Неверный email или пароль"));
        if (data?.token) persistSessionToken(data.token);
      }
      window.location.assign("/admin/settings");
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
          Первый раз — нажмите «Создать аккаунт». Это новый пароль для All Servis, не пароль Gmail.
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
              <Button
                type="button"
                disabled={busy !== null}
                onClick={(e) => void submit("up", e)}
              >
                {busy === "up" ? "Создаю…" : "Создать аккаунт оператора"}
              </Button>
              <Button type="submit" variant="outline" disabled={busy !== null}>
                {busy === "in" ? "Вхожу…" : "Войти"}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted">Вход выключен.</p>
        )}
      </div>
    </main>
  );
}
