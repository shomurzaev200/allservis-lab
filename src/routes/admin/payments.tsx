import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listPayments, reviewPayment } from "@/lib/server/api";
import { Button } from "@/components/ui/button";
import { formatSum } from "@/lib/domain";

export const Route = createFileRoute("/admin/payments")({ component: PaymentsPage });

function PaymentsPage() {
  const qc = useQueryClient();
  const { data = [], isPending } = useQuery({ queryKey: ["payments"], queryFn: () => listPayments() });
  const review = useMutation({
    mutationFn: (p: { id: number; approve: boolean }) => reviewPayment({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl">Пополнения</h1>
        <p className="text-sm text-muted">Клиент присылает скрин в бота. Подтвердите — доступ откроется.</p>
      </div>
      {isPending ? <p className="text-sm text-muted">Загрузка…</p> : null}
      {data.length === 0 && !isPending ? (
        <p className="rounded-xl bg-surface px-4 py-10 text-center text-sm text-subtle">Пока нет скринов. Реквизиты задаются в Настройках.</p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((p) => (
          <article key={p.id} className="glass-card space-y-3 rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{p.client_name}</p>
                <p className="font-mono text-xs text-muted">{p.telegram_id ?? "—"}</p>
              </div>
              <span className={p.status === "approved" ? "text-ok" : p.status === "rejected" ? "text-danger" : "text-warn"}>
                {p.status === "approved" ? "одобрен" : p.status === "rejected" ? "отклонён" : "ждёт"}
              </span>
            </div>
            <p className="font-mono text-sm text-accent">{formatSum(p.amount)}</p>
            {p.screenshot?.startsWith("data:") ? (
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
          </article>
        ))}
      </div>
    </div>
  );
}
