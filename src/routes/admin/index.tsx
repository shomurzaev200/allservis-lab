import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/server/api";
import { OrderBadge } from "@/components/admin/status-badge";
import { Kpi, SectionTitle } from "@/components/admin/kpi";
import { formatSum } from "@/lib/domain";
import { serviceById } from "@/lib/catalog";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

function tel(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.length >= 7 ? `tel:${digits}` : "";
}

function Dashboard() {
  const { data, isPending, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    refetchInterval: 15_000,
  });

  if (isError) {
    return (
      <div className="p-6">
        <p className="text-sm text-danger">Дашборд не загрузился. Обновите страницу — после рестарта сервера миграции уже применены.</p>
        <button type="button" className="mt-3 text-sm text-accent" onClick={() => void refetch()}>Обновить</button>
      </div>
    );
  }

  if (isPending || !data) {
    return (
      <div className="grid gap-4 p-6 md:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-2" />
        ))}
      </div>
    );
  }

  const waiting = data.orders.waiting;
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-accent">All Servis</p>
          <h1 className="mt-1 font-display text-2xl">Сейчас в работе</h1>
          <p className="mt-1 text-sm text-muted">
            {waiting > 0 ? `${waiting} заявок ждут назначения. Старые сверху.` : "Новых заявок нет."}
            {data.bot.connected ? ` Бот @${data.bot.username} на связи.` : " Бот не подключён."}
          </p>
        </div>
        <p className="text-xs text-subtle">обновлено {new Date(dataUpdatedAt).toLocaleTimeString("ru")}</p>
      </div>

      {!data.bot.connected ? (
        <Link to="/admin/settings" className="block rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          Бот заявок не подключён. Откройте настройки и вставьте токен.
        </Link>
      ) : null}

      <section className="glass-card rounded-xl p-4">
        <SectionTitle
          extra={<Link to="/admin/orders" search={{ status: "waiting" }} className="text-sm text-accent">Все ожидающие</Link>}
        >
          Назначить мастера
        </SectionTitle>
        {data.queue.length === 0 ? (
          <p className="py-6 text-center text-sm text-subtle">Очередь пустая.</p>
        ) : (
          <div className="space-y-2">
            {data.queue.map((o) => {
              const href = tel(o.phone);
              return (
                <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-subtle">№{o.public_no} · {new Date(o.created_at).toLocaleString("ru")}</p>
                    <p className="truncate text-sm">{o.client_name} · {serviceById(o.category_slug)?.title ?? o.category_slug}</p>
                    <p className="text-xs text-muted">{o.district || "район не указан"}{o.phone ? ` · ${o.phone}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <OrderBadge status={o.status} />
                    {href ? <a className="text-sm text-accent" href={href}>Позвонить</a> : null}
                    <Link to="/admin/orders/$id" params={{ id: String(o.id) }} className="text-sm text-accent">Открыть</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ждут вас" value={waiting} hint={`назначены ${data.orders.assigned} · в работе ${data.orders.work}`} tone={waiting ? "warn" : "ok"} />
        <Kpi label="Мастера" value={data.masters.online} hint={`заняты ${data.masters.busy} · офлайн ${data.masters.offline} · всего ${data.masters.total}`} tone="ok" />
        <Kpi label="Заявки сегодня" value={data.orders.today} hint={`неделя ${data.orders.week} · клиенты ${data.clients.active}`} tone="accent" />
        <Kpi label="Выручка сегодня" value={formatSum(Number(data.finance.today))} hint={`средний чек ${formatSum(Number(data.finance.avg))}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="glass-card rounded-xl p-4">
          <SectionTitle extra={<Link to="/admin/orders" className="text-sm text-accent">Все</Link>}>Последние заявки</SectionTitle>
          <div className="space-y-2">
            {data.recent.map((o) => (
              <Link key={o.id} to="/admin/orders/$id" params={{ id: String(o.id) }} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-3 transition-colors hover:bg-border">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-subtle">№{o.public_no}</p>
                  <p className="truncate text-sm">{o.client_name} · {serviceById(o.category_slug)?.title}</p>
                </div>
                <OrderBadge status={o.status} />
              </Link>
            ))}
          </div>
        </section>
        <section className="glass-card rounded-xl p-4">
          <SectionTitle extra={<Link to="/admin/notifications" className="text-sm text-accent">Лента</Link>}>Уведомления</SectionTitle>
          <div className="space-y-2">
            {data.notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-subtle">Пока тихо</p>
            ) : (
              data.notifications.map((n) => (
                <article key={n.id} className="rounded-lg bg-surface-2 px-3 py-2">
                  <p className="text-sm">{n.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{n.body}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}