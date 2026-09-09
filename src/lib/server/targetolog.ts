import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { actorCtx, requireAdmin, can } from "./access";
import { probeTelegramHealth } from "./telegram";
import { pct, cpa } from "./refs";
import { addAudit } from "./workspace";

const NO_PERM = "Недостаточно прав";

async function ctxSql(userId: string) {
  return actorCtx(userId);
}

function sinceDate(range: string) {
  const days = range === "7" ? 7 : range === "90" ? 90 : range === "all" ? 0 : 30;
  if (!days) return "1970-01-01T00:00:00.000Z";
  return new Date(Date.now() - days * 86400000).toISOString();
}

export type AdLinkRow = {
  id: number; code: string; label: string; source: string;
  campaign: string; ad_group: string; creative: string;
  utm_source: string; utm_medium: string; utm_campaign: string; utm_content: string; utm_term: string;
  spend: number; active: boolean; notes: string;
  clicks: number; joins: number; orders: number; created_at: string;
  conversion: number; cpa: number | null; cpc: number | null;
};

export const getTargetBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d?: { range?: string }) => d ?? {})
  .handler(async ({ context, data }) => {
    const { sql, uid } = await ctxSql(context.userId);
    const range = data.range || "30";
    const since = sinceDate(range);
    const ws = await sql<{ bot_username: string | null }>`select bot_username from as_workspace where user_id = ${uid}`;
    const username = (ws[0]?.bot_username ?? "").replace(/^@/, "");

    let links: AdLinkRow[] = [];
    try {
      const rows = await sql<{
        id: number; code: string; label: string; source: string;
        campaign: string; ad_group: string; creative: string;
        utm_source: string; utm_medium: string; utm_campaign: string; utm_content: string; utm_term: string;
        spend: number; active: boolean; notes: string;
        clicks: number; joins: number; orders: number; created_at: string;
      }>`
        select id, code, label, source,
          coalesce(campaign, '') as campaign, coalesce(ad_group, '') as ad_group, coalesce(creative, '') as creative,
          coalesce(utm_source, '') as utm_source, coalesce(utm_medium, '') as utm_medium,
          coalesce(utm_campaign, '') as utm_campaign, coalesce(utm_content, '') as utm_content,
          coalesce(utm_term, '') as utm_term, coalesce(spend, 0)::float as spend,
          coalesce(active, true) as active, coalesce(notes, '') as notes,
          clicks, joins, orders, created_at
        from as_ref_links where user_id = ${uid} order by created_at desc
      `;
      links = rows.map((r) => ({
        ...r,
        spend: Number(r.spend) || 0,
        conversion: pct(r.orders, r.clicks || r.joins),
        cpa: cpa(Number(r.spend) || 0, r.orders),
        cpc: cpa(Number(r.spend) || 0, r.clicks),
      }));
    } catch {
      const rows = await sql<{
        id: number; code: string; label: string; source: string;
        clicks: number; joins: number; orders: number; created_at: string;
      }>`
        select id, code, label, source, clicks, joins, orders, created_at
        from as_ref_links where user_id = ${uid} order by created_at desc
      `;
      links = rows.map((r) => ({
        ...r, campaign: "", ad_group: "", creative: "", utm_source: "", utm_medium: "",
        utm_campaign: "", utm_content: "", utm_term: "", spend: 0, active: true, notes: "",
        conversion: pct(r.orders, r.clicks || r.joins), cpa: null, cpc: null,
      }));
    }

    let visits = 0;
    let unique = 0;
    let subs = 0;
    let eventOrders = 0;
    try {
      const ev = await sql<{ kind: string; n: number; uniq: number }>`
        select kind, count(*)::int as n, count(distinct telegram_id)::int as uniq
        from as_ref_events
        where user_id = ${uid} and created_at >= ${since}
        group by kind
      `;
      const pick = (k: string) => ev.find((x) => x.kind === k);
      visits = pick("start")?.n ?? pick("click")?.n ?? 0;
      unique = pick("start")?.uniq ?? pick("click")?.uniq ?? 0;
      subs = pick("subscribe")?.uniq ?? pick("join")?.uniq ?? 0;
      eventOrders = pick("order")?.n ?? 0;
    } catch { /* until migrate */ }

    const clients = await sql<{ n: number }>`
      select count(*)::int as n from as_clients
      where user_id = ${uid} and name <> ${"Удалён"} and length(coalesce(telegram_id, '')) >= 8
        and created_at >= ${since}
    `;
    const ordersN = await sql<{ n: number }>`
      select count(*)::int as n from as_orders where user_id = ${uid} and created_at >= ${since}
    `;
    const allClients = clients[0]?.n ?? 0;
    const allOrders = ordersN[0]?.n ?? eventOrders;

    let bySource: { source: string; visitors: number; joins: number; orders: number; conversion: number }[] = [];
    try {
      const rows = await sql<{ source: string; visitors: number; joins: number; orders: number }>`
        select coalesce(nullif(l.source, ''), 'organic') as source,
          coalesce(sum(l.clicks), 0)::int as visitors,
          coalesce(sum(l.joins), 0)::int as joins,
          coalesce(sum(l.orders), 0)::int as orders
        from as_ref_links l
        where l.user_id = ${uid}
        group by 1 order by orders desc, visitors desc
      `;
      bySource = rows.map((r) => ({ ...r, conversion: pct(r.orders, r.visitors || r.joins) }));
    } catch { bySource = []; }

    let organicOrders = 0;
    try {
      const og = await sql<{ n: number }>`
        select count(*)::int as n from as_orders o
        join as_clients c on c.id = o.client_id
        where o.user_id = ${uid} and o.created_at >= ${since}
          and (c.referred_by is null or c.referred_by = '' or c.ref_source is null)
      `;
      organicOrders = og[0]?.n ?? 0;
    } catch { /* ignore */ }

    let byDay: { d: string; starts: number; joins: number; orders: number }[] = [];
    try {
      byDay = await sql`
        select to_char(date_trunc('day', created_at), 'MM-DD') as d,
          count(*) filter (where kind in ('start','click'))::int as starts,
          count(*) filter (where kind in ('join','subscribe'))::int as joins,
          count(*) filter (where kind = 'order')::int as orders
        from as_ref_events
        where user_id = ${uid} and created_at >= ${since}
        group by 1 order by min(created_at)
      `;
    } catch { byDay = []; }

    const ranked = [...links].filter((l) => l.clicks + l.orders > 0).sort((a, b) => b.conversion - a.conversion);
    const best = ranked[0] ?? null;
    const worst = ranked.length > 1 ? ranked[ranked.length - 1]! : null;

    const funnel = {
      visits: visits || links.reduce((s, l) => s + l.clicks, 0),
      unique: unique || allClients,
      subscribed: subs || allClients,
      orders: allOrders,
    };

    return {
      username,
      range,
      kpis: {
        visits: funnel.visits,
        unique: funnel.unique,
        subscribers: funnel.subscribed,
        orders: funnel.orders,
        conversion: pct(funnel.orders, funnel.unique || funnel.visits),
        activeLinks: links.filter((l) => l.active !== false).length,
        best: best ? `${best.label} · ${best.conversion}%` : "—",
        worst: worst ? `${worst.label} · ${worst.conversion}%` : "—",
      },
      links,
      bySource: organicOrders
        ? [...bySource, { source: "organic", visitors: 0, joins: 0, orders: organicOrders, conversion: 0 }]
        : bySource,
      byDay,
      funnel,
    };
  });

