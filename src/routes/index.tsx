import { createFileRoute, Link } from "@tanstack/react-router";
import { Droplets, KeyRound, Paintbrush, Sofa, Wind, Wrench, Zap } from "lucide-react";
import { TelegramPhone } from "@/components/telegram/chat";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { SERVICES } from "@/lib/catalog";
import { formatSum } from "@/lib/domain";
import type { ServiceId } from "@/lib/catalog";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/")({ component: Home });

const ICONS: Record<ServiceId, LucideIcon> = {
  plumb: Droplets,
  elec: Zap,
  ac: Wind,
  appliance: Wrench,
  furniture: Sofa,
  lock: KeyRound,
  paint: Paintbrush,
  other: Wrench,
};

function Home() {
  const { user, isPending } = useCurrentUserState();
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <span className="font-display text-lg font-semibold text-accent">All Servis</span>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin">Админка</Link>
          </Button>
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
            <Link to="/master">Мастер</Link>
          </Button>
          {isPending ? (
            <span className="h-8 w-20 animate-pulse rounded-md bg-surface-2" />
          ) : user ? (
            <UserButton />
          ) : (
            <Button size="sm" asChild>
              <Link to="/login">Войти</Link>
            </Button>
          )}
        </nav>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-5 lg:grid lg:grid-cols-[1fr_24rem] lg:items-start lg:gap-10 lg:py-8">
        <div className="lg:order-2">
          <TelegramPhone />
        </div>
        <section className="space-y-5 lg:order-1">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-accent">Telegram-бот · Ташкент</p>
            <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Вызов мастера</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
              Клиент создаёт заявку. Она сразу появляется у администратора. Система сама мастера не выбирает —
              назначение только вручную.
            </p>
          </div>
          <ol className="grid grid-cols-2 gap-2 text-sm">
            <li className="rounded-lg bg-surface px-3 py-3 shadow-[var(--shadow-border)]">1. Клиент описывает задачу</li>
            <li className="rounded-lg bg-surface px-3 py-3 shadow-[var(--shadow-border)]">2. Заявка ждёт администратора</li>
            <li className="rounded-lg bg-surface px-3 py-3 shadow-[var(--shadow-border)]">3. Админ назначает мастера</li>
            <li className="rounded-lg bg-surface px-3 py-3 shadow-[var(--shadow-border)]">4. Мастер принимает или отказывается</li>
          </ol>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SERVICES.map((s) => {
              const Icon = ICONS[s.id];
              return (
                <div key={s.id} className="rounded-lg bg-surface-2 px-3 py-3">
                  <Icon className="size-4 text-accent" />
                  <p className="mt-2 text-sm font-medium">{s.title}</p>
                  <p className="mt-1 font-mono text-xs text-muted">от {formatSum(s.from)}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
