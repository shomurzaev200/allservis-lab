import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addServiceBot, dropBotToken, getBotSettings, listBots, removeServiceBot, saveBotToken } from "@/lib/server/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["bot-settings"], queryFn: () => getBotSettings() });
  const { data: bots = [] } = useQuery({ queryKey: ["bots"], queryFn: () => listBots() });
  const [token, setToken] = useState("");
  const [extraToken, setExtraToken] = useState("");
  const [extraLabel, setExtraLabel] = useState("");
  const [logToken, setLogToken] = useState("");

  const save = useMutation({
    mutationFn: () => saveBotToken({ data: { token, publicOrigin: window.location.origin } }),
    onSuccess: () => { void qc.invalidateQueries(); setToken(""); },
  });
  const drop = useMutation({
    mutationFn: () => dropBotToken(),
    onSuccess: () => qc.invalidateQueries(),
  });
  const addExtra = useMutation({
    mutationFn: () => addServiceBot({
      data: { token: extraToken, publicOrigin: window.location.origin, kind: "client", label: extraLabel || "Клиентский бот" },
    }),
    onSuccess: () => { void qc.invalidateQueries(); setExtraToken(""); setExtraLabel(""); },
  });
  const addLogs = useMutation({
    mutationFn: () => addServiceBot({
      data: { token: logToken, publicOrigin: window.location.origin, kind: "logs", label: "Логи" },
    }),
    onSuccess: () => { void qc.invalidateQueries(); setLogToken(""); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => removeServiceBot({ data: { id } }),
    onSuccess: () => qc.invalidateQueries(),
  });

  const clientBots = bots.filter((b) => b.kind === "client");
  const logBot = bots.find((b) => b.kind === "logs");

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-accent">Подключение</p>
        <h1 className="font-display text-2xl">Боты и доступ</h1>
        <p className="mt-2 text-sm text-muted">
          Основной бот — заявки клиентов. Можно добавить второй клиентский бот. Отдельный бот логов шлёт события владельцу в Telegram.
          Команда: <Link to="/admin/team" className="text-accent">Команда</Link>.
        </p>
      </div>

      <section className="glass-card space-y-4 rounded-xl p-5">
        <h2 className="font-medium">Основной бот заявок</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
          <li>Telegram → <span className="text-fg">@BotFather</span> → /newbot</li>
          <li>Вставьте токен и нажмите «Подключить бота»</li>
        </ol>
        {data?.connected ? (
          <div className="rounded-lg bg-ok/10 px-4 py-3 text-sm">
            <p className="font-medium text-ok">Подключен @{data.username}</p>
            <p className="mt-1 text-xs text-muted">Токен: {data.tokenMasked}</p>
          </div>
        ) : (
          <p className="rounded-lg bg-warn/10 px-4 py-3 text-sm text-warn">Основной бот ещё не подключён.</p>
        )}
        <label className="block text-sm">
          <span className="text-muted">Токен от BotFather</span>
          <Input className="mt-1 font-mono" type="password" autoComplete="off" placeholder="123456789:AAHxxxx"
            value={token} onChange={(e) => setToken(e.target.value)} />
        </label>
        {save.data && !save.data.ok ? <p className="text-sm text-danger">{save.data.error}</p> : null}
        {save.data?.ok ? <p className="text-sm text-ok">Готово. Бот @{save.data.username}.</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!token || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Подключаю…" : "Подключить бота"}
          </Button>
          {data?.connected ? (
            <Button variant="outline" disabled={drop.isPending} onClick={() => drop.mutate()}>Отключить</Button>
          ) : null}
        </div>
      </section>

      <section className="glass-card space-y-4 rounded-xl p-5">
        <h2 className="font-medium">Ещё один бот заявок</h2>
        <p className="text-sm text-muted">Второй канал: другой username, те же заявки в эту админку. Без автоназначения.</p>
        {clientBots.filter((b) => b.label !== "Основной").map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <span>@{b.bot_username} · {b.label}</span>
            <Button size="sm" variant="outline" onClick={() => remove.mutate(b.id)}>Удалить</Button>
          </div>
        ))}
        <Input placeholder="Название (необязательно)" value={extraLabel} onChange={(e) => setExtraLabel(e.target.value)} />
        <Input className="font-mono" type="password" autoComplete="off" placeholder="токен второго бота"
          value={extraToken} onChange={(e) => setExtraToken(e.target.value)} />
        {addExtra.data && !addExtra.data.ok ? <p className="text-sm text-danger">{addExtra.data.error}</p> : null}
        {addExtra.data?.ok ? <p className="text-sm text-ok">Подключен @{addExtra.data.username}</p> : null}
        <Button disabled={!extraToken || addExtra.isPending} onClick={() => addExtra.mutate()}>
          {addExtra.isPending ? "Подключаю…" : "Добавить бота"}
        </Button>
      </section>

      <section className="glass-card space-y-4 rounded-xl p-5">
        <h2 className="font-medium">Бот логов</h2>
        <p className="text-sm text-muted">
          Создайте отдельного бота в BotFather (например AllServisLogsBot). Подключите токен,
          затем напишите ему <span className="font-mono text-accent">/start</span> в Telegram — туда пойдут заявки, назначения, блокировки.
        </p>
        {logBot ? (
          <div className="rounded-lg bg-ok/10 px-4 py-3 text-sm">
            <p className="font-medium text-ok">@{logBot.bot_username}</p>
            <p className="mt-1 text-xs text-muted">
              {logBot.log_chat_id ? "Чат логов привязан. События уходят в Telegram." : "Напишите боту /start, чтобы привязать чат."}
            </p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => remove.mutate(logBot.id)}>Отключить лог-бота</Button>
          </div>
        ) : null}
        <Input className="font-mono" type="password" autoComplete="off" placeholder="токен лог-бота"
          value={logToken} onChange={(e) => setLogToken(e.target.value)} />
        {addLogs.data && !addLogs.data.ok ? <p className="text-sm text-danger">{addLogs.data.error}</p> : null}
        {addLogs.data?.ok ? <p className="text-sm text-ok">Лог-бот @{addLogs.data.username}. Напишите ему /start.</p> : null}
        <Button disabled={!logToken || addLogs.isPending} onClick={() => addLogs.mutate()}>
          {addLogs.isPending ? "Подключаю…" : "Подключить бота логов"}
        </Button>
      </section>
    </div>
  );
}
