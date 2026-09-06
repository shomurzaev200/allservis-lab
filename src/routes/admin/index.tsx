import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { getDashboard } from "@/lib/server/api";
import { OrderBadge } from "@/components/admin/status-badge";
import { Kpi, SectionTitle } from "@/components/admin/kpi";
import { formatSum } from "@/lib/domain";
import { serviceById } from "@/lib/catalog";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

function Dashboard() {
  const { data, isPending } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
  });

  if (isPending || !data) {
    return (
      <div className="grid gap-4 p-6 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-accent">All Servis Admin</p>
        <h1 className="mt-1 font-display text-2xl">Диспетчерская</h1>
        <p className="mt-1 text-sm text-muted">Автоназначения нет. Каждую заявку закрывает оператор.</p>
      </div>

      <ol className="grid gap-2 sm:grid-cols-4">
        {[
          ["Клиент", "Создаёт заявку в боте"],
          ["Заявка", `${data.orders.waiting} ждут вас`],
          ["Администратор", "Выбирает мастера вручную"],
          ["Мастер", "Принимает или отказывается"],
        ].map(([t, d], i) => (
          <li key={t} className="glass-card relative rounded-xl p-4">
            <p className="font-mono text-xs text-accent">0{i + 1}</p>
            <p className="mt-1 font-medium">{t}</p>
            <p className="mt-1 text-xs text-muted">{d}</p>
            {i < 3 ? (
              <ArrowRight className="absolute -right-2 top-1/2 hidden size-4 -translate-y-1/2 text-subtle sm:block" />
            ) : null}
          </li>
        ))}
      </ol>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Мастеров онлайн" value={data.masters.online} hint={`свободны ${data.masters.free} · всего ${data.masters.total}`} tone="ok" />
        <Kpi label="Клиентов" value={data.clients.active} hint={`сегодня +${data.clients.today} · повторные ${data.clients.returning}`} />
        <Kpi label="Заказов сегодня" value={data.orders.today} hint={`неделя ${data.orders.week} · всего ${data.orders.total}`} tone="accent" />
        <Kpi label="Выручка сегодня" value={formatSum(Number(data.finance.today))} hint={`средний чек ${formatSum(Number(data.finance.avg))}`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Online" value={data.masters.online} hint="на линии" tone="ok" />
        <Kpi label="Busy" value={data.masters.busy} hint="есть активный заказ" tone="warn" />
        <Kpi label="Offline" value={data.masters.offline} hint="нет heartbeat 2 мин" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Ожидают назначения" value={data.orders.waiting} tone="warn" />
        <Kpi label="Назначены" value={data.orders.assigned} tone="accent" />
        <Kpi label="В работе" value={data.orders.work} tone="ok" />
        <Kpi label="Завершено" value={data.orders.done} />
        <Kpi label="Отказы / отмены" value={`${data.orders.rejected} / ${data.orders.cancelled}`} tone="danger" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="glass-card rounded-xl p-4">
          <SectionTitle
            extra={
              <Link to="/admin/orders" className="text-sm text-accent">
                Все
              </Link>
            }
          >
            Последние заявки
          </SectionTitle>
          <div className="space-y-2">
            {data.recent.map((o) => (
              <Link
                key={o.id}
                to="/admin/orders/$id"
                params={{ id: String(o.id) }}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-3 transition-colors hover:bg-border"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-subtle">№{o.public_no}</p>
                  <p className="truncate text-sm">
                    {o.client_name} · {serviceById(o.category_slug)?.title}
                  </p>
                </div>
                <OrderBadge status={o.status} />
              </Link>
            ))}
          </div>
        </section>
        <section className="glass-card rounded-xl p-4">
          <SectionTitle
            extra={
              <Link to="/admin/notifications" className="text-sm text-accent">
                Лента
              </Link>
            }
          >
            Уведомления
          </SectionTitle>
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
