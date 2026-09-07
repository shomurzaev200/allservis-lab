import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addServiceBot, dropBotToken, getBotSettings, listBots, removeServiceBot, saveBotToken, saveRequisites, testAlerts } from "@/lib/server/api";
import { NeedPerm } from "@/components/admin/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <NeedPerm perm="bots">
      <SettingsInner />
    </NeedPerm>
  );
}

function SettingsInner() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["bot-settings"], queryFn: () => getBotSettings() });
  const { data: bots = [] } = useQuery({ queryKey: ["bots"], queryFn: () => listBots() });
  const [token, setToken] = useState("");
  const [extraToken, setExtraToken] = useState("");
  const [extraLabel, setExtraLabel] = useState("");
  const [logToken, setLogToken] = useState("");
  const [channel, setChannel] = useState("");
  const [requireSubscribe, setRequireSubscribe] = useState(true);
  const [payCard, setPayCard] = useState("");
  const [payBank, setPayBank] = useState("");
  const [payHolder, setPayHolder] = useState("");
  const [payAmount, setPayAmount] = useState("0");
  const [alertsChannel, setAlertsChannel] = useState("");

  useEffect(() => {
    if (!data) return;
    setChannel(data.channel ?? "");
    setRequireSubscribe(data.requireSubscribe !== false);
    setPayCard(data.payCard ?? "");
    setPayBank(data.payBank ?? "");
    setPayHolder(data.payHolder ?? "");
    setPayAmount(String(data.payAmount ?? 0));
    setAlertsChannel(data.alertsChannel ?? "");
  }, [data]);

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
    mutationFn: async () => {
      const bot = await addServiceBot({
        data: { token: logToken, publicOrigin: window.location.origin, kind: "logs", label: "Алерты" },
      });
      if (bot.ok && alertsChannel.trim()) {
        await saveRequisites({
          data: { channel, requireSubscribe, payCard, payBank, payHolder, payAmount: Number(payAmount) || 0, alertsChannel },
        });
      }
      return bot;
    },
    onSuccess: () => { void qc.invalidateQueries(); setLogToken(""); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => removeServiceBot({ data: { id } }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const reqs = useMutation({
    mutationFn: () => saveRequisites({
      data: { channel, requireSubscribe, payCard, payBank, payHolder, payAmount: Number(payAmount) || 0, alertsChannel },
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bot-settings"] }),
  });
  const ping = useMutation({
    mutationFn: () => testAlerts({ data: { channel: alertsChannel } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bot-settings"] }),
  });
  const unbind = useMutation({
    mutationFn: () => saveRequisites({
      data: { channel, requireSubscribe, payCard, payBank, payHolder, payAmount: Number(payAmount) || 0, alertsChannel: "" },
    }),
    onSuccess: () => {
      setAlertsChannel("");
      void qc.invalidateQueries({ queryKey: ["bot-settings"] });
    },
  });

  const clientBots = bots.filter((b) => b.kind === "client");
  const logBot = bots.find((b) => b.kind === "logs");

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-accent">Подключение</p>
        <h1 className="font-display text-2xl">Боты, реквизиты, канал</h1>
        <p className="mt-2 text-sm text-muted">
          Основной бот — заявки. HTTPS не обязателен: на HTTP сервере бот работает через polling.
          Команда: <Link to="/admin/team" className="text-accent">Команда</Link>. Оплаты:{" "}
          <Link to="/admin/payments" className="text-accent">Пополнения</Link>.
        </p>
      </div>

      <section className="glass-card space-y-4 rounded-xl p-5">
        <h2 className="font-medium">Основной бот заявок</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
          <li>Telegram → <span className="text-fg">@BotFather</span> → /newbot (например AllServisTashkentBot)</li>
          <li>Скопируйте токен вида <span className="font-mono text-fg">123456789:AAHxxxx</span></li>
          <li>Вставьте сюда и нажмите «Подключить бота». В .env токен класть не нужно.</li>
          <li>Откройте бота в Telegram и напишите /start</li>
        </ol>
        {data?.connected ? (
          <div className="rounded-lg bg-ok/10 px-4 py-3 text-sm">
            <p className="font-medium text-ok">Подключен @{data.username}</p>
            <p className="mt-1 text-xs text-muted">Токен: {data.tokenMasked}</p>
            <p className="mt-1 text-xs text-muted">
              Режим: {data.pollMode ? "polling (HTTP, без домена — так и должно быть)" : "webhook HTTPS"}
            </p>
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
        {save.data?.ok ? (
          <p className="text-sm text-ok">
            Готово. Бот @{save.data.username}
            {save.data.mode === "polling" ? " работает без HTTPS (polling)." : "."}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!token || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Подключаю…" : "Подключить бота"}
          </Button>
          {data?.connected ? (
            <Button variant="outline" disabled={drop.isPending} onClick={() => drop.mutate()}>Отключить</Button>
          ) : null}
        </div>
      </section>

      <section className="glass-card space-y-4 rounded-xl border border-accent/30 p-5">
        <h2 className="font-medium">Алерты — только закрытый канал отчётов</h2>
        <p className="text-sm text-muted">
          Сюда идут заявки и кто что нажал. <span className="text-fg">Публичный канал подписки клиентов — не сюда</span>.
          Если отчёты видны клиентам — канал привязан неправильно: нажмите «Не слать алерты в канал», затем перешлите боту пост из закрытого канала.
        </p>
        {data?.lastAlertError ? (
          <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">Ошибка: {data.lastAlertError}</p>
        ) : data?.alertsChannel ? (
          <p className="rounded-lg bg-ok/10 px-4 py-3 text-sm text-ok">Канал отчётов: {data.alertsChannel}</p>
        ) : (
          <p className="rounded-lg bg-warn/10 px-4 py-3 text-sm text-warn">Канал ещё не привязан — алерты в канал не уходят.</p>
        )}
        {logBot ? (
          <p className="text-xs text-muted">Доп. бот алертов: @{logBot.bot_username} · {logBot.log_chat_id || "без чата"}</p>
        ) : null}
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Создайте <span className="text-fg">отдельный закрытый канал</span> только для себя (не тот, на который подписываются клиенты)</li>
          <li>Админы → тот же @{data?.username || "бот"} что в блоке «Основной бот» → «Публикация сообщений»</li>
          <li>Перешлите боту пост из этого закрытого канала — или вставьте −100… / t.me/c/…</li>
        </ol>
        <label className="block text-sm">
          <span className="text-muted">Закрытый канал отчётов (t.me/c/… / -100…), не @публичный</span>
          <Input className="mt-1 font-mono" placeholder="https://t.me/c/1234567890 или -100…" value={alertsChannel} onChange={(e) => setAlertsChannel(e.target.value)} />
        </label>
        {logBot ? (
          <Button size="sm" variant="outline" onClick={() => remove.mutate(logBot.id)}>Отключить доп. бота алертов</Button>
        ) : null}
        <label className="block text-sm">
          <span className="text-muted">Необязательно: токен отдельного бота алертов</span>
          <Input className="mt-1 font-mono" type="password" autoComplete="off" placeholder="только если нужен второй бот"
            value={logToken} onChange={(e) => setLogToken(e.target.value)} />
        </label>
        {addLogs.data && !addLogs.data.ok ? <p className="text-sm text-danger">{addLogs.data.error}</p> : null}
        {addLogs.data?.ok ? <p className="text-sm text-ok">Бот алертов @{addLogs.data.username} подключён.</p> : null}
        {unbind.data?.ok ? <p className="text-sm text-ok">Алерты в канал отключены. Публичный канал больше не получит отчёты.</p> : null}
        {reqs.data && !reqs.data.ok ? <p className="text-sm text-danger">{reqs.data.error}</p> : null}
        {ping.data?.ok ? <p className="text-sm text-ok">Тест доставлен в канал отчётов.</p> : null}
        {ping.data && !ping.data.ok ? <p className="text-sm text-danger">{ping.data.error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!alertsChannel || ping.isPending} onClick={() => ping.mutate()}>
            {ping.isPending ? "Шлю тест…" : "Проверить канал отчётов"}
          </Button>
          <Button variant="outline" disabled={unbind.isPending || reqs.isPending} onClick={() => unbind.mutate()}>
            {unbind.isPending ? "Отвязываю…" : "Не слать алерты в канал"}
          </Button>
          {logToken ? (
            <Button variant="outline" disabled={addLogs.isPending} onClick={() => addLogs.mutate()}>
              {addLogs.isPending ? "Подключаю…" : "Подключить доп. бота"}
            </Button>
          ) : null}
        </div>
      </section>

      <section className="glass-card space-y-4 rounded-xl border border-accent/30 p-5">
        <h2 className="font-medium">Обязательная подписка на ваш ТГК</h2>
        <p className="text-sm text-muted">
          После /start клиент <span className="text-fg">не пойдёт дальше</span>, пока не подпишется. Основной бот должен быть
          админом этого канала — иначе Telegram не скажет, подписан человек или нет.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={requireSubscribe} onChange={(e) => setRequireSubscribe(e.target.checked)} />
          Требовать подписку (включите)
        </label>
        <label className="block text-sm">
          <span className="text-muted">Публичный канал клиентов: @username или https://t.me/имя</span>
          <Input className="mt-1 font-mono" placeholder="@allservis_uz или https://t.me/allservis_uz" value={channel} onChange={(e) => setChannel(e.target.value)} />
        </label>
        <p className="text-xs text-muted">
          Сюда — только канал, на который должны подписаться клиенты. Закрытый канал алертов (−100…) сюда не вставляйте.
        </p>
        {reqs.data?.ok ? <p className="text-sm text-ok">Сохранено. Напишите боту /start с другого аккаунта — первым экраном будет «Подпишитесь».</p> : null}
        <Button disabled={!channel.trim() || reqs.isPending} onClick={() => reqs.mutate()}>
          {reqs.isPending ? "Сохраняю…" : "Включить обязательную подписку"}
        </Button>
      </section>

      <section className="glass-card space-y-4 rounded-xl p-5">
        <h2 className="font-medium">Реквизиты оплаты</h2>
        <p className="text-sm text-muted">
          Если указать карту или сумму — клиент должен прислать скрин перевода, пока вы не подтвердите в «Пополнения».
        </p>
        <label className="block text-sm">
          <span className="text-muted">Банк</span>
          <Input className="mt-1" placeholder="Uzcard / Humo / Click" value={payBank} onChange={(e) => setPayBank(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Номер карты</span>
          <Input className="mt-1 font-mono" placeholder="8600 **** **** 1234" value={payCard} onChange={(e) => setPayCard(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Получатель</span>
          <Input className="mt-1" placeholder="Имя на карте" value={payHolder} onChange={(e) => setPayHolder(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Сумма пополнения, сум (0 = не требовать оплату)</span>
          <Input className="mt-1" inputMode="numeric" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
        </label>
        {reqs.data?.ok ? <p className="text-sm text-ok">Сохранено.</p> : null}
        <Button disabled={reqs.isPending} onClick={() => reqs.mutate()}>
          {reqs.isPending ? "Сохраняю…" : "Сохранить реквизиты"}
        </Button>
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
    </div>
  );
}

