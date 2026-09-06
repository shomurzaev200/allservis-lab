import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteMaster, getMaster, setMasterBlocked } from "@/lib/server/api";
import { OnlineDot, OrderBadge } from "@/components/admin/status-badge";
import { serviceById } from "@/lib/catalog";
import { formatSum } from "@/lib/domain";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/masters/$id")({ component: MasterCard });

function MasterCard() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["master", id], queryFn: () => getMaster({ data: Number(id) }) });
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
          <p className="text-sm text-muted">{serviceById(m.specialization)?.title} · {m.district}</p>
          <p className="mt-1 font-mono text-xs text-subtle">TG {m.telegram_id} · {m.phone}</p>
        </div>
        <OnlineDot status={m.online_status} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => block.mutate(!blocked)}>{blocked ? "Разблокировать" : "Заблокировать"}</Button>
        <Button variant="outline" onClick={() => remove.mutate()}>Удалить мастера</Button>
      </div>
      {remove.data && !remove.data.ok ? <p className="text-sm text-danger">{remove.data.error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        {[["Рейтинг", m.rating.toFixed(2)], ["Завершено", m.completed_orders], ["Принятие", `${rate}%`], ["Заработок", formatSum(m.earnings)]].map(([k, v]) => (
          <div key={k} className="glass-card rounded-xl p-3"><p className="text-xs text-muted">{k}</p><p className="mt-1 font-mono text-lg">{v}</p></div>
        ))}
      </div>
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
