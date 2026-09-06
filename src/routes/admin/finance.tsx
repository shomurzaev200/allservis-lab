import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboard, listMasters } from "@/lib/server/api";
import { formatSum } from "@/lib/domain";

export const Route = createFileRoute("/admin/finance")({ component: FinancePage });

function FinancePage() {
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const masters = useQuery({ queryKey: ["masters"], queryFn: () => listMasters() });
  const f = dash.data?.finance;
  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="font-display text-2xl">Финансы</h1>
      {f ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card k="Сегодня" v={formatSum(Number(f.today))} />
          <Card k="Неделя" v={formatSum(Number(f.week))} />
          <Card k="Месяц" v={formatSum(Number(f.month))} />
          <Card k="Средний чек" v={formatSum(Number(f.avg))} />
        </div>
      ) : (
        <p className="text-sm text-muted">Загрузка…</p>
      )}
      <p className="text-sm text-muted">Выплаты мастерам (70% чека): {f ? formatSum(Number(f.payout)) : "—"}</p>
      <section className="space-y-2">
        <h2 className="text-sm text-muted">Заработок по мастерам</h2>
        {(masters.data ?? []).map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
            <span className="text-sm">
              {m.first_name} {m.last_name}
            </span>
            <span className="font-mono text-sm text-accent">{formatSum(m.earnings)}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function Card({ k, v }: { k: string; v: string }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <p className="text-xs text-muted">{k}</p>
      <p className="mt-2 font-display text-xl">{v}</p>
    </div>
  );
}
