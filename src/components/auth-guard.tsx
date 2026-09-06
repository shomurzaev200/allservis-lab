import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import { getAccess } from "@/lib/server/api";
import { Button } from "@/components/ui/button";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const access = useQuery({
    queryKey: ["access"],
    queryFn: () => getAccess(),
    enabled: Boolean(user),
  });
  if (isPending) {
    return (
      <div className="min-h-dvh bg-bg p-6 text-fg">
        <p className="font-display text-lg text-accent">All Servis Admin</p>
        <p className="mt-2 text-sm text-muted">Загрузка сессии оператора…</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="h-28 animate-pulse rounded-xl bg-surface-2" />
          <div className="h-28 animate-pulse rounded-xl bg-surface-2" />
          <div className="h-28 animate-pulse rounded-xl bg-surface-2" />
        </div>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (access.data && access.data.ok === false) {
    const blocked = access.data.error === "BLOCKED";
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-6 text-fg">
        <div className="glass-card max-w-sm space-y-3 rounded-xl p-6">
          <h1 className="font-display text-xl">{blocked ? "Доступ заблокирован" : "Вас не приглашали"}</h1>
          <p className="text-sm text-muted">
            {blocked
              ? "Владелец отключил этот логин."
              : "Владелец уже есть. «Создать аккаунт» не даёт прав — сотрудника добавляют в разделе Команда (email + пароль)."}
          </p>
          <Button onClick={() => void signOut("/login")}>На страницу входа</Button>
        </div>
      </main>
    );
  }
  return <>{children}</>;
}
