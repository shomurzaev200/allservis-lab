import { createFileRoute } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-fg">
      <div className="glass-card w-full max-w-sm space-y-4 rounded-xl p-6">
        <p className="font-display text-xs tracking-[0.2em] text-accent">ALL SERVIS</p>
        <h1 className="font-display text-2xl font-medium">Вход администратора</h1>
        <p className="text-sm text-muted">Только авторизованный оператор видит заявки, карту и парк мастеров.</p>
        {authEnabled ? (
          GROK_PROVIDERS.map((p) => (
            <button
              key={p.providerId}
              type="button"
              onClick={() => signIn(p.providerId, { callbackURL: "/admin" })}
              className="h-11 w-full rounded-md bg-accent text-sm font-medium text-primary-fg"
            >
              Войти через {p.label}
            </button>
          ))
        ) : (
          <p className="text-sm text-muted">Вход выключен.</p>
        )}
      </div>
    </main>
  );
}
