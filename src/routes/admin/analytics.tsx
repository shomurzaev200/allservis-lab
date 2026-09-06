import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getAnalytics } from "@/lib/server/api";
import { serviceById } from "@/lib/catalog";
import { Kpi } from "@/components/admin/kpi";

export const Route = createFileRoute("/admin/analytics")({ component: AnalyticsPage });

const PIE = ["#22d3ee", "#34d399", "#f5c15c", "#f43f5e", "#8ba0b5"];

function AnalyticsPage() {
  const { data, isPending } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => getAnalytics(),
  });
  if (isPending || !data) return <p className="p-6 text-sm text-muted">Считаем метрики…</p>;
  const byCat = data.byCat.map((r) => ({
    name: serviceById(r.slug)?.title ?? r.slug,
    n: Number(r.n),
  }));
  const byDay = data.byDay.map((r) => ({ d: String(r.d).slice(5), n: Number(r.n), revenue: Number(r.revenue) }));
  const byCity = data.byCity.map((r) => ({ name: r.district || "—", n: Number(r.n) }));
  const ratings = [1, 2, 3, 4, 5].map((rating) => ({
    name: `${rating}`,
    n: Number(data.ratings.find((r) => Number(r.rating) === rating)?.n ?? 0),
  }));
  const byHour = Array.from({ length: 24 }, (_, h) => ({
    h: String(h).padStart(2, "0"),
    n: Number(data.byHour.find((r) => Number(r.h) === h)?.n ?? 0),
  }));
  const f = data.funnel;
  const conv = f.created ? Math.round((f.completed / f.created) * 100) : 0;
  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="font-display text-2xl">Аналитика</h1>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Создано" value={f.created} />
        <Kpi label="Назначено" value={f.assigned} tone="accent" />
        <Kpi label="Принято" value={f.accepted} tone="ok" />
        <Kpi label="Завершено" value={f.completed} />
        <Kpi label="Отменено" value={f.cancelled} tone="danger" />
        <Kpi label="Conversion" value={`${conv}%`} hint="завершено / создано" />
      </div>
      <section className="glass-card rounded-xl p-4">
        <h2 className="mb-3 text-sm text-muted">Заказы по дням</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byDay}>
              <CartesianGrid stroke="rgb(34 211 238 / 0.08)" />
              <XAxis dataKey="d" stroke="#8ba0b5" fontSize={11} />
              <YAxis stroke="#8ba0b5" fontSize={11} />
              <Tooltip contentStyle={{ background: "#0d1320", border: "1px solid #1c2a3d" }} />
              <Line type="monotone" dataKey="n" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass-card rounded-xl p-4">
          <h2 className="mb-3 text-sm text-muted">Выручка</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={byDay}>
                <CartesianGrid stroke="rgb(34 211 238 / 0.08)" />
                <XAxis dataKey="d" stroke="#8ba0b5" fontSize={11} />
                <YAxis stroke="#8ba0b5" fontSize={11} />
                <Tooltip contentStyle={{ background: "#0d1320", border: "1px solid #1c2a3d" }} />
                <Area type="monotone" dataKey="revenue" stroke="#34d399" fill="rgb(52 211 153 / 0.2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="glass-card rounded-xl p-4">
          <h2 className="mb-3 text-sm text-muted">По часам</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byHour}>
                <CartesianGrid stroke="rgb(34 211 238 / 0.08)" />
                <XAxis dataKey="h" stroke="#8ba0b5" fontSize={10} />
                <YAxis stroke="#8ba0b5" fontSize={11} />
                <Tooltip contentStyle={{ background: "#0d1320", border: "1px solid #1c2a3d" }} />
                <Bar dataKey="n" fill="#22d3ee" radius={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="glass-card rounded-xl p-4">
          <h2 className="mb-3 text-sm text-muted">По категориям</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCat} layout="vertical">
                <CartesianGrid stroke="rgb(34 211 238 / 0.08)" />
                <XAxis type="number" stroke="#8ba0b5" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#8ba0b5" fontSize={11} width={90} />
                <Tooltip contentStyle={{ background: "#0d1320", border: "1px solid #1c2a3d" }} />
                <Bar dataKey="n" fill="#22d3ee" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="glass-card rounded-xl p-4">
          <h2 className="mb-3 text-sm text-muted">По районам</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCity}>
                <CartesianGrid stroke="rgb(34 211 238 / 0.08)" />
                <XAxis dataKey="name" stroke="#8ba0b5" fontSize={10} interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis stroke="#8ba0b5" fontSize={11} />
                <Tooltip contentStyle={{ background: "#0d1320", border: "1px solid #1c2a3d" }} />
                <Bar dataKey="n" fill="#34d399" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="glass-card rounded-xl p-4">
          <h2 className="mb-3 text-sm text-muted">Оценки 1–5</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={ratings} dataKey="n" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={3}>
                  {ratings.map((_, i) => (
                    <Cell key={i} fill={PIE[i % PIE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0d1320", border: "1px solid #1c2a3d" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
