import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addManualPayment, getBotSettings, listClients, listPayments, reviewPayment, revokePayment } from "@/lib/server/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatSum } from "@/lib/domain";
import { NeedPerm } from "@/components/admin/access";

export const Route = createFileRoute("/admin/payments")({ component: PaymentsPage });

function PaymentsPage() {
  return (
    <NeedPerm perm="finance">
      <PaymentsInner />
    </NeedPerm>
  );
}

function PaymentsInner() {
  const qc = useQueryClient();
  const { data = [], isPending } = useQuery({ queryKey: ["payments"], queryFn: () => listPayments() });
  const clients = useQuery({ queryKey: ["clients"], queryFn: () => listClients() });
  const settings = useQuery({ queryKey: ["bot-settings"], queryFn: () => getBotSettings() });
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const review = useMutation({
    mutationFn: (p: { id: number; approve: boolean }) => reviewPayment({ data: p }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const add = useMutation({
    mutationFn: () => addManualPayment({ data: { clientId: Number(picked), amount: Number(amount) || undefined } }),
    onSuccess: (r) => {
      if (r.ok) {
        void qc.invalidateQueries();
        setPicked("");
        setAmount("");
      }
    },
  });
  const revoke = useMutation({
    mutationFn: (p: { id?: number; clientId?: number }) => revokePayment({ data: p }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const filtered = (clients.data ?? [])
    .filter((c) => `${c.name} ${c.phone} ${c.telegram_id ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(a.paid) - Number(b.paid))
    .slice(0, 40);
  const defaultAmount = settings.data?.payAmount ?? 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl">Пополнения</h1>
        <p className="text-sm text-muted">
          Можно подтвердить скрин из бота, вручную открыть доступ клиенту или отменить пополнение — бот снова попросит оплату.
        </p>
      </div>

      <section className="glass-card space-y-3 rounded-xl p-5">
        <h2 className="font-medium">Добавить пополнение вручную</h2>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти клиента: имя, телефон, Telegram" />
        <select
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
          value={picked}
          onChange={(e) => setPicked(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Клиент…</option>
          {filtered.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.phone || c.telegram_id} {c.paid ? "· уже оплачен" : ""}
            </option>
          ))}
        </select>
        <Input
          inputMode="numeric"
          placeholder={defaultAmount ? `Сумма, сум (пусто = ${defaultAmount})` : "Сумма, сум"}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button disabled={!picked || add.isPending} onClick={() => add.mutate()}>
          {add.isPending ? "Добавляю…" : "Пополнить счёт"}
        </Button>
        {add.data && !add.data.ok ? <p className="text-sm text-danger">{add.data.error}</p> : null}
        {add.data?.ok ? <p className="text-sm text-ok">Доступ открыт. Клиенту ушло сообщение в бот.</p> : null}
      </section>

      {review.data && !review.data.ok ? <p className="text-sm text-danger">{review.data.error}</p> : null}
      {revoke.data && !revoke.data.ok ? <p className="text-sm text-danger">{revoke.data.error}</p> : null}
      {isPending ? <p className="text-sm text-muted">Загрузка…</p> : null}
      {data.length === 0 && !isPending ? (
        <p className="rounded-xl bg-surface px-4 py-10 text-center text-sm text-subtle">Пока нет записей. Добавьте вручную или дождитесь скрина в боте.</p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((p) => (
          <article key={p.id} className="glass-card space-y-3 rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{p.client_name}</p>
                <p className="font-mono text-xs text-muted">{p.telegram_id ?? "—"}</p>
              </div>
              <span className={p.status === "approved" ? "text-ok" : p.status === "rejected" || p.status === "cancelled" ? "text-danger" : "text-warn"}>
                {p.status === "approved" ? "одобрен" : p.status === "rejected" ? "отклонён" : p.status === "cancelled" ? "отменён" : "ждёт"}
              </span>
            </div>
            <p className="font-mono text-sm text-accent">{formatSum(p.amount)}</p>
            {p.screenshot === "manual" ? (
              <p className="text-xs text-subtle">Добавлено вручную из админки</p>
            ) : p.screenshot?.startsWith("data:") ? (
              <img src={p.screenshot} alt="скрин" className="max-h-56 w-full rounded-lg object-contain bg-surface-2" />
            ) : (
              <p className="text-xs text-subtle">Скрин недоступен</p>
            )}
            <p className="text-xs text-subtle">{new Date(p.created_at).toLocaleString("ru-RU")}</p>
            {p.status === "pending" ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => review.mutate({ id: p.id, approve: true })}>Подтвердить</Button>
                <Button size="sm" variant="outline" onClick={() => review.mutate({ id: p.id, approve: false })}>Отклонить</Button>
              </div>
            ) : null}
            {p.status === "approved" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (window.confirm(`Отменить пополнение «${p.client_name}»? Клиент снова не сможет вызывать мастера.`)) {
                    revoke.mutate({ id: p.id });
                  }
                }}
              >
                Отменить пополнение
              </Button>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
