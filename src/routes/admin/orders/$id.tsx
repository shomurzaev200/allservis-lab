import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelOrder, confirmClientOrder, getOrder, saveOrderOps } from "@/lib/server/api";
import { AssignDialog } from "@/components/admin/assign-dialog";
import { OnlineDot, OrderBadge } from "@/components/admin/status-badge";
import { useAccess } from "@/components/admin/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [note, setNote] = useState("");
  const [agreed, setAgreed] = useState("");
  const [paid, setPaid] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const cancel = useMutation({
    mutationFn: (reason: string) => cancelOrder({ data: { orderId, reason } }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const ops = useMutation({
    mutationFn: () => saveOrderOps({
      data: {
        orderId,
        operatorNote: note,
        priceAgreed: agreed.trim() ? Number(agreed) : null,
        pricePaid: paid.trim() ? Number(paid) : 0,
        scheduledFor: null,
      },
    }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const confirm = useMutation({
    mutationFn: () => confirmClientOrder({ data: orderId }),
    onSuccess: () => qc.invalidateQueries(),
  });

  if (isPending) {
    return <p className="p-6 text-sm text-muted">Загрузка заявки…</p>;
  }
  if (!data?.order) {
    return (
      <div className="p-6">
        <p className="text-sm">Заявка не найдена.</p>
        <Link to="/admin/orders" className="mt-3 inline-block text-sm text-accent">К списку</Link>
      </div>
    );
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
          <p className="mt-2 font-mono text-xs">
            оценка {formatSum(o.price_estimate || o.price)}
            {o.price_agreed ? ` · согласовано ${formatSum(o.price_agreed)}` : ""}
            {o.price_paid ? ` · оплачено ${formatSum(o.price_paid)}` : ""}
            {` · мастеру ${formatSum(o.master_payout)}`}
          </p>
          {o.scheduled_for ? <p className="mt-1 text-sm">К времени: {new Date(o.scheduled_for).toLocaleString("ru-RU")}</p> : null}
          {o.lat != null && o.lng != null ? (
            <a className="mt-2 inline-block text-sm text-accent" href={`https://maps.google.com/?q=${o.lat},${o.lng}`} target="_blank" rel="noreferrer">Маршрут</a>
          ) : null}
          {photos.length ? (
            <div className="mt-3 flex gap-2">
              {photos.map((src) => (
                <button key={src.slice(0, 32)} type="button" onClick={() => setPhoto(src)}>
                  <img src={src} alt="" className="size-16 rounded-md object-cover" />
                </button>
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
            <Button variant="outline" onClick={() => {
              const reason = window.prompt("Причина отмены");
              if (!reason?.trim()) return;
              cancel.mutate(reason.trim());
            }}>
              Отменить заявку
            </Button>
          ) : null}
          {canAssign && o.status === "completed" && !o.client_confirmed ? (
            <Button variant="outline" onClick={() => confirm.mutate()}>Клиент подтвердил работу</Button>
          ) : null}
        </div>
        {o.cancel_reason ? <p className="mt-3 text-sm text-muted">Причина отмены: {o.cancel_reason}</p> : null}
        {o.client_confirmed ? <p className="mt-2 text-sm text-ok">Клиент подтвердил. Доля мастера начислена.</p> : null}
        {o.assigned_by ? <p className="mt-2 text-xs text-subtle">Назначил: {o.assigned_by}</p> : null}
        {canAssign ? (
          <div className="mt-4 space-y-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={o.operator_note || "Заметка оператора"} />
            <div className="flex flex-wrap gap-2">
              <Input value={agreed} onChange={(e) => setAgreed(e.target.value)} placeholder="Согласованная сумма" className="max-w-[12rem]" />
              <Input value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="Факт оплаты" className="max-w-[12rem]" />
              <Button variant="outline" onClick={() => ops.mutate()}>Сохранить</Button>
            </div>
            {o.operator_note ? <p className="text-sm text-muted">Заметка: {o.operator_note}</p> : null}
          </div>
        ) : null}
      </section>
      <section className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-medium text-muted">История заявки</h2>
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
      {photo ? (
        <button type="button" className="fixed inset-0 z-40 bg-black/80 p-6" onClick={() => setPhoto(null)}>
          <img src={photo} alt="" className="mx-auto max-h-full max-w-full object-contain" />
        </button>
      ) : null}
      {assign && canAssign ? (
        <AssignDialog orderId={o.id} publicNo={o.public_no} clientName={o.client_name} onClose={() => setAssign(false)} />
      ) : null}
    </div>
  );
}
