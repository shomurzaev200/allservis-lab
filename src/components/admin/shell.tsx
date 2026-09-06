import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  ClipboardList,
  LayoutDashboard,
  Map,
  Menu,
  MessageCircle,
  ScrollText,
  Settings,
  Star,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { listNotifications } from "@/lib/server/api";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  search?: Record<string, string>;
  children?: { to: string; label: string; search?: Record<string, string> }[];
};

const NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  {
    to: "/admin/orders",
    label: "Заявки",
    icon: ClipboardList,
    children: [
      { to: "/admin/orders", label: "Все", search: { status: "all" } },
      { to: "/admin/orders", label: "Ожидают", search: { status: "waiting" } },
      { to: "/admin/orders", label: "Назначенные", search: { status: "assigned" } },
      { to: "/admin/orders", label: "В работе", search: { status: "work" } },
      { to: "/admin/orders", label: "Завершённые", search: { status: "completed" } },
    ],
  },
  {
    to: "/admin/masters",
    label: "Мастера",
    icon: Wrench,
    children: [
      { to: "/admin/masters", label: "Все" },
      { to: "/admin/masters", label: "Онлайн", search: { filter: "online" } },
      { to: "/admin/masters", label: "Занятые", search: { filter: "busy" } },
      { to: "/admin/masters", label: "Рейтинг", search: { filter: "rating" } },
    ],
  },
  { to: "/admin/clients", label: "Клиенты", icon: Users },
  { to: "/admin/map", label: "Карта", icon: Map },
  { to: "/admin/analytics", label: "Аналитика", icon: LayoutDashboard },
  { to: "/admin/finance", label: "Финансы", icon: Wallet },
  { to: "/admin/reviews", label: "Отзывы", icon: Star },
  { to: "/admin/notifications", label: "Уведомления", icon: Bell },
  { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { to: "/admin/settings", label: "Настройки", icon: Settings },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const [open, setOpen] = useState(false);
  const notes = useQuery({ queryKey: ["notifications"], queryFn: () => listNotifications() });
  const unread = (notes.data ?? []).filter((n) => n.kind === "admin" && !n.read).length;

  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-border bg-surface/95 p-4 backdrop-blur-md transition-transform duration-200 md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <Link to="/admin" className="font-display text-lg font-semibold tracking-tight text-accent">
            ALL SERVIS
          </Link>
          <button type="button" className="size-10 md:hidden" onClick={() => setOpen(false)} aria-label="Закрыть">
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
            return (
              <div key={item.to + item.label}>
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-150",
                    active ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <item.icon className="size-4" />
                  <span className="flex-1">{item.label}</span>
                  {item.to === "/admin/notifications" && unread > 0 ? (
                    <span className="rounded-full bg-danger px-1.5 font-mono text-[10px] text-fg">{unread}</span>
                  ) : null}
                </Link>
                {item.children && active ? (
                  <div className="mb-1 ml-6 mt-1 flex flex-col gap-0.5 border-l border-border pl-2">
                    {item.children.map((ch) => {
                      const qs = ch.search ? new URLSearchParams(ch.search).toString() : "";
                      const childActive = qs ? searchStr.includes(qs) : searchStr === "" || searchStr === "?status=all";
                      return (
                        <Link
                          key={ch.label}
                          to={ch.to}
                          search={ch.search}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex min-h-9 items-center rounded-md px-2 text-xs",
                            childActive ? "text-accent" : "text-subtle hover:text-fg",
                          )}
                        >
                          {ch.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="mt-4 space-y-1 border-t border-border pt-3">
          <Link
            to="/"
            className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted hover:text-fg"
          >
            <MessageCircle className="size-4" />
            Telegram-бот
          </Link>
          <Link
            to="/master"
            className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted hover:text-fg"
          >
            <Wrench className="size-4" />
            Кабинет мастера
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-md">
          <button type="button" className="size-11 md:hidden" onClick={() => setOpen(true)} aria-label="Меню">
            <Menu className="size-5" />
          </button>
          <p className="hidden text-sm text-muted md:block">Клиент → заявка → администратор → мастер</p>
          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/admin/notifications"
              className="relative flex size-11 items-center justify-center text-muted hover:text-accent"
            >
              <Bell className="size-5" />
              {unread > 0 ? (
                <span className="absolute right-2 top-2 size-2 rounded-full bg-danger" />
              ) : null}
            </Link>
            <UserButton />
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
