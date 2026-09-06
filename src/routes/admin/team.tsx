import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteStaff, getAccess, inviteStaff, listStaff, setStaffBlocked } from "@/lib/server/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/team")({ component: TeamPage });

function TeamPage() {
  const qc = useQueryClient();
  const { data: access } = useQuery({ queryKey: ["access"], queryFn: () => getAccess() });
  const { data = [], isPending } = useQuery({ queryKey: ["staff"], queryFn: () => listStaff() });
  const [email, setEmail] = useState("");
  const invite = useMutation({
    mutationFn: () => inviteStaff({ data: { email, role: "admin" } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["staff"] }); setEmail(""); },
  });
  const block = useMutation({
    mutationFn: (p: { id: number; blocked: boolean }) => setStaffBlocked({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteStaff({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });
  const owner = access?.role === "owner";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-accent">Доступ</p>
        <h1 className="font-display text-2xl">Команда</h1>
        <p className="mt-2 text-sm text-muted">
          Владелец выдаёт доступ. Сотрудник регистрируется тем же email и попадает в эту админку.
          Вы: {access?.email ?? "…"} · {access?.role === "owner" ? "владелец" : "админ"}
        </p>
      </div>

      {owner ? (
        <section className="glass-card space-y-3 rounded-xl p-5">
          <h2 className="font-medium">Пригласить администратора</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="email" placeholder="email@компания.uz" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button disabled={!email || invite.isPending} onClick={() => invite.mutate()}>
              {invite.isPending ? "Добавляю…" : "Выдать доступ"}
            </Button>
          </div>
          {invite.data && !invite.data.ok ? <p className="text-sm text-danger">{invite.data.error}</p> : null}
          {invite.data?.ok ? <p className="text-sm text-ok">Доступ выдан. Пусть человек создаст аккаунт с этим email.</p> : null}
        </section>
      ) : (
        <p className="rounded-lg bg-warn/10 px-4 py-3 text-sm text-warn">Только владелец может выдавать и забирать доступ.</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Имя</th>
              <th className="px-3 py-3">Роль</th>
              <th className="px-3 py-3">Статус</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {isPending ? <tr><td className="px-3 py-6 text-muted" colSpan={5}>Загрузка…</td></tr> : null}
            {data.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-3 py-3 font-mono text-xs">{s.email}</td>
                <td className="px-3 py-3">{s.name || "—"}</td>
                <td className="px-3 py-3">{s.role === "owner" ? "Владелец" : "Админ"}</td>
                <td className="px-3 py-3">
                  {s.blocked ? <span className="text-danger">блок</span> : s.user_id ? <span className="text-ok">активен</span> : <span className="text-warn">ждёт вход</span>}
                </td>
                <td className="px-3 py-3">
                  {owner && s.role !== "owner" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => block.mutate({ id: s.id, blocked: !s.blocked })}>
                        {s.blocked ? "Разблок" : "Блок"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => remove.mutate(s.id)}>Удалить</Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
