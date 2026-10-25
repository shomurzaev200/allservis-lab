import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteMaster, getMaster, markPayoutPaid, setMasterBlocked, setMasterProfile } from "@/lib/server/api";
import { OnlineDot, OrderBadge } from "@/components/admin/status-badge";
import { serviceById } from "@/lib/catalog";
import { formatSum } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccess } from "@/components/admin/access";

export const Route = createFileRoute("/admin/masters/$id")({ component: MasterCard });

function MasterCard() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const access = useAccess();
  const canDelete = access.allowed("delete");
  const canAssign = access.allowed("assign");
  const canMoney = access.allowed("finance");
  const { data, isPending } = useQuery({ queryKey: ["master", id], queryFn: () => getMaster({ data: Number(id) }) });
  const [specs, setSpecs] = useState("");
  const [zone, setZone] = useState("");
  const [schedule, setSchedule] = useState("");
  const block = useMutation({
    mutationFn: (blocked: boolean) => setMasterBlocked({ data: { id: Number(id), blocked } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["master", id] }),
  });
  const remove = useMutation({
    mutationFn: () => deleteMaster({ data: { id: Number(id) } }),
    onSuccess: (r) => {
      if (r.ok) void nav({ to: "/admin/masters" });
    },
  });
  const profile = useMutation({
    mutationFn: (approved: boolean) => setMasterProfile({
      data: {
        id: Number(id),
        approved,
        specs: specs || data?.specs || "",
        zone: zone || data?.zone || "",
        schedule: schedule || data?.schedule || "",
      },
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["master", id] }),
  });
  const paid = useMutation({
    mutationFn: (payoutId: number) => markPayoutPaid({ data: payoutId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["master", id] }),
  });
  if (isPending || !data?.master) return <p className="p-6 text-sm text-muted">Загрузка…</p>;
  const m = data.master;
  const accept = m.accepted_orders + m.rejected_orders;
  const rate = accept ? Math.round((m.accepted_orders / accept) * 100) : 0;
  const blocked = m.online_status === "blocked";
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">{m.first_name} {m.last_name}</h1>
          <p className="text-sm text-muted">{serviceById(m.specialization)?.title} · {m.city || "город не указан"} · {m.district || "махалля не определена"}</p>
          <p className="mt-1 font-mono text-xs text-subtle">TG {m.telegram_id} · {m.phone}</p>
          <p className="mt-1 font-mono text-xs text-accent">Код кабинета: {data.accessCode || "появится после сохранения профиля"}</p>
          <p className="text-xs text-muted">{data.approved ? "Профиль подтверждён" : "Ждёт проверки администратора"}</p>
        </div>
        <OnlineDot status={m.online_status} />
      </div>
      {canDelete ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => block.mutate(!blocked)}>{blocked ? "Разблокировать" : "Заблокировать"}</Button>
          <Button variant="outline" onClick={() => remove.mutate()}>Удалить мастера</Button>
        </div>
      ) : null}
      {remove.data && !remove.data.ok ? <p className="text-sm text-danger">{remove.data.error}</p> : null}
      {block.data && !block.data.ok ? <p className="text-sm text-danger">{block.data.error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        {[["Рейтинг", m.rating.toFixed(2)], ["Завершено", m.completed_orders], ["Принятие", `${rate}%`], ["Заработок", formatSum(m.earnings)]].map(([k, v]) => (
          <div key={k} className="glass-card rounded-xl p-3"><p className="text-xs text-muted">{k}</p><p className="mt-1 font-mono text-lg">{v}</p></div>
        ))}
      </div>
      {canAssign ? (
        <section className="glass-card space-y-2 rounded-xl p-4">
          <h2 className="text-sm text-muted">Проверка, специализации, зона, график</h2>
          <Input value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder={data.specs || "Специализации через запятую"} />
          <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder={data.zone || "Зона выезда"} />
          <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder={data.schedule || "График, например 09:00–19:00"} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => profile.mutate(true)}>Подтвердить мастера</Button>
            <Button variant="outline" onClick={() => profile.mutate(false)}>Снять допуск</Button>
          </div>
          {profile.data && !profile.data.ok ? <p className="text-sm text-danger">{profile.data.error}</p> : null}
        </section>
      ) : null}
      {canMoney && data.payouts?.length ? (
        <section className="space-y-2">
          <h2 className="text-sm text-muted">Выплаты</h2>
          {data.payouts.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm">
              <span>{formatSum(Number(p.amount))} · {p.status === "pending" ? "ждёт клиента" : p.status === "paid" ? "выплачено" : "начислено"} · {p.note}</span>
              {p.status === "accrued" ? <Button size="sm" variant="outline" onClick={() => paid.mutate(p.id)}>Выплачено</Button> : null}
            </div>
          ))}
        </section>
      ) : null}
      <section>
        <h2 className="mb-2 text-sm text-muted">История заказов</h2>
        <div className="space-y-2">
          {data.orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
              <span className="text-sm">№{o.public_no} · {o.client_name}</span>
              <OrderBadge status={o.status} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
