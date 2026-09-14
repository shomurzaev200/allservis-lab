import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignMaster, candidatesForOrder } from "@/lib/server/api";
import { serviceById } from "@/lib/catalog";
import { OnlineDot } from "./status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AssignDialog({
  orderId,
  publicNo,
  clientName,
  onClose,
}: {
  orderId: number;
  publicNo: number;
  clientName?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["candidates", orderId],
    queryFn: () => candidatesForOrder({ data: orderId }),
  });
  const [filter, setFilter] = useState<"all" | "online" | "free" | "spec">("all");
  const [sort, setSort] = useState<"km" | "rating" | "jobs">("km");
  const [picked, setPicked] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);

  const masters = useMemo(() => {
    let list = data?.masters ?? [];
    if (filter === "online") list = list.filter((m) => m.online_status === "online" || m.online_status === "busy");
    if (filter === "free") list = list.filter((m) => m.online_status === "online" && m.active_orders === 0);
    if (filter === "spec") list = list.filter((m) => m.recommended);
    const copy = [...list];
    copy.sort((a, b) => {
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "jobs") return b.completed_orders - a.completed_orders;
      if (a.km == null) return 1;
      if (b.km == null) return -1;
      return a.km - b.km;
    });
    return copy;
  }, [data, filter, sort]);

  const pickedRow = masters.find((m) => m.id === picked) ?? data?.masters.find((m) => m.id === picked);
  const mut = useMutation({
    mutationFn: () => assignMaster({ data: { orderId, masterId: picked! } }),
    onSuccess: async (res) => {
      if (!res.success) return;
      await qc.invalidateQueries();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 md:items-center">
      <div className="glass-card flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl">
        <header className="border-b border-border px-5 py-4">
          <p className="text-xs text-muted">Назначить мастера</p>
          <h2 className="font-display text-lg">Заявка №{publicNo}</h2>
          <p className="mt-1 text-sm text-muted">
            {clientName ? `Клиент: ${clientName}. ` : ""}
            Рекомендации по дистанции и специализации — решение только за вами.
          </p>
        </header>
        <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3">
          {(
            [
              ["all", "Все"],
              ["online", "Онлайн"],
              ["free", "Свободен"],
              ["spec", "Специализация"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                "h-9 rounded-full px-3 text-xs font-medium",
                filter === id ? "bg-accent text-primary-fg" : "bg-surface-2 text-muted",
              )}
            >
              {label}
            </button>
          ))}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="ml-auto h-9 rounded-md bg-surface-2 px-2 text-xs text-fg"
          >
            <option value="km">По расстоянию</option>
            <option value="rating">По рейтингу</option>
            <option value="jobs">По заказам</option>
          </select>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {isPending ? <p className="p-6 text-sm text-muted">Загрузка парка…</p> : null}
          {masters.map((m) => {
            const totalDec = m.accepted_orders + m.rejected_orders;
            const acceptPct = totalDec ? Math.round((m.accepted_orders / totalDec) * 100) : 0;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setPicked(m.id);
                  setConfirm(true);
                }}
                className={cn(
                  "flex w-full items-start justify-between gap-3 rounded-lg bg-surface-2 p-3 text-left shadow-[var(--shadow-border)]",
                  picked === m.id && "ring-1 ring-accent",
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {m.first_name} {m.last_name}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {serviceById(m.specialization)?.title} · {m.rating.toFixed(2)} · {m.completed_orders} заказов ·
                    принятие {acceptPct}% · активных {m.active_orders}
                  </p>
                  <p className="mt-1 text-xs text-accent">
                    {m.km != null ? `${m.km} км от клиента` : "нет координат"}
                    {m.recommended ? " · рекомендуется" : ""}
                    {"inZone" in m && m.inZone === false ? " · вне Бекабада" : ""}
                  </p>
                </div>
                <OnlineDot status={m.online_status} />
              </button>
            );
          })}
        </div>
        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </footer>
      </div>

      {confirm && pickedRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="glass-card w-full max-w-md rounded-xl p-5">
            <h3 className="font-display text-lg">Подтвердить назначение?</h3>
            <p className="mt-2 text-sm text-muted">
              Заявка №{publicNo}
              {clientName ? ` · ${clientName}` : ""}
              <br />
              Мастер: {pickedRow.first_name} {pickedRow.last_name}
              {pickedRow.km != null ? ` · ${pickedRow.km} км` : ""}
            </p>
            <p className="mt-2 text-sm text-danger">{mut.data && !mut.data.success ? mut.data.error : null}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirm(false)}>
                Отмена
              </Button>
              <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
                Назначить
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
