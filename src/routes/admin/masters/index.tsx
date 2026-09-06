import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMasters } from "@/lib/server/api";
import { OnlineDot } from "@/components/admin/status-badge";
import { serviceById } from "@/lib/catalog";
import { formatSum } from "@/lib/domain";

type Search = { filter?: string };

export const Route = createFileRoute("/admin/masters/")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    filter: typeof raw.filter === "string" ? raw.filter : "all",
  }),
  component: MastersPage,
});

function MastersPage() {
  const { filter } = Route.useSearch();
  const { data = [], isPending } = useQuery({
    queryKey: ["masters"],
    queryFn: () => listMasters(),
  });

  let list = [...data];
  if (filter === "online") list = list.filter((m) => m.online_status === "online");
  if (filter === "busy") list = list.filter((m) => m.online_status === "busy");
  if (filter === "rating") list.sort((a, b) => b.rating - a.rating);
  const ranked = [...data].sort((a, b) => b.rating - a.rating);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl">Мастера</h1>
        <p className="text-sm text-muted">Heartbeat 2 минуты. Offline не назначается автоматически — решение за вами.</p>
      </div>
      <section>
        <h2 className="mb-3 text-sm text-muted">Рейтинг</h2>
        <ol className="space-y-2">
          {ranked.slice(0, 8).map((m, i) => (
            <li key={m.id} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
              <span className="text-sm">
                {i + 1}. {m.first_name} {m.last_name}
              </span>
              <span className="font-mono text-sm text-accent">{m.rating.toFixed(2)}</span>
            </li>
          ))}
        </ol>
      </section>
      {isPending ? <p className="text-sm text-muted">Загрузка парка…</p> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((m) => {
          const accept = m.accepted_orders + m.rejected_orders;
          const rate = accept ? Math.round((m.accepted_orders / accept) * 100) : 0;
          const rej = accept ? Math.round((m.rejected_orders / accept) * 100) : 0;
          return (
            <Link
              key={m.id}
              to="/admin/masters/$id"
              params={{ id: String(m.id) }}
              className="glass-card rounded-xl p-4 transition-colors hover:bg-surface-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">
                    {m.first_name} {m.last_name}
                  </h3>
                  <p className="text-xs text-muted">{serviceById(m.specialization)?.title}</p>
                </div>
                <OnlineDot status={m.online_status} />
              </div>
              <p className="mt-3 font-mono text-lg text-accent">{m.rating.toFixed(2)}</p>
              <p className="mt-1 text-xs text-muted">
                {m.completed_orders} заказов · принятие {rate}% · отказы {rej}% · среднее {m.avg_minutes} мин
              </p>
              <p className="mt-1 text-xs text-subtle">
                Активных: {m.active_orders} · {formatSum(m.earnings)}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
