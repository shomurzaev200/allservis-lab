import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRefLink, listRefLinks } from "@/lib/server/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/refs")({ component: RefsPage });

function RefsPage() {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["refs"], queryFn: () => listRefLinks() });
  const [label, setLabel] = useState("");
  const [source, setSource] = useState("instagram");
  const [copied, setCopied] = useState("");
  const create = useMutation({
    mutationFn: () => createRefLink({ data: { label, source } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["refs"] }); setLabel(""); },
  });
  const username = data?.username ?? "";
  const linkOf = (code: string) => (username ? `https://t.me/${username}?start=${code}` : code);
  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(""), 1500);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-accent">Рост</p>
        <h1 className="font-display text-2xl">Рефералы и реклама</h1>
        <p className="mt-2 text-sm text-muted">
          У каждого клиента своя ссылка в боте (кнопка «Друзья» или /ref). Здесь — кампании: Instagram, Telegram, флаеры.
          Клики / входы / заявки показывают, откуда идёт трафик.
        </p>
      </div>

      <section className="glass-card space-y-3 rounded-xl p-5">
        <h2 className="font-medium">Новая рекламная ссылка</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input placeholder="Instagram апрель" value={label} onChange={(e) => setLabel(e.target.value)} />
          <select
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="instagram">Instagram</option>
            <option value="telegram">Telegram</option>
            <option value="facebook">Facebook</option>
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="ads">Другая реклама</option>
          </select>
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "…" : "Создать"}
          </Button>
        </div>
        {create.data?.ok ? (
          <p className="break-all text-sm text-ok">
            Ссылка: {create.data.link}{" "}
            <button type="button" className="underline" onClick={() => copy(create.data!.link)}>копировать</button>
          </p>
        ) : null}
        {create.data && !create.data.ok ? <p className="text-sm text-danger">{create.data.error}</p> : null}
        {!username ? <p className="text-sm text-warn">Сначала подключите основного бота — тогда ссылки станут t.me/…</p> : null}
      </section>

      <section>
        <h2 className="mb-2 text-sm text-muted">Откуда приходят</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {(data?.bySource ?? []).map((s) => (
            <div key={s.source} className="rounded-lg bg-surface px-3 py-2 text-sm">
              <p className="text-xs uppercase text-muted">{s.source}</p>
              <p className="font-mono text-lg text-accent">{s.n}</p>
            </div>
          ))}
          {!isPending && !(data?.bySource ?? []).length ? <p className="text-sm text-muted">Пока пусто.</p> : null}
        </div>
      </section>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-3">Кампания</th>
              <th className="px-3 py-3">Источник</th>
              <th className="px-3 py-3">Ссылка</th>
              <th className="px-3 py-3">Клики</th>
              <th className="px-3 py-3">Входы</th>
              <th className="px-3 py-3">Заявки</th>
            </tr>
          </thead>
          <tbody>
            {(data?.campaigns ?? []).map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-3">{c.label}</td>
                <td className="px-3 py-3">{c.source}</td>
                <td className="px-3 py-3 font-mono text-xs break-all">
                  {linkOf(c.code)}{" "}
                  <button type="button" className="text-accent underline" onClick={() => copy(linkOf(c.code))}>
                    {copied === linkOf(c.code) ? "скопировано" : "копировать"}
                  </button>
                </td>
                <td className="px-3 py-3">{c.clicks}</td>
                <td className="px-3 py-3">{c.joins}</td>
                <td className="px-3 py-3">{c.orders}</td>
              </tr>
            ))}
            {!isPending && !(data?.campaigns ?? []).length ? (
              <tr><td className="px-3 py-6 text-muted" colSpan={6}>Кампаний нет — создайте первую.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <section>
        <h2 className="mb-2 text-sm text-muted">Топ пригласивших (личные ссылки клиентов)</h2>
        <ol className="space-y-1">
          {(data?.people ?? []).map((p, i) => (
            <li key={p.ref_code} className="flex justify-between rounded-lg bg-surface px-3 py-2 text-sm">
              <span>{i + 1}. {p.name} · {p.ref_code}</span>
              <span className="font-mono text-accent">{p.invited}</span>
            </li>
          ))}
          {!(data?.people ?? []).length ? <p className="text-sm text-muted">Пока никто не привёл друзей.</p> : null}
        </ol>
      </section>
    </div>
  );
}
