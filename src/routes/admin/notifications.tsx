import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listNotifications, markNotificationsRead } from "@/lib/server/api";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const qc = useQueryClient();
  const { data = [], isPending } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
  });
  const read = useMutation({
    mutationFn: (ids?: number[]) => markNotificationsRead({ data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const unread = data.filter((n) => !n.read).length;
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Уведомления</h1>
          <p className="text-sm text-muted">{unread ? `${unread} непрочитанных` : "Новых нет"}</p>
        </div>
        <Button variant="outline" disabled={!unread || read.isPending} onClick={() => read.mutate(undefined)}>Прочитать все</Button>
      </div>
      {isPending ? <p className="text-sm text-muted">Загрузка…</p> : null}
      <div className="space-y-2">
        {data.map((n) => (
          <article key={n.id} className={`glass-card rounded-xl p-4 ${n.read ? "opacity-70" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-subtle">{n.kind}{n.read ? "" : " · новое"}</p>
                <h2 className="mt-1 font-medium">{n.title}</h2>
                <p className="mt-1 text-sm text-muted">{n.body}</p>
              </div>
              <time className="shrink-0 font-mono text-xs text-subtle">
                {new Date(n.created_at).toLocaleString("ru-RU")}
              </time>
            </div>
            <div className="mt-3 flex gap-3">
              {n.order_id ? (
                <Link to="/admin/orders/$id" params={{ id: String(n.order_id) }} className="text-sm text-accent">
                  Открыть заявку
                </Link>
              ) : null}
              {!n.read ? (
                <button type="button" className="text-sm text-muted" onClick={() => read.mutate([n.id])}>Прочитано</button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}