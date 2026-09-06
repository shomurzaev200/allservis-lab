import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listNotifications } from "@/lib/server/api";

export const Route = createFileRoute("/admin/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const { data = [], isPending } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
  });
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl">Уведомления</h1>
        <p className="text-sm text-muted">Новые заявки, отказы мастеров, смена статусов.</p>
      </div>
      {isPending ? <p className="text-sm text-muted">Загрузка…</p> : null}
      <div className="space-y-2">
        {data.map((n) => (
          <article key={n.id} className="glass-card rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-subtle">{n.kind}</p>
                <h2 className="mt-1 font-medium">{n.title}</h2>
                <p className="mt-1 text-sm text-muted">{n.body}</p>
              </div>
              <time className="shrink-0 font-mono text-xs text-subtle">
                {new Date(n.created_at).toLocaleString("ru-RU")}
              </time>
            </div>
            {n.order_id ? (
              <Link
                to="/admin/orders/$id"
                params={{ id: String(n.order_id) }}
                className="mt-3 inline-block text-sm text-accent"
              >
                Открыть заявку
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
