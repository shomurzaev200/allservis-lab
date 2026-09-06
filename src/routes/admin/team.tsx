import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteStaff, getAccess, inviteStaff, listStaff, setStaffBlocked, setStaffPerms } from "@/lib/server/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/team")({ component: TeamPage });

function TeamPage() {
  const qc = useQueryClient();
  const { data: access } = useQuery({ queryKey: ["access"], queryFn: () => getAccess() });
  const { data = [], isPending } = useQuery({ queryKey: ["staff"], queryFn: () => listStaff() });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState(false);
  const [del, setDel] = useState(true);
  const [assign, setAssign] = useState(true);
  const [finance, setFinance] = useState(false);
  const [bots, setBots] = useState(false);
  const add = useMutation({
    mutationFn: () => inviteStaff({
      data: { email, name, password, can_invite: invite, can_delete: del, can_assign: assign, can_finance: finance, can_bots: bots },
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["staff"] }); setEmail(""); setName(""); setPassword(""); },
  });
  const block = useMutation({
    mutationFn: (p: { id: number; blocked: boolean }) => setStaffBlocked({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteStaff({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });
  const perms = useMutation({
    mutationFn: (p: { id: number; can_invite: boolean; can_delete: boolean; can_assign: boolean; can_finance: boolean; can_bots: boolean }) =>
      setStaffPerms({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });
  const owner = access?.role === "owner";
  const canInvite = owner || Boolean(access?.perms?.invite);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-accent">Доступ</p>
        <h1 className="font-display text-2xl">Команда</h1>
        <p className="mt-2 text-sm text-muted">
          Только владелец добавляет людей, пока не выдаст право «приглашать». Логин = email, пароль задаёте вы.
          Вы: {access?.email ?? "…"} · {owner ? "владелец" : "админ"}
        </p>
      </div>

      {canInvite ? (
        <section className="glass-card space-y-3 rounded-xl p-5">
          <h2 className="font-medium">Выдать доступ</h2>
          <Input type="email" placeholder="email@компания.uz" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="password" placeholder="Пароль (мин. 8 символов)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {owner ? (
              <label className="flex items-center gap-2"><input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} />Может приглашать других</label>
            ) : null}
            <label className="flex items-center gap-2"><input type="checkbox" checked={del} onChange={(e) => setDel(e.target.checked)} />Удалять клиентов/мастеров</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={assign} onChange={(e) => setAssign(e.target.checked)} />Назначать мастеров</label>
            {owner ? (
              <label className="flex items-center gap-2"><input type="checkbox" checked={finance} onChange={(e) => setFinance(e.target.checked)} />Финансы / пополнения</label>
            ) : null}
            {owner ? (
              <label className="flex items-center gap-2"><input type="checkbox" checked={bots} onChange={(e) => setBots(e.target.checked)} />Боты и настройки</label>
            ) : null}
          </div>
          <Button disabled={!email || password.length < 8 || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? "Добавляю…" : "Выдать доступ"}
          </Button>
          {add.data && !add.data.ok ? <p className="text-sm text-danger">{add.data.error}</p> : null}
          {add.data?.ok ? <p className="text-sm text-ok">Готово. Сотрудник входит на /login этим email и паролем.</p> : null}
        </section>
      ) : (
        <p className="rounded-lg bg-warn/10 px-4 py-3 text-sm text-warn">Добавлять пользователей может только владелец, либо админ с правом «приглашать».</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Права</th>
              <th className="px-3 py-3">Статус</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {isPending ? <tr><td className="px-3 py-6 text-muted" colSpan={4}>Загрузка…</td></tr> : null}
            {data.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-3 py-3">
                  <p className="font-mono text-xs">{s.email}</p>
                  <p className="text-xs text-muted">{s.name || "—"} · {s.role === "owner" ? "владелец" : "админ"}</p>
                </td>
                <td className="px-3 py-3 text-xs">
                  {s.role === "owner" ? <span className="text-muted">все права</span> : owner ? (
                    <div className="flex flex-col gap-1">
                      {([
                        ["can_invite", "приглашать", s.can_invite],
                        ["can_delete", "удалять", s.can_delete],
                        ["can_assign", "назначать", s.can_assign],
                        ["can_finance", "финансы", s.can_finance],
                        ["can_bots", "боты", s.can_bots],
                      ] as const).map(([key, label, on]) => (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => perms.mutate({
                              id: s.id,
                              can_invite: key === "can_invite" ? !s.can_invite : s.can_invite,
                              can_delete: key === "can_delete" ? !s.can_delete : s.can_delete,
                              can_assign: key === "can_assign" ? !s.can_assign : s.can_assign,
                              can_finance: key === "can_finance" ? !s.can_finance : s.can_finance,
                              can_bots: key === "can_bots" ? !s.can_bots : s.can_bots,
                            })}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted">
                      {s.can_invite ? "приглашать " : ""}
                      {s.can_delete ? "удалять " : ""}
                      {s.can_assign ? "назначать " : ""}
                      {s.can_finance ? "финансы " : ""}
                      {s.can_bots ? "боты" : ""}
                    </span>
                  )}
                </td>
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
