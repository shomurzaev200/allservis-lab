import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelOrder, listOrders } from "@/lib/server/api";
import { OrderBadge } from "@/components/admin/status-badge";
import { AssignDialog } from "@/components/admin/assign-dialog";
import { useAccess } from "@/components/admin/access";
import { ORDER_STATUSES, STATUS_LABEL } from "@/lib/domain";
import { serviceById } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Search = { status?: string; q?: string };

export const Route = createFileRoute("/admin/orders/")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    status: typeof raw.status === "string" ? raw.status : "all",
    q: typeof raw.q === "string" ? raw.q : "",
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const search = Route.useSearch();
  const [status, setStatus] = useState(search.status ?? "all");
  const [q, setQ] = useState(search.q ?? "");
  const [debounced, setDebounced] = useState(q);
  const [assign, setAssign] = useState<{ id: number; no: number; name: string } | null>(null);
  const qc = useQueryClient();
  const access = useAccess();
  const canAssign = access.allowed("assign");
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  const { data = [], isPending } = useQuery({
    queryKey: ["orders", status, debounced],
    queryFn: () => listOrders({ data: { status, q: debounced } }),
    refetchInterval: 15_000,
  });
  const cancel = useMutation({
    mutationFn: (id: number) => cancelOrder({ data: id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Заявки</h1>
          <p className="text-sm text-muted">Назначение мастера — только вручную.</p>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск: клиент, телефон, номер"
          className="max-w-xs"
        />
      </div>
      {cancel.data && "error" in cancel.data && cancel.data.error ? (
        <p className="text-sm text-warn">{String(cancel.data.error)}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <FilterChip id="all" label="Все" cur={status} set={setStatus} />
        <FilterChip id="waiting" label="Ждут вас" cur={status} set={setStatus} />
        <FilterChip id="work" label="В работе" cur={status} set={setStatus} />
        <FilterChip id="completed" label="Завершены" cur={status} set={setStatus} />
        <FilterChip id="cancelled" label="Отмены" cur={status} set={setStatus} />
        <select
          value={ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number]) ? status : ""}
          onChange={(e) => setStatus(e.target.value || "all")}
          className="h-9 rounded-full bg-surface-2 px-3 text-xs text-muted"
        >
          <option value="">Точный статус</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-3">ID</th>
              <th className="px-3 py-3">Клиент</th>
              <th className="px-3 py-3">Телефон</th>
              <th className="px-3 py-3">Категория</th>
              <th className="px-3 py-3">Мастер</th>
              <th className="px-3 py-3">Статус</th>
              <th className="px-3 py-3">Район</th>
              <th className="px-3 py-3">Создана</th>
              <th className="px-3 py-3">Обновлена</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td className="px-3 py-8 text-muted" colSpan={10}>
                  Загрузка…
                </td>
              </tr>
            ) : null}
            {!isPending && data.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-muted" colSpan={10}>
                  Нет заявок по фильтру
                </td>
              </tr>
            ) : null}
            {data.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="px-3 py-3 font-mono text-xs">№{o.public_no}</td>
                <td className="px-3 py-3">{o.client_name}</td>
                <td className="px-3 py-3 font-mono text-xs">
                  {o.phone ? <a className="text-accent" href={`tel:${o.phone.replace(/[^\d+]/g, "")}`}>{o.phone}</a> : "—"}
                </td>
                <td className="px-3 py-3">{serviceById(o.category_slug)?.title}</td>
                <td className="px-3 py-3">{o.master_name ?? "—"}</td>
                <td className="px-3 py-3">
                  <OrderBadge status={o.status} />
                </td>
                <td className="px-3 py-3">{o.district}</td>
                <td className="px-3 py-3 text-xs text-muted">{new Date(o.created_at).toLocaleString("ru-RU")}</td>
                <td className="px-3 py-3 text-xs text-muted">{new Date(o.updated_at).toLocaleString("ru-RU")}</td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/admin/orders/$id" params={{ id: String(o.id) }}>
                        Карточка
                      </Link>
                    </Button>
                    {canAssign && (o.status === "waiting_admin" || o.status === "master_rejected" || o.status === "assigned") ? (
                      <Button size="sm" onClick={() => setAssign({ id: o.id, no: o.public_no, name: o.client_name })}>
                        Назначить
                      </Button>
                    ) : null}
                    {canAssign && o.status !== "completed" && o.status !== "cancelled" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (window.confirm(`Отменить заявку №${o.public_no}? Клиент увидит отмену.`)) cancel.mutate(o.id);
                        }}
                      >
                        Отмена
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {assign && canAssign ? (
        <AssignDialog
          orderId={assign.id}
          publicNo={assign.no}
          clientName={assign.name}
          onClose={() => setAssign(null)}
        />
      ) : null}
    </div>
  );
}

function FilterChip({
  id,
  label,
  cur,
  set,
}: {
  id: string;
  label: string;
  cur: string;
  set: (v: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => set(id)}
      className={
        cur === id
          ? "h-9 rounded-full bg-accent px-3 text-xs font-medium text-primary-fg"
          : "h-9 rounded-full bg-surface-2 px-3 text-xs text-muted"
      }
    >
      {label}
    </button>
  );
}
