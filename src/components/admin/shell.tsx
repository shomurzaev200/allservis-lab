import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, ClipboardList, CreditCard, LayoutDashboard, Map, Menu, ScrollText, Settings, Share2, Star, Target, Users, Wallet, Wrench, X } from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { cn } from "@/lib/utils";
import { getDashboard } from "@/lib/server/api";
import { useAccess, type PermKey } from "./access";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; perm?: PermKey; group: string }[] = [
  { group: "Работа", to: "/admin", label: "Сейчас", icon: LayoutDashboard },
  { group: "Работа", to: "/admin/orders", label: "Заявки", icon: ClipboardList },
  { group: "Работа", to: "/admin/masters", label: "Мастера", icon: Wrench },
  { group: "Работа", to: "/admin/map", label: "Карта", icon: Map },
  { group: "Люди", to: "/admin/people", label: "Кто нажал /start", icon: Users },
  { group: "Люди", to: "/admin/clients", label: "Клиенты", icon: Users },
  { group: "Люди", to: "/admin/reviews", label: "Отзывы", icon: Star },
  { group: "Рост", to: "/admin/analytics", label: "Аналитика", icon: LayoutDashboard },
  { group: "Рост", to: "/admin/targetolog", label: "Таргетолог", icon: Target },
  { group: "Рост", to: "/admin/refs", label: "Рефералы", icon: Share2 },
  { group: "Деньги", to: "/admin/finance", label: "Финансы", icon: Wallet, perm: "finance" },
  { group: "Деньги", to: "/admin/payments", label: "Пополнения", icon: CreditCard, perm: "finance" },
  { group: "Сервис", to: "/admin/notifications", label: "Уведомления", icon: Bell },
  { group: "Сервис", to: "/admin/team", label: "Команда", icon: Users, perm: "invite" },
  { group: "Сервис", to: "/admin/settings", label: "Настройки · боты", icon: Settings, perm: "bots" },
  { group: "Сервис", to: "/admin/audit", label: "Журнал", icon: ScrollText },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const access = useAccess();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard(), refetchInterval: 20_000 });
  const waiting = dash.data?.orders.waiting ?? 0;
  const items = NAV.filter((item) => !item.perm || access.allowed(item.perm));
  const groups = [...new Set(items.map((item) => item.group))];
  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      <aside className={cn("fixed inset-y-0 left-0 z-30 w-60 overflow-y-auto border-r border-border bg-surface/95 p-4 backdrop-blur-md transition-transform duration-200 md:static md:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="mb-4 flex items-center justify-between">
          <Link to="/admin" className="font-display text-lg font-semibold tracking-tight text-accent">ALL SERVIS</Link>
          <button type="button" className="size-10 md:hidden" onClick={() => setOpen(false)} aria-label="Закрыть"><X className="size-5" /></button>
        </div>
        <nav className="flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group}>
              <p className="px-3 pb-1 text-[10px] uppercase tracking-wider text-subtle">{group}</p>
              <div className="flex flex-col gap-0.5">
                {items.filter((item) => item.group === group).map((item) => {
                  const active = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
                  return (
                    <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
                      className={cn("flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium", active ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface-2 hover:text-fg")}>
                      <item.icon className="size-4" />
                      <span className="flex-1">{item.label}</span>
                      {item.to === "/admin/orders" && waiting > 0 ? (
                        <span className="rounded-full bg-warn px-1.5 text-[11px] font-semibold text-primary-fg">{waiting}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-6 border-t border-border pt-4">
          <p className="px-3 text-xs text-subtle">
            {access.owner ? "владелец · все права" : `админ · ${[
              access.allowed("invite") ? "приглашать" : null,
              access.allowed("delete") ? "удалять" : null,
              access.allowed("assign") ? "назначать" : null,
              access.allowed("finance") ? "пополнения" : null,
              access.allowed("bots") ? "боты" : null,
            ].filter(Boolean).join(" · ") || "без доп. прав"}`}
          </p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-md">
          <button type="button" className="size-11 md:hidden" onClick={() => setOpen(true)} aria-label="Меню"><Menu className="size-5" /></button>
          <p className="hidden text-sm text-muted md:block">
            {waiting > 0 ? `${waiting} заявок ждут назначения` : "Новых заявок нет"}
            {dash.data?.bot.connected ? ` · @${dash.data.bot.username}` : " · бот не подключён"}
          </p>
          <div className="ml-auto flex items-center gap-3"><UserButton /></div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}