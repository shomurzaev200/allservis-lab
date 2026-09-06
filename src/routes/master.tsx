import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { OrderBadge } from "@/components/admin/status-badge";
import { heartbeatMaster, listMasters, listOrders, masterAdvance, masterDecision, setMasterOnline } from "@/lib/server/api";
import { serviceById } from "@/lib/catalog";
import type { OrderStatus } from "@/lib/domain";

export const Route = createFileRoute("/master")({ component: MasterRoute });

function MasterRoute() {
  return (
    <AuthGuard>
      <MasterDesk />
    </AuthGuard>
  );
}

function MasterDesk() {
  const qc = useQueryClient();
  const masters = useQuery({ queryKey: ["masters"], queryFn: () => listMasters() });
  const [masterId, setMasterId] = useState<number | null>(null);
  const current = masters.data?.find((m) => m.id === masterId) ?? masters.data?.[0];
  const id = current?.id;

  useEffect(() => {
    if (current && masterId == null) setMasterId(current.id);
  }, [current, masterId]);

  useEffect(() => {
    if (!id) return;
    void heartbeatMaster({ data: id });
    const t = setInterval(() => void heartbeatMaster({ data: id }), 20000);
    return () => clearInterval(t);
  }, [id]);

  const orders = useQuery({
    queryKey: ["orders", "all"],
    queryFn: () => listOrders({ data: { status: "all" } }),
  });

  const mine = (orders.data ?? []).filter((o) => o.master_id === id);
  const inbox = mine.filter((o) => o.status === "assigned");
  const active = mine.filter((o) =>
    ["master_accepted", "enroute", "arrived", "in_progress"].includes(o.status),
  );

  const decide = useMutation({
    mutationFn: (p: { orderId: number; accept: boolean }) =>
      masterDecision({ data: { orderId: p.orderId, accept: p.accept, masterId: id! } }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const adv = useMutation({
    mutationFn: (p: { orderId: number; to: OrderStatus }) =>
      masterAdvance({ data: { orderId: p.orderId, masterId: id!, to: p.to } }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const online = useMutation({
    mutationFn: (on: boolean) => setMasterOnline({ data: { masterId: id!, online: on } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["masters"] }),
  });

  const next: Partial<Record<OrderStatus, OrderStatus>> = {
    master_accepted: "enroute",
    enroute: "arrived",
    arrived: "in_progress",
    in_progress: "completed",
  };
  const nextLabel: Partial<Record<OrderStatus, string>> = {
    master_accepted: "Выехать",
    enroute: "На месте",
    arrived: "Начать работу",
    in_progress: "Завершить",
  };

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to="/admin" className="font-display text-accent">
          All Servis
        </Link>
        <select
          className="h-11 rounded-md bg-surface-2 px-3 text-sm"
          value={id ?? ""}
          onChange={(e) => setMasterId(Number(e.target.value))}
        >
          {(masters.data ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.first_name} {m.last_name} — {serviceById(m.specialization)?.title}
            </option>
          ))}
        </select>
      </header>
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <h1 className="font-display text-2xl">Кабинет мастера</h1>
        {current ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted">
              {current.first_name} {current.last_name} · {current.online_status === "online" || current.online_status === "busy" ? "на линии" : "офлайн"}
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={!id || online.isPending}
              onClick={() => online.mutate(!(current.online_status === "online" || current.online_status === "busy"))}
            >
              {current.online_status === "online" || current.online_status === "busy" ? "Уйти офлайн" : "Выйти на линию"}
            </Button>
          </div>
        ) : (
          <p className="rounded-xl bg-surface px-4 py-8 text-center text-sm text-subtle">
            Мастеров пока нет. Откройте админку — демо-парк появится после первого входа владельца.
          </p>
        )}
        <section className="space-y-3">
          <h2 className="text-sm text-muted">Новые назначения от администратора</h2>
          {inbox.length === 0 ? (
            <p className="rounded-xl bg-surface px-4 py-8 text-center text-sm text-subtle">Нет входящих</p>
          ) : (
            inbox.map((o) => (
              <article key={o.id} className="glass-card rounded-xl p-4">
                <p className="font-mono text-xs text-subtle">№{o.public_no}</p>
                <h3 className="font-medium">{serviceById(o.category_slug)?.title}</h3>
                <p className="mt-1 text-sm text-muted">{o.description}</p>
                <p className="mt-2 text-xs text-muted">
                  {o.district} · {o.phone}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button onClick={() => decide.mutate({ orderId: o.id, accept: true })}>Принять</Button>
                  <Button variant="outline" onClick={() => decide.mutate({ orderId: o.id, accept: false })}>
                    Отклонить
                  </Button>
                </div>
              </article>
            ))
          )}
        </section>
        <section className="space-y-3">
          <h2 className="text-sm text-muted">В работе</h2>
          {active.map((o) => (
            <article key={o.id} className="glass-card rounded-xl p-4">
              <div className="flex items-start justify-between">
                <h3 className="font-medium">№{o.public_no}</h3>
                <OrderBadge status={o.status} />
              </div>
              <p className="mt-1 text-sm text-muted">{o.description}</p>
              {next[o.status] ? (
                <Button className="mt-4 w-full" onClick={() => adv.mutate({ orderId: o.id, to: next[o.status]! })}>
                  {nextLabel[o.status]}
                </Button>
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
