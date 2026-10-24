import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, ClipboardList, CreditCard, LayoutDashboard, Map, Menu, MessageCircle, ScrollText, Settings, Share2, Star, Target, Users, Wallet, Wrench, X } from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { cn } from "@/lib/utils";
import { useAccess, type PermKey } from "./access";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; perm?: PermKey }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/orders", label: "Заявки", icon: ClipboardList },
  { to: "/admin/masters", label: "Мастера", icon: Wrench },
  { to: "/admin/clients", label: "Клиенты", icon: Users },
  { to: "/admin/people", label: "Кто нажал /start", icon: Users },
  { to: "/admin/map", label: "Карта", icon: Map },
  { to: "/admin/analytics", label: "Аналитика", icon: LayoutDashboard },
  { to: "/admin/targetolog", label: "Таргетолог", icon: Target },
  { to: "/admin/refs", label: "Рефералы", icon: Share2 },
  { to: "/admin/finance", label: "Финансы", icon: Wallet, perm: "finance" },
  { to: "/admin/payments", label: "Пополнения", icon: CreditCard, perm: "finance" },
  { to: "/admin/reviews", label: "Отзывы", icon: Star },
  { to: "/admin/notifications", label: "Уведомления", icon: Bell },
  { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { to: "/admin/team", label: "Команда", icon: Users, perm: "invite" },
  { to: "/admin/settings", label: "Настройки · боты", icon: Settings, perm: "bots" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const access = useAccess();
  const items = NAV.filter((item) => !item.perm || access.allowed(item.perm));
  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      <aside className={cn("fixed inset-y-0 left-0 z-30 w-60 border-r border-border bg-surface/95 p-4 backdrop-blur-md transition-transform duration-200 md:static md:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="mb-6 flex items-center justify-between">
          <Link to="/admin" className="font-display text-lg font-semibold tracking-tight text-accent">ALL SERVIS</Link>
          <button type="button" className="size-10 md:hidden" onClick={() => setOpen(false)} aria-label="Закрыть"><X className="size-5" /></button>
        </div>
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const active = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
            return (
              <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
                className={cn("flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium", active ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface-2 hover:text-fg")}>
                <item.icon className="size-4" />{item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 space-y-2 border-t border-border pt-4">
          <p className="px-3 text-xs text-subtle">
            {access.owner ? "владелец · все права" : `админ · ${[
              access.allowed("invite") ? "приглашать" : null,
              access.allowed("delete") ? "удалять" : null,
              access.allowed("assign") ? "назначать" : null,
              access.allowed("finance") ? "пополнения" : null,
              access.allowed("bots") ? "боты/настройки" : null,
            ].filter(Boolean).join(" · ") || "без доп. прав"}`}
          </p>
          <Link to="/" className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted hover:text-fg"><MessageCircle className="size-4" />Telegram-бот (демо)</Link>
          <Link to="/master" className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted hover:text-fg"><Wrench className="size-4" />Кабинет мастера</Link>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-md">
          <button type="button" className="size-11 md:hidden" onClick={() => setOpen(true)} aria-label="Меню"><Menu className="size-5" /></button>
          <p className="hidden text-sm text-muted md:block">Токен бота — в Настройках. Назначение мастера только вручную.</p>
          <div className="ml-auto flex items-center gap-3"><UserButton /></div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
