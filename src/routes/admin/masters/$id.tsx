import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMaster } from "@/lib/server/api";
import { OnlineDot, OrderBadge } from "@/components/admin/status-badge";
import { serviceById } from "@/lib/catalog";
import { formatSum } from "@/lib/domain";
import { Kpi } from "@/components/admin/kpi";

export const Route = createFileRoute("/admin/masters/$id")({ component: MasterCard });

function MasterCard() {
  const { id } = Route.useParams();
  const { data, isPending } = useQuery({
    queryKey: ["master", id],
    queryFn: () => getMaster({ data: Number(id) }),
  });
  if (isPending || !data?.master) return <p className="p-6 text-sm text-muted">Загрузка…</p>;
  const m = data.master;
  const accept = m.accepted_orders + m.rejected_orders;
  const rate = accept ? Math.round((m.accepted_orders / accept) * 100) : 0;
  const rej = accept ? Math.round((m.rejected_orders / accept) * 100) : 0;
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl">
            {m.first_name} {m.last_name}
          </h1>
          <p className="text-sm text-muted">
            {serviceById(m.specialization)?.title} · {m.city} · {m.district}
          </p>
          <p className="mt-1 font-mono text-xs text-subtle">
            TG {m.telegram_id} · {m.phone}
          </p>
        </div>
        <OnlineDot status={m.online_status} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Рейтинг" value={m.rating.toFixed(2)} tone="accent" />
        <Kpi label="Завершено" value={m.completed_orders} />
        <Kpi label="Принятие" value={`${rate}%`} hint={`отказы ${rej}%`} tone="ok" />
        <Kpi label="Заработок" value={formatSum(m.earnings)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Активных" value={m.active_orders} tone="warn" />
        <Kpi label="Среднее время" value={`${m.avg_minutes} мин`} />
        <Kpi label="Отмены" value={m.cancelled_orders} />
      </div>
      <p className="text-xs text-muted">
        Last seen: {new Date(m.last_seen).toLocaleString("ru-RU")} · регистрация{" "}
        {new Date(m.registered_at).toLocaleDateString("ru-RU")}
        {m.lat != null && m.lng != null ? ` · ${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}` : ""}
      </p>
      <section>
        <h2 className="mb-2 text-sm text-muted">История заказов</h2>
        <div className="space-y-2">
          {data.orders.map((o) => (
            <Link
              key={o.id}
              to="/admin/orders/$id"
              params={{ id: String(o.id) }}
              className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 hover:bg-surface-2"
            >
              <span className="text-sm">
                №{o.public_no} · {o.client_name}
              </span>
              <OrderBadge status={o.status} />
            </Link>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm text-muted">Отзывы</h2>
        <div className="space-y-2">
          {data.reviews.length === 0 ? <p className="text-sm text-subtle">Пока нет оценок</p> : null}
          {data.reviews.map((r) => (
            <article key={r.id} className="rounded-lg bg-surface px-3 py-2">
              <p className="text-sm">
                {r.rating}/5 · {r.client_name || "клиент"} · №{r.public_no}
              </p>
              <p className="text-xs text-muted">{r.comment}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