export const getAdLinkDetail = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { id: number }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid } = await ctxSql(context.userId);
    const link = await sql<AdLinkRow>`
      select id, code, label, source, clicks, joins, orders, created_at from as_ref_links
      where user_id = ${uid} and id = ${data.id} limit 1
    `;
    if (!link[0]) return { ok: false as const, error: "Ссылка не найдена", link: null, events: [], clients: [] };
    let events: { kind: string; n: number; uniq: number }[] = [];
    try {
      events = await sql`
        select kind, count(*)::int as n, count(distinct telegram_id)::int as uniq
        from as_ref_events where user_id = ${uid} and code = ${link[0].code}
        group by kind
      `;
    } catch { events = []; }
    const clients = await sql<{ name: string; phone: string; telegram_id: string | null; orders_n: number; created_at: string }>`
      select c.name, c.phone, c.telegram_id, count(o.id)::int as orders_n, c.created_at::text as created_at
      from as_clients c
      left join as_orders o on o.client_id = c.id
      where c.user_id = ${uid} and c.referred_by = ${link[0].code}
      group by c.id, c.name, c.phone, c.telegram_id, c.created_at
      order by c.created_at desc limit 40
    `;
    return { ok: true as const, error: null as string | null, link: link[0], events, clients };
  });

export type NewAdLink = {
  label: string; source: string; campaign?: string; adGroup?: string; creative?: string;
  utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string; utmTerm?: string;
  spend?: number; notes?: string;
};

