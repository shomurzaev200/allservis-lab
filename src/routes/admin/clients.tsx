import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteClient, listClients, setClientBlocked, addManualPayment, revokePayment } from "@/lib/server/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/components/admin/access";

export const Route = createFileRoute("/admin/clients")({ component: ClientsPage });

function ClientsPage() {
  const qc = useQueryClient();
  const access = useAccess();
  const canDelete = access.allowed("delete");
  const canPay = access.allowed("finance");
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
  const pay = useMutation({
    mutationFn: (clientId: number) => addManualPayment({ data: { clientId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
  const unpay = useMutation({
    mutationFn: (clientId: number) => revokePayment({ data: { clientId } }),
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
          <p className="text-sm text-muted">Удаление убирает клиента, его заявки и сессии из всех вкладок. Демо-записи тоже скрыты.</p>
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" className="max-w-xs" />
      </div>
      {remove.data && !remove.data.ok ? <p className="text-sm text-warn">{remove.data.error}</p> : null}
      {block.data && !block.data.ok ? <p className="text-sm text-warn">{block.data.error}</p> : null}
      {pay.data && !pay.data.ok ? <p className="text-sm text-warn">{pay.data.error}</p> : null}
      {unpay.data && !unpay.data.ok ? <p className="text-sm text-warn">{unpay.data.error}</p> : null}
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
              <th className="px-3 py-3">Оплата</th>
              <th className="px-3 py-3">Статус</th>
              {canDelete || canPay ? <th className="px-3 py-3" /> : null}
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
                <td className="px-3 py-3">{c.paid ? <span className="text-ok">оплачен</span> : <span className="text-warn">нет</span>}</td>
                <td className="px-3 py-3">{c.blocked ? <span className="text-danger">блок</span> : <span className="text-ok">ок</span>}</td>
                {canDelete || canPay ? (
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {canPay ? (
                        c.paid ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (window.confirm(`Отменить оплату «${c.name}»? Бот снова попросит перевод.`)) unpay.mutate(c.id);
                            }}
                          >
                            Отменить оплату
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => {
                              if (window.confirm(`Открыть доступ «${c.name}» без скрина?`)) pay.mutate(c.id);
                            }}
                          >
                            Пополнить
                          </Button>
                        )
                      ) : null}
                      {canDelete ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => block.mutate({ id: c.id, blocked: !c.blocked })}>
                            {c.blocked ? "Разблок" : "Блок"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => remove.mutate(c.id)}>Удалить</Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
