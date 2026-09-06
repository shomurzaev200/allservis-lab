import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteClient, listClients, setClientBlocked } from "@/lib/server/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/clients")({ component: ClientsPage });

function ClientsPage() {
  const qc = useQueryClient();
  const { data = [], isPending } = useQuery({ queryKey: ["clients"], queryFn: () => listClients() });
  const [q, setQ] = useState("");
  const block = useMutation({
    mutationFn: (p: { id: number; blocked: boolean }) => setClientBlocked({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteClient({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
  const filtered = data.filter((c) =>
    `${c.name} ${c.phone} ${c.district} ${c.lang} ${c.role}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Клиенты</h1>
          <p className="text-sm text-muted">Телефон, гео, язык и роль приходят из бота. Удалить не блокирует — только стирает контакт.</p>
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" className="max-w-xs" />
      </div>
      {remove.data && !remove.data.ok ? <p className="text-sm text-warn">{remove.data.error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-3">Имя</th>
              <th className="px-3 py-3">Телефон</th>
              <th className="px-3 py-3">Telegram</th>
              <th className="px-3 py-3">Район / гео</th>
              <th className="px-3 py-3">Язык</th>
              <th className="px-3 py-3">Роль</th>
              <th className="px-3 py-3">Заказы</th>
              <th className="px-3 py-3">Статус</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {isPending ? <tr><td className="px-3 py-6 text-muted" colSpan={9}>Загрузка…</td></tr> : null}
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-3">{c.name}</td>
                <td className="px-3 py-3 font-mono text-xs">{c.phone || "—"}</td>
                <td className="px-3 py-3 font-mono text-xs">{c.telegram_id ?? "—"}</td>
                <td className="px-3 py-3 text-xs">
                  <p>{c.district || "—"}</p>
                  {c.lat != null && c.lng != null ? (
                    <p className="font-mono text-subtle">{Number(c.lat).toFixed(5)}, {Number(c.lng).toFixed(5)}</p>
                  ) : null}
                </td>
                <td className="px-3 py-3 uppercase">{c.lang || "ru"}</td>
                <td className="px-3 py-3">{c.role === "master" ? "мастер" : "клиент"}</td>
                <td className="px-3 py-3">{c.orders_count}</td>
                <td className="px-3 py-3">{c.blocked ? <span className="text-danger">блок</span> : <span className="text-ok">ок</span>}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => block.mutate({ id: c.id, blocked: !c.blocked })}>
                      {c.blocked ? "Разблок" : "Блок"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => remove.mutate(c.id)}>Удалить</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
