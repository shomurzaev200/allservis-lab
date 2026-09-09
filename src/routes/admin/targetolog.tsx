import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createAdLink, exportTargetCsv, getAdLinkDetail, getSubscribeCopy, getTargetBoard, probeTelegram, saveSubscribeCopy, updateAdLink } from "@/lib/server/targetolog";
import { getBotSettings, saveRequisites, testAlerts } from "@/lib/server/api";
import { Kpi } from "@/components/admin/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccess } from "@/components/admin/access";

export const Route = createFileRoute("/admin/targetolog")({ component: Page });

type Tab = "overview" | "links" | "sources" | "funnel" | "telegram";

const SOURCES = ["instagram", "telegram", "tiktok", "youtube", "facebook", "google", "yandex", "ads"];

function Page() {
  return <TargetInner />;
}

function TargetInner() {
  const qc = useQueryClient();
  const access = useAccess();
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState("30");
  const board = useQuery({ queryKey: ["target-board", range], queryFn: () => getTargetBoard({ data: { range } }) });
  const data = board.data;
  const username = data?.username ?? "";
  const linkOf = (code: string) => (username ? `https://t.me/${username}?start=${code}` : code);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Обзор" },
    { id: "links", label: "Ссылки" },
    { id: "sources", label: "Источники" },
    { id: "funnel", label: "Воронка" },
    { id: "telegram", label: "Telegram" },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-accent">Рост</p>
          <h1 className="font-display text-2xl">Таргетолог</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Рекламные ссылки бота, откуда заявки, конверсия и проверка каналов.
            Открытый канал — только подписка. Закрытый — только алерты.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-surface p-1">
          {["7", "30", "90", "all"].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1.5 text-xs ${range === r ? "bg-accent/20 text-accent" : "text-muted"}`}
            >
              {r === "all" ? "Всё" : `${r} дн.`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-px">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-11 px-3 text-sm ${tab === t.id ? "border-b-2 border-accent text-accent" : "text-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {board.isPending ? <p className="text-sm text-muted">Считаем метрики…</p> : null}
      {board.isError ? <p className="text-sm text-danger">Не загрузилось. Обновите страницу после рестарта сервера.</p> : null}

      {tab === "overview" && data ? <Overview data={data} /> : null}
      {tab === "links" && data ? <Links data={data} linkOf={linkOf} canEdit={access.allowed("bots")} onChanged={() => void qc.invalidateQueries({ queryKey: ["target-board"] })} /> : null}
      {tab === "sources" && data ? <Sources data={data} /> : null}
      {tab === "funnel" && data ? <Funnel data={data} /> : null}
      {tab === "telegram" && <TelegramTab />}
    </div>
  );
}

function Overview({ data }: { data: NonNullable<Awaited<ReturnType<typeof getTargetBoard>>> }) {
  const k = data.kpis;
  const max = Math.max(1, ...data.bySource.map((s) => s.orders));
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Посетители" value={k.visits} hint="открыли бота по ссылке /start" />
        <Kpi label="Уникальные" value={k.unique} />
        <Kpi label="Подписчики" value={k.subscribers} tone="ok" />
        <Kpi label="Заявки" value={k.orders} tone="accent" />
        <Kpi label="Конверсия в заявку" value={`${k.conversion}%`} />
        <Kpi label="Активных ссылок" value={k.activeLinks} />
        <Kpi label="Лучшая ссылка" value={k.best} />
        <Kpi label="Слабая ссылка" value={k.worst} />
      </div>
      <section className="glass-card rounded-xl p-4">
        <h2 className="mb-3 text-sm text-muted">Заявки по источникам</h2>
        <div className="space-y-2">
          {data.bySource.map((s) => (
            <div key={s.source} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
              <span className="capitalize text-muted">{s.source}</span>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full bg-accent" style={{ width: `${Math.round((s.orders / max) * 100)}%` }} />
              </div>
              <span className="font-mono tabular-nums">{s.orders} · {s.conversion}%</span>
            </div>
          ))}
          {!data.bySource.length ? <p className="text-sm text-muted">Пока нет трафика по рекламным ссылкам. Создайте ссылку во вкладке «Ссылки».</p> : null}
        </div>
      </section>
      {data.byDay.length ? (
        <section className="glass-card rounded-xl p-4">
          <h2 className="mb-3 text-sm text-muted">По дням</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byDay}>
                <CartesianGrid stroke="rgb(34 211 238 / 0.08)" />
                <XAxis dataKey="d" stroke="#8ba0b5" fontSize={11} />
                <YAxis stroke="#8ba0b5" fontSize={11} />
                <Tooltip contentStyle={{ background: "#0d1320", border: "1px solid #1c2a3d" }} />
                <Bar dataKey="starts" fill="#8ba0b5" name="визиты" />
                <Bar dataKey="joins" fill="#34d399" name="входы" />
                <Bar dataKey="orders" fill="#22d3ee" name="заявки" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Links({
  data, linkOf, canEdit, onChanged,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getTargetBoard>>>;
  linkOf: (code: string) => string;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [source, setSource] = useState("instagram");
  const [campaign, setCampaign] = useState("");
  const [adGroup, setAdGroup] = useState("");
  const [creative, setCreative] = useState("");
  const [spend, setSpend] = useState("");
  const [copied, setCopied] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const create = useMutation({
    mutationFn: () => createAdLink({
      data: { label, source, campaign, adGroup, creative, spend: Number(spend) || 0, utmSource: source, utmCampaign: campaign, utmContent: creative },
    }),
    onSuccess: (r) => {
      if (r.ok) {
        setOpen(false); setLabel(""); setCampaign(""); setAdGroup(""); setCreative(""); setSpend("");
        onChanged();
      }
    },
  });
  const exp = useMutation({
    mutationFn: () => exportTargetCsv(),
    onSuccess: (r) => {
      const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "allservis-ads.csv";
      a.click();
    },
  });
  const detail = useQuery({
    queryKey: ["ad-link", detailId],
    queryFn: () => getAdLinkDetail({ data: { id: detailId! } }),
    enabled: detailId != null,
  });
  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(""), 1400);
  }
  const spendMut = useMutation({
    mutationFn: (p: { id: number; spend: number }) => updateAdLink({ data: p }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["target-board"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {canEdit ? (
          <Button onClick={() => setOpen((v) => !v)}>{open ? "Скрыть форму" : "+ Создать ссылку"}</Button>
        ) : null}
        <Button variant="outline" disabled={exp.isPending} onClick={() => exp.mutate()}>Экспорт CSV</Button>
      </div>
      {open ? (
        <section className="glass-card grid gap-3 rounded-xl p-5 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="text-muted">Название</span>
            <Input className="mt-1" placeholder="Instagram Реклама 1" value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="text-muted">Источник</span>
            <select className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm" value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-muted">Кампания</span>
            <Input className="mt-1" placeholder="September 2026" value={campaign} onChange={(e) => setCampaign(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="text-muted">Группа / объявление</span>
            <Input className="mt-1" placeholder="Stories" value={adGroup} onChange={(e) => setAdGroup(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="text-muted">Креатив</span>
            <Input className="mt-1" placeholder="Видео №1" value={creative} onChange={(e) => setCreative(e.target.value)} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-muted">Расход, сум (для цены заявки)</span>
            <Input className="mt-1" inputMode="numeric" placeholder="0" value={spend} onChange={(e) => setSpend(e.target.value)} />
          </label>
          <div className="sm:col-span-2">
            <Button disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "…" : "Создать"}</Button>
            {create.data?.ok ? <p className="mt-2 break-all text-sm text-ok">Ссылка: {create.data.link}</p> : null}
            {create.data && !create.data.ok ? <p className="mt-2 text-sm text-danger">{create.data.error}</p> : null}
          </div>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-3">Ссылка</th>
              <th className="px-3 py-3">Источник</th>
              <th className="px-3 py-3">Клики</th>
              <th className="px-3 py-3">Входы</th>
              <th className="px-3 py-3">Заявки</th>
              <th className="px-3 py-3">Конв.</th>
              <th className="px-3 py-3">Расход / CPA</th>
            </tr>
          </thead>
          <tbody>
            {data.links.map((c) => {
              const href = linkOf(c.code);
              return (
                <tr key={c.id} className="border-t border-border align-top">
                  <td className="px-3 py-3">
                    <button type="button" className="text-left font-medium text-accent" onClick={() => setDetailId(c.id)}>{c.label}</button>
                    <p className="mt-1 break-all font-mono text-[11px] text-muted">{href}</p>
                    <button type="button" className="text-xs text-accent underline" onClick={() => copy(href)}>{copied === href ? "скопировано" : "копировать"}</button>
                    {c.campaign || c.creative ? <p className="mt-1 text-xs text-subtle">{[c.campaign, c.ad_group, c.creative].filter(Boolean).join(" · ")}</p> : null}
                  </td>
                  <td className="px-3 py-3 capitalize">{c.source}</td>
                  <td className="px-3 py-3 font-mono">{c.clicks}</td>
                  <td className="px-3 py-3 font-mono">{c.joins}</td>
                  <td className="px-3 py-3 font-mono">{c.orders}</td>
                  <td className="px-3 py-3 font-mono">{c.conversion}%</td>
                  <td className="px-3 py-3">
                    <SpendCell spend={c.spend} cpa={c.cpa} onSave={(n) => spendMut.mutate({ id: c.id, spend: n })} />
                  </td>
                </tr>
              );
            })}
            {!data.links.length ? (
              <tr><td className="px-3 py-6 text-muted" colSpan={7}>Ссылок нет — создайте первую для Instagram / TikTok / Telegram.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {detailId != null && detail.data?.ok && detail.data.link ? (
        <section className="glass-card space-y-3 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{detail.data.link.label}</h2>
            <button type="button" className="text-sm text-muted" onClick={() => setDetailId(null)}>закрыть</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            {(["start", "click", "join", "subscribe", "order"] as const).map((k) => {
              const row = detail.data!.events.find((e) => e.kind === k);
              return (
                <div key={k} className="rounded-lg bg-surface px-3 py-2 text-sm">
                  <p className="text-xs uppercase text-muted">{k}</p>
                  <p className="font-mono text-lg">{row?.n ?? 0} <span className="text-xs text-subtle">/ {row?.uniq ?? 0} уник.</span></p>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-muted">Клиенты с этой ссылки</p>
          <ul className="space-y-1 text-sm">
            {detail.data.clients.map((c) => (
              <li key={`${c.telegram_id}-${c.created_at}`} className="flex justify-between gap-3 rounded-lg bg-surface px-3 py-2">
                <span>{c.name} · {c.phone || "без телефона"}</span>
                <span className="font-mono text-accent">{c.orders_n} заяв.</span>
              </li>
            ))}
            {!detail.data.clients.length ? <li className="text-muted">Пока никто не пришёл по этой ссылке.</li> : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SpendCell({ spend, cpa, onSave }: { spend: number; cpa: number | null; onSave: (n: number) => void }) {
  const [v, setV] = useState(String(spend || ""));
  return (
    <div className="space-y-1">
      <input
        className="h-8 w-28 rounded border border-border bg-surface px-2 font-mono text-xs"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Math.max(0, Number(v) || 0);
          if (n !== spend) onSave(n);
        }}
      />
      <p className="text-[11px] text-subtle">{cpa != null ? `CPA ${cpa.toLocaleString("ru-RU")}` : "нет заявок"}</p>
    </div>
  );
}

function Sources({ data }: { data: NonNullable<Awaited<ReturnType<typeof getTargetBoard>>> }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="bg-surface-2 text-xs uppercase text-muted">
          <tr>
            <th className="px-3 py-3">Источник</th>
            <th className="px-3 py-3">Переходы</th>
            <th className="px-3 py-3">Входы</th>
            <th className="px-3 py-3">Заявки</th>
            <th className="px-3 py-3">Конверсия</th>
          </tr>
        </thead>
        <tbody>
          {data.bySource.map((s) => (
            <tr key={s.source} className="border-t border-border">
              <td className="px-3 py-3 capitalize">{s.source}</td>
              <td className="px-3 py-3 font-mono">{s.visitors}</td>
              <td className="px-3 py-3 font-mono">{s.joins}</td>
              <td className="px-3 py-3 font-mono">{s.orders}</td>
              <td className="px-3 py-3 font-mono">{s.conversion}%</td>
            </tr>
          ))}
          {!data.bySource.length ? (
            <tr><td className="px-3 py-6 text-muted" colSpan={5}>Нет данных.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function Funnel({ data }: { data: NonNullable<Awaited<ReturnType<typeof getTargetBoard>>> }) {
  const f = data.funnel;
  const steps = [
    { label: "Визиты /start", n: f.visits },
    { label: "Уникальные", n: f.unique },
    { label: "Подписались / вошли", n: f.subscribed },
    { label: "Заявки", n: f.orders },
  ];
  const top = Math.max(1, steps[0]!.n);
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const prev = i === 0 ? s.n : steps[i - 1]!.n;
        const drop = prev ? Math.round((s.n / prev) * 1000) / 10 : 0;
        return (
          <div key={s.label} className="glass-card rounded-xl p-4">
            <div className="mb-2 flex justify-between text-sm">
              <span>{s.label}</span>
              <span className="font-mono">{s.n} {i ? `· ${drop}% от шага выше` : ""}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-accent" style={{ width: `${Math.max(4, Math.round((s.n / top) * 100))}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TelegramTab() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["bot-settings"], queryFn: () => getBotSettings() });
  const copy = useQuery({ queryKey: ["sub-copy"], queryFn: () => getSubscribeCopy() });
  const [channel, setChannel] = useState("");
  const [alerts, setAlerts] = useState("");
  const [prompt, setPrompt] = useState("");
  const [requireSub, setRequireSub] = useState(true);
  const loaded = settings.data;
  useEffect(() => {
    if (!loaded) return;
    setChannel(loaded.channel ?? "");
    setAlerts(loaded.alertsChannel ?? "");
    setRequireSub(loaded.requireSubscribe !== false);
  }, [loaded]);
  useEffect(() => {
    if (copy.data) setPrompt(copy.data.prompt);
  }, [copy.data]);

  const saveCh = useMutation({
    mutationFn: () => saveRequisites({
      data: {
        channel, requireSubscribe: requireSub, alertsChannel: alerts,
        payCard: loaded?.payCard, payBank: loaded?.payBank, payHolder: loaded?.payHolder, payAmount: loaded?.payAmount,
      },
    }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["bot-settings"] }),
  });
  const saveCopy = useMutation({
    mutationFn: () => saveSubscribeCopy({ data: { prompt } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["sub-copy"] }),
  });
  const ping = useMutation({
    mutationFn: () => testAlerts({ data: { channel: alerts } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["bot-settings"] }),
  });
  const probe = useMutation({ mutationFn: () => probeTelegram() });

  return (
    <div className="space-y-5">
      <section className="glass-card space-y-3 rounded-xl p-5">
        <h2 className="font-medium">Статус Telegram</h2>
        <p className="text-sm text-muted">Основной бот {loaded?.username ? `@${loaded.username}` : "не подключён"}. Токен меняется в <Link to="/admin/settings" className="text-accent underline">Настройках</Link>.</p>
        <Button variant="outline" disabled={probe.isPending} onClick={() => probe.mutate()}>
          {probe.isPending ? "Проверяю…" : "Проверить подключение"}
        </Button>
        {probe.data?.checks.map((c) => (
          <p key={c.key} className={`rounded-lg px-3 py-2 text-sm ${c.ok ? "bg-ok/10 text-ok" : "bg-danger/10 text-danger"}`}>
            {c.ok ? "🟢" : "🔴"} {c.key === "bot" ? "Бот" : c.key === "open" ? "Открытый канал" : "Закрытый канал"} — {c.detail}
          </p>
        ))}
        {probe.data?.openMembers != null ? <p className="text-sm text-muted">Подписчиков открытого канала: {probe.data.openMembers}</p> : null}
      </section>

      <section className="glass-card space-y-3 rounded-xl p-5">
        <h2 className="font-medium">Открытый канал — обязательная подписка</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={requireSub} onChange={(e) => setRequireSub(e.target.checked)} />
          Требовать подписку
        </label>
        <label className="block text-sm">
          <span className="text-muted">@username публичного канала</span>
          <Input className="mt-1 font-mono" placeholder="@allservic24" value={channel} onChange={(e) => setChannel(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Текст экрана подписки (можно менять)</span>
          <textarea
            className="mt-1 min-h-28 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={"🔒 Доступ закрыт\n\nПодпишитесь на канал, чтобы вызвать мастера."}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button disabled={saveCh.isPending} onClick={() => saveCh.mutate()}>{saveCh.isPending ? "…" : "Сохранить канал"}</Button>
          <Button variant="outline" disabled={saveCopy.isPending} onClick={() => saveCopy.mutate()}>{saveCopy.isPending ? "…" : "Сохранить текст"}</Button>
        </div>
        {saveCh.data?.ok || saveCopy.data?.ok ? <p className="text-sm text-ok">Сохранено</p> : null}
        {saveCh.data && !saveCh.data.ok ? <p className="text-sm text-danger">{saveCh.data.error}</p> : null}
      </section>

      <section className="glass-card space-y-3 rounded-xl p-5">
        <h2 className="font-medium">Закрытый канал — только алерты</h2>
        <p className="text-sm text-muted">Сюда заявки, отзывы, «просит связаться». Не публичный ТГК клиентов.</p>
        {loaded?.lastAlertError ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{loaded.lastAlertError}</p> : null}
        <label className="block text-sm">
          <span className="text-muted">−100… или t.me/c/…</span>
          <Input className="mt-1 font-mono" placeholder="-100…" value={alerts} onChange={(e) => setAlerts(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button disabled={saveCh.isPending} onClick={() => saveCh.mutate()}>Сохранить ID</Button>
          <Button variant="outline" disabled={ping.isPending} onClick={() => ping.mutate()}>{ping.isPending ? "…" : "Тест в закрытый канал"}</Button>
        </div>
        {ping.data?.ok ? <p className="text-sm text-ok">Тест ушёл в закрытый канал</p> : null}
        {ping.data && !ping.data.ok ? <p className="text-sm text-danger">{ping.data.error}</p> : null}
      </section>
    </div>
  );
}
