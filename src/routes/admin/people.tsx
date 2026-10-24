import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listBotPeople } from "@/lib/server/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/people")({ component: PeoplePage });

type Filter = "all" | "client" | "master" | "open";

function PeoplePage() {
  const { data = [], isPending } = useQuery({ queryKey: ["bot-people"], queryFn: () => listBotPeople() });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.filter((p) => {
      if (filter === "client" && p.role === "master") return false;
      if (filter === "master" && p.role === "client") return false;
      if (filter === "open" && p.stage === "зарегистрирован") return false;
      if (!needle) return true;
      return `${p.name} ${p.username} ${p.telegramId} ${p.phone} ${p.place} ${p.specialization}`.toLowerCase().includes(needle);
    });
  }, [data, q, filter]);
  const masters = data.filter((p) => p.role !== "client").length;
  const clients = data.filter((p) => p.role !== "master").length;
  const open = data.filter((p) => p.stage !== "зарегистрирован").length;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Кто нажал /start</h1>
          <p className="text-sm text-muted">
            Все диалоги с ботом: клиент или мастер, что уже заполнили и где остановились.
            Сейчас {data.length}: клиентов {clients}, мастеров {masters}, не закончили {open}.
          </p>
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, телефон, Telegram" className="max-w-xs" />
      </div>
      <div className="flex flex-wrap gap-2">
        {([
          ["all", "Все"],
          ["client", "Клиенты"],
          ["master", "Мастера"],
          ["open", "Не закончили"],
        ] as const).map(([id, label]) => (
          <Button key={id} size="sm" variant={filter === id ? "default" : "outline"} onClick={() => setFilter(id)}>
            {label}
          </Button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[72rem] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-3">Кто</th>
              <th className="px-3 py-3">Роль</th>
              <th className="px-3 py-3">Регистрация</th>
              <th className="px-3 py-3">Телефон</th>
              <th className="px-3 py-3">Район</th>
              <th className="px-3 py-3">Ещё</th>
              <th className="px-3 py-3">Был</th>
            </tr>
          </thead>
          <tbody>
            {isPending ? <tr><td className="px-3 py-6 text-muted" colSpan={7}>Загрузка…</td></tr> : null}
            {!isPending && rows.length === 0 ? <tr><td className="px-3 py-6 text-muted" colSpan={7}>Пока никто не нажал /start.</td></tr> : null}
            {rows.map((p) => (
              <tr key={p.telegramId} className="border-t border-border align-top">
                <td className="px-3 py-3">
                  <p>{p.name}</p>
                  <p className="font-mono text-[11px] text-subtle">{p.username || "без @username"} · {p.telegramId}</p>
                </td>
                <td className="px-3 py-3">{p.role === "both" ? "мастер и клиент" : p.role === "master" ? "мастер" : "клиент"}</td>
                <td className="px-3 py-3">
                  <p className={p.stage === "зарегистрирован" ? "text-ok" : "text-warn"}>{p.stage}</p>
                  <p className="text-xs text-muted">{p.step}</p>
                </td>
                <td className="px-3 py-3 font-mono text-xs">{p.phone || "—"}</td>
                <td className="px-3 py-3 text-xs">{p.place || "—"}{p.lang ? ` · ${p.lang}` : ""}</td>
                <td className="px-3 py-3 text-xs">
                  {p.role === "client" ? (
                    <p>заявок {p.orders}{p.paid ? " · оплачен" : ""}{p.blocked ? " · блок" : ""}{p.ref ? ` · реф ${p.ref}` : ""}</p>
                  ) : (
                    <p>{p.specialization || "специализация не указана"}{p.online ? ` · ${p.online}` : ""}{p.role === "both" ? ` · заявок ${p.orders}` : ""}</p>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-muted">{p.seenAt ? new Date(p.seenAt).toLocaleString("ru") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
