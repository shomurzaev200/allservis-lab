import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrderBadge } from "@/components/admin/status-badge";
import { heartbeatMaster, masterAdvance, masterDecision, openMasterDesk, setMasterOnline } from "@/lib/server/api";
import { serviceById } from "@/lib/catalog";
import { formatSum, type OrderStatus } from "@/lib/domain";

export const Route = createFileRoute("/master")({ component: MasterRoute });

const CODE_KEY = "allservis.masterCode";

function MasterRoute() {
  return (
    <AuthGuard>
      <MasterDesk />
    </AuthGuard>
  );
}

function MasterDesk() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [active, setActive] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem(CODE_KEY) ?? "";
    if (saved) {
      setCode(saved);
      setActive(saved);
    }
  }, []);

  const desk = useQuery({
    queryKey: ["master-desk", active],
    queryFn: () => openMasterDesk({ data: { code: active } }),
    enabled: active.length >= 4,
    refetchInterval: 15_000,
  });

  const master = desk.data?.ok ? desk.data.master : null;
  const id = master?.id;

  useEffect(() => {
    if (!id || !active) return;
    void heartbeatMaster({ data: { masterId: id, code: active } });
    const t = setInterval(() => void heartbeatMaster({ data: { masterId: id, code: active } }), 20000);
    return () => clearInterval(t);
  }, [id, active]);

  const orders = desk.data?.ok ? desk.data.orders : [];
  const inbox = orders.filter((o) => o.status === "assigned");
  const working = orders.filter((o) => ["master_accepted", "enroute", "arrived", "in_progress"].includes(o.status));

  const decide = useMutation({
    mutationFn: (p: { orderId: number; accept: boolean }) =>
      masterDecision({ data: { orderId: p.orderId, accept: p.accept, masterId: id!, code: active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["master-desk"] }),
  });
  const adv = useMutation({
    mutationFn: (p: { orderId: number; to: OrderStatus }) =>
      masterAdvance({ data: { orderId: p.orderId, masterId: id!, to: p.to, code: active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["master-desk"] }),
  });
  const online = useMutation({
    mutationFn: (on: boolean) => setMasterOnline({ data: { masterId: id!, online: on, code: active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["master-desk"] }),
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
        <Link to="/admin" className="font-display text-accent">All Servis</Link>
        <p className="text-xs text-muted">Кабинет мастера</p>
      </header>
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const nextCode = code.trim().toLowerCase();
            sessionStorage.setItem(CODE_KEY, nextCode);
            setActive(nextCode);
          }}
        >
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код доступа мастера" className="max-w-xs" />
          <Button type="submit">Открыть</Button>
        </form>
        <p className="text-sm text-muted">Чужой профиль выбрать нельзя. Код показывает администратор в карточке мастера.</p>
        {desk.data && !desk.data.ok ? <p className="text-sm text-warn">{desk.data.error}</p> : null}
        {master ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted">
              {master.first_name} {master.last_name} · {master.online_status === "online" || master.online_status === "busy" ? "на линии" : "офлайн"} · {formatSum(master.earnings)}
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={online.isPending}
              onClick={() => online.mutate(!(master.online_status === "online" || master.online_status === "busy"))}
            >
              {master.online_status === "online" || master.online_status === "busy" ? "Уйти офлайн" : "Выйти на линию"}
            </Button>
          </div>
        ) : null}
        <section className="space-y-3">
          <h2 className="text-sm text-muted">Новые назначения</h2>
          {inbox.length === 0 ? <p className="rounded-xl bg-surface px-4 py-8 text-center text-sm text-subtle">Нет входящих</p> : null}
          {inbox.map((o) => (
            <article key={o.id} className="glass-card rounded-xl p-4">
              <p className="font-mono text-xs text-subtle">№{o.public_no}</p>
              <h3 className="font-medium">{serviceById(o.category_slug)?.title}</h3>
              <p className="mt-1 text-sm text-muted">{o.description}</p>
              <p className="mt-2 text-xs text-muted">{o.district} · {o.phone ? <a className="text-accent" href={`tel:${o.phone.replace(/[^\d+]/g, "")}`}>{o.phone}</a> : "без телефона"}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button onClick={() => decide.mutate({ orderId: o.id, accept: true })}>Принять</Button>
                <Button variant="outline" onClick={() => decide.mutate({ orderId: o.id, accept: false })}>Отклонить</Button>
              </div>
            </article>
          ))}
        </section>
        <section className="space-y-3">
          <h2 className="text-sm text-muted">В работе</h2>
          {working.map((o) => (
            <article key={o.id} className="glass-card rounded-xl p-4">
              <div className="flex items-start justify-between">
                <h3 className="font-medium">№{o.public_no}</h3>
                <OrderBadge status={o.status} />
              </div>
              <p className="mt-1 text-sm text-muted">{o.description}</p>
              {next[o.status] ? (
                <Button className="mt-4 w-full" onClick={() => adv.mutate({ orderId: o.id, to: next[o.status]! })}>{nextLabel[o.status]}</Button>
              ) : null}
            </article>
          ))}
        </section>
        {desk.data?.ok && desk.data.payouts.length ? (
          <section className="space-y-2">
            <h2 className="text-sm text-muted">Начисления</h2>
            {desk.data.payouts.map((p) => (
              <p key={p.id} className="text-sm text-muted">
                {formatSum(Number(p.amount))} · {p.status === "pending" ? "ждёт клиента" : p.status === "paid" ? "выплачено" : "начислено"} · {p.note}
              </p>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