export const createAdLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: NewAdLink) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "bots")) return { ok: false as const, code: "", link: "", error: NO_PERM };
    const label = data.label.trim() || "Реклама";
    const source = (data.source || "ads").trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24) || "ads";
    const code = `c${Math.random().toString(36).slice(2, 8)}`;
    const spend = Math.max(0, Number(data.spend) || 0);
    try {
      await sql`
        insert into as_ref_links (
          user_id, code, label, source, campaign, ad_group, creative,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term, spend, notes, active
        ) values (
          ${uid}, ${code}, ${label}, ${source},
          ${data.campaign?.trim() || ""}, ${data.adGroup?.trim() || ""}, ${data.creative?.trim() || ""},
          ${data.utmSource?.trim() || source}, ${data.utmMedium?.trim() || ""}, ${data.utmCampaign?.trim() || data.campaign?.trim() || ""},
          ${data.utmContent?.trim() || data.creative?.trim() || ""}, ${data.utmTerm?.trim() || ""},
          ${spend}, ${data.notes?.trim() || ""}, ${true}
        )
      `;
    } catch {
      await sql`insert into as_ref_links (user_id, code, label, source) values (${uid}, ${code}, ${label}, ${source})`;
    }
    const ws = await sql<{ bot_username: string | null }>`select bot_username from as_workspace where user_id = ${uid}`;
    const uname = (ws[0]?.bot_username ?? "").replace(/^@/, "");
    const link = uname ? `https://t.me/${uname}?start=${code}` : code;
    try { await addAudit(sql, uid, "create_ad_link", "ref", code, null, label); } catch { /* ignore */ }
    return { ok: true as const, code, link, error: null as string | null };
  });

export const updateAdLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; label?: string; spend?: number; active?: boolean; campaign?: string; adGroup?: string; creative?: string; notes?: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "bots")) return { ok: false as const, error: NO_PERM };
    try {
      await sql`
        update as_ref_links set
          label = coalesce(${data.label ?? null}, label),
          spend = coalesce(${data.spend ?? null}, spend),
          active = coalesce(${data.active ?? null}, active),
          campaign = coalesce(${data.campaign ?? null}, campaign),
          ad_group = coalesce(${data.adGroup ?? null}, ad_group),
          creative = coalesce(${data.creative ?? null}, creative),
          notes = coalesce(${data.notes ?? null}, notes)
        where user_id = ${uid} and id = ${data.id}
      `;
    } catch {
      if (data.label) await sql`update as_ref_links set label = ${data.label} where user_id = ${uid} and id = ${data.id}`;
    }
    return { ok: true as const, error: null as string | null };
  });

export const saveSubscribeCopy = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { prompt: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "bots")) return { ok: false as const, error: NO_PERM };
    try {
      await sql`update as_workspace set subscribe_prompt = ${data.prompt.trim() || null} where user_id = ${uid}`;
    } catch {
      return { ok: false as const, error: "Колонка появится после рестарта (миграция 0011)." };
    }
    return { ok: true as const, error: null as string | null };
  });

export const getSubscribeCopy = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid } = await ctxSql(context.userId);
    try {
      const row = await sql<{ subscribe_prompt: string | null }>`select subscribe_prompt from as_workspace where user_id = ${uid}`;
      return { prompt: row[0]?.subscribe_prompt ?? "" };
    } catch {
      return { prompt: "" };
    }
  });

export const probeTelegram = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "bots")) return { checks: [] as { key: string; ok: boolean; detail: string }[], openMembers: null as number | null, botUsername: "" };
    return probeTelegramHealth(sql, uid);
  });

export const exportTargetCsv = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid } = await ctxSql(context.userId);
    const rows = await sql<{
      label: string; source: string; code: string; clicks: number; joins: number; orders: number;
    }>`
      select label, source, code, clicks, joins, orders from as_ref_links where user_id = ${uid} order by orders desc
    `;
    const header = "label,source,code,clicks,joins,orders,conversion";
    const body = rows.map((r) => {
      const conv = pct(r.orders, r.clicks || r.joins);
      return [r.label, r.source, r.code, r.clicks, r.joins, r.orders, conv].join(",");
    });
    return { csv: [header, ...body].join("\n") };
  });
