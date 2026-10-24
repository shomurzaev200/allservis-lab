import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelOrder, getOrder } from "@/lib/server/api";
import { AssignDialog } from "@/components/admin/assign-dialog";
import { OnlineDot, OrderBadge } from "@/components/admin/status-badge";
import { useAccess } from "@/components/admin/access";
import { Button } from "@/components/ui/button";
import { serviceById } from "@/lib/catalog";
import { formatSum } from "@/lib/domain";

export const Route = createFileRoute("/admin/orders/$id")({ component: OrderPage });

const EVENT_LABEL: Record<string, string> = {
  created: "Заявка создана",
  geo: "Получена геолокация",
  photos: "Фотографии",
  assigned: "Администратор назначил мастера",
  master_accepted: "Мастер принял заказ",
  master_rejected: "Мастер отказался",
  enroute: "Мастер выехал",
  arrived: "Мастер прибыл",
  started: "Работа начата",
  in_progress: "Работа начата",
  completed: "Работа завершена",
  cancelled: "Отмена",
  reviewed: "Оценка клиента",
};

function OrderPage() {
  const { id } = Route.useParams();
  const orderId = Number(id);
  const qc = useQueryClient();
  const access = useAccess();
  const canAssign = access.allowed("assign");
  const { data, isPending } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder({ data: orderId }),
    refetchInterval: 15_000,
  });
  const [assign, setAssign] = useState(false);
  const cancel = useMutation({
    mutationFn: () => cancelOrder({ data: orderId }),
    onSuccess: () => qc.invalidateQueries(),
  });

  if (isPending || !data?.order) {
    return <p className="p-6 text-sm text-muted">Загрузка заявки…</p>;
  }
  const o = data.order;
  const statusAssign = o.status === "waiting_admin" || o.status === "master_rejected" || o.status === "assigned";
  let photos: string[] = [];
  try {
    const parsed = JSON.parse(o.photos) as unknown;
    if (Array.isArray(parsed)) photos = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    photos = [];
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted">№{o.public_no}</p>
          <h1 className="font-display text-2xl">{o.client_name}</h1>
        </div>
        <OrderBadge status={o.status} />
      </div>
      {cancel.data && "error" in cancel.data && cancel.data.error ? (
        <p className="text-sm text-warn">{String(cancel.data.error)}</p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="glass-card rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted">Клиент</h2>
          <p className="mt-2">{o.client_name}</p>
          <p className="text-sm">
            {o.phone ? <a className="text-accent" href={`tel:${o.phone.replace(/[^\d+]/g, "")}`}>{o.phone}</a> : <span className="text-muted">телефон не указан</span>}
          </p>
          <p className="text-sm text-muted">
            Telegram: {o.client_tg ? (
              <a className="text-accent" href={/^\d+$/.test(o.client_tg) ? `tg://user?id=${o.client_tg}` : `https://t.me/${o.client_tg.replace(/^@/, "")}`}>
                {o.client_tg}
              </a>
            ) : "—"}
          </p>
          <p className="text-sm text-muted">Рейтинг клиента: {(o.client_rating ?? 5).toFixed(1)}</p>
          <p className="text-sm text-muted">Заявок в истории: {data.clientOrders}</p>
        </section>
        <section className="glass-card rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted">Заказ</h2>
          <p className="mt-2">{serviceById(o.category_slug)?.title}</p>
          <p className="mt-1 text-sm leading-relaxed">{o.description}</p>
          {o.comment ? <p className="mt-2 text-sm text-muted">Комментарий: {o.comment}</p> : null}
          <p className="mt-2 text-xs text-muted">
            🏙 {o.city || "Бекабад"}
            <br />
            📍 Район/махалля: {o.district || "не определён"}
            <br />
            🏠 {o.address || "не определён"}
            <br />
            📍 {o.lat?.toFixed(5)}, {o.lng?.toFixed(5)}
          </p>
          <p className="mt-2 font-mono text-xs">{formatSum(o.price)}</p>
          {photos.length ? (
            <div className="mt-3 flex gap-2">
              {photos.map((src) => (
                <img key={src.slice(0, 24)} src={src} alt="" className="size-16 rounded-md object-cover" />
              ))}
            </div>
          ) : null}
        </section>
      </div>
      <section className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-medium text-muted">Мастер</h2>
        {data.master ? (
          <div className="mt-2 flex items-center justify-between">
            <Link to="/admin/masters/$id" params={{ id: String(data.master.id) }} className="hover:text-accent">
              <p>
                {data.master.first_name} {data.master.last_name}
              </p>
              <p className="text-sm text-muted">
                {data.master.rating.toFixed(2)} · {data.master.completed_orders} заказов · {data.master.phone}
              </p>
            </Link>
            <OnlineDot status={data.master.online_status} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Ещё не назначен</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {canAssign && statusAssign ? (
            <Button onClick={() => setAssign(true)}>
              {o.status === "master_rejected" ? "Назначить другого мастера" : "Назначить мастера"}
            </Button>
          ) : null}
          {canAssign && o.status !== "completed" && o.status !== "cancelled" ? (
            <Button variant="outline" onClick={() => cancel.mutate()}>
              Отменить заявку
            </Button>
          ) : null}
        </div>
      </section>
      <section className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-medium text-muted">Timeline</h2>
        <ol className="mt-4 space-y-3">
          {data.events.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="w-16 shrink-0 font-mono text-xs text-accent">
                {new Date(e.created_at).toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span>{EVENT_LABEL[e.event_type] ?? e.event_type}</span>
            </li>
          ))}
        </ol>
      </section>
      {assign && canAssign ? (
        <AssignDialog orderId={o.id} publicNo={o.public_no} clientName={o.client_name} onClose={() => setAssign(false)} />
      ) : null}
    </div>
  );
}
