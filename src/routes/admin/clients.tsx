import { Fragment, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listClients, listOrders } from "@/lib/server/api";
import { Input } from "@/components/ui/input";
import { OrderBadge } from "@/components/admin/status-badge";

export const Route = createFileRoute("/admin/clients")({ component: ClientsPage });

function ClientsPage() {
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const { data = [], isPending } = useQuery({
    queryKey: ["clients"],
    queryFn: () => listClients(),
  });
  const orders = useQuery({
    queryKey: ["orders", "all"],
    queryFn: () => listOrders({ data: { status: "all" } }),
    enabled: openId != null,
  });
  const filtered = data.filter((c) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.phone.includes(s) || (c.telegram_id ?? "").includes(s);
  });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl">Клиенты</h1>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, телефон, Telegram" className="max-w-xs" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-3">Имя</th>
              <th className="px-3 py-3">Телефон</th>
              <th className="px-3 py-3">Telegram</th>
              <th className="px-3 py-3">Район</th>
              <th className="px-3 py-3">Рейтинг</th>
              <th className="px-3 py-3">Заказы</th>
              <th className="px-3 py-3">Готово</th>
              <th className="px-3 py-3">Отмены</th>
              <th className="px-3 py-3">Активность</th>
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td className="px-3 py-6 text-muted" colSpan={9}>
                  Загрузка…
                </td>
              </tr>
            ) : null}
            {filtered.map((c) => (
              <Fragment key={c.id}>
                <tr
                  className="cursor-pointer border-t border-border hover:bg-surface-2"
                  onClick={() => setOpenId(openId === c.id ? null : c.id)}
                >
                  <td className="px-3 py-3">{c.name}</td>
                  <td className="px-3 py-3 font-mono text-xs">{c.phone}</td>
                  <td className="px-3 py-3 font-mono text-xs">{c.telegram_id ?? "—"}</td>
                  <td className="px-3 py-3">{c.district}</td>
                  <td className="px-3 py-3">{Number(c.rating).toFixed(1)}</td>
                  <td className="px-3 py-3">{c.orders_count}</td>
                  <td className="px-3 py-3">{c.completed_count}</td>
                  <td className="px-3 py-3">{c.cancelled_count}</td>
                  <td className="px-3 py-3 text-xs text-muted">
                    {c.last_active ? new Date(c.last_active).toLocaleDateString("ru-RU") : "—"}
                  </td>
                </tr>
                {openId === c.id ? (
                  <tr key={`${c.id}-h`} className="border-t border-border bg-surface">
                    <td colSpan={9} className="px-3 py-3">
                      <p className="mb-2 text-xs text-muted">История заявок</p>
                      <div className="space-y-1">
                        {(orders.data ?? [])
                          .filter((o) => o.client_id === c.id)
                          .map((o) => (
                            <Link
                              key={o.id}
                              to="/admin/orders/$id"
                              params={{ id: String(o.id) }}
                              className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-surface-2"
                            >
                              <span className="text-sm">
                                №{o.public_no} · {o.description}
                              </span>
                              <OrderBadge status={o.status} />
                            </Link>
                          ))}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
