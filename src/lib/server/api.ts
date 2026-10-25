import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { SERVICES } from "@/lib/catalog";
import { ASSIGNABLE, haversineKm, clientLabel, type OrderStatus, type OnlineStatus } from "@/lib/domain";
import { assignmentCity, isInsideServiceArea } from "@/lib/geo";
import { addAudit, addEvent, addNote, accruePayout, parkPayout, tickPresence, type StaffWho } from "./workspace";
import { insertOrder, type CreateOrderInput } from "./orders";
import { connectTelegramBot, connectExtraBot, disconnectTelegramBot, disconnectBotById, pushOrderStatus, sendWorkspaceAlertTest, normalizeChatId, channelOverlap, sanitizeAlertRouting, dispatchOrder, dispatchWaiting } from "./telegram";
import { actorCtx, requireAdmin, requireOwner, can } from "./access";

async function ctxSql(userId: string) {
  return actorCtx(userId);
}

export type MasterRow = {
  id: number; first_name: string; last_name: string; telegram_id: string | null; phone: string;
  city: string; district: string; specialization: string; rating: number; completed_orders: number;
  cancelled_orders: number; rejected_orders: number; accepted_orders: number; online_status: OnlineStatus;
  last_seen: string; lat: number | null; lng: number | null; registered_at: string; avg_minutes: number;
  earnings: number; active_orders: number;
};
export type OrderRow = {
  id: number; public_no: number; client_id: number; master_id: number | null; category_slug: string;
  description: string; phone: string; city: string; district: string; address: string;
  lat: number | null; lng: number | null; status: OrderStatus; photos: string; comment: string;
  price: number; master_payout: number; created_at: string; assigned_at: string | null;
  accepted_at: string | null; arrived_at: string | null; started_at: string | null;
  completed_at: string | null; cancelled_at: string | null; updated_at: string;
  client_name: string; master_name: string | null; client_tg: string | null; client_rating: number;
  cancel_reason: string; scheduled_for: string | null; price_estimate: number; price_agreed: number | null;
  price_paid: number; client_confirmed: boolean; operator_note: string; assigned_by: string | null;
};
export type NoteRow = { id: number; kind: string; title: string; body: string; order_id: number | null; master_id: number | null; read: boolean; created_at: string };
export type EventRow = { id: number; event_type: string; actor: string; metadata: string; created_at: string };
export type ClientListRow = {
  id: number; name: string; phone: string; telegram_id: string | null; district: string;
  rating: number; blocked: boolean; created_at: string; last_active: string | null;
  orders_count: number; completed_count: number; cancelled_count: number;
  lang: string; role: string; lat: number | null; lng: number | null;
  paid: boolean; paid_at: string | null;
  ref_code: string | null; referred_by: string | null; last_master: string | null; last_status: string | null;
};
export type ReviewListRow = { id: number; rating: number; comment: string; created_at: string; public_no: number; client_name: string | null; master_name: string | null };
export type AuditRow = {
  id: number; action: string; object_type: string; object_id: string; old_value: string | null; new_value: string | null;
  created_at: string; actor_name: string | null; actor_email: string | null;
};

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function asBool(v: unknown): boolean {
  return v === true || v === "t" || v === "true" || v === 1 || v === "1";
}

const NO_PERM = "Нет права. Владелец не выдал это в «Команда».";

function who(actor: { name: string; email: string; role: string }): StaffWho {
  return { name: actor.name, email: actor.email, role: actor.role };
}

async function ensureCredentialUser(
  sql: Awaited<ReturnType<typeof getSql>>,
  email: string,
  name: string,
  password: string,
): Promise<string> {
  const { hashPassword } = await import("better-auth/crypto");
  const hashed = await hashPassword(password);
  const existing = await sql<{ id: string }>`select id from "user" where email = ${email} limit 1`;
  if (existing[0]) {
    const userId = existing[0].id;
    const acc = await sql<{ id: string }>`
      select id from account where "userId" = ${userId} and "providerId" = ${"credential"} limit 1
    `;
    if (acc[0]) {
      await sql`update account set password = ${hashed}, "updatedAt" = now() where id = ${acc[0].id}`;
    } else {
      const id = crypto.randomUUID();
      await sql`
        insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
        values (${id}, ${userId}, ${"credential"}, ${userId}, ${hashed}, now(), now())
      `;
    }
    return userId;
  }
  const userId = crypto.randomUUID();
  await sql`
    insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    values (${userId}, ${name}, ${email}, ${true}, now(), now())
  `;
  const accId = crypto.randomUUID();
  await sql`
    insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
    values (${accId}, ${userId}, ${"credential"}, ${userId}, ${hashed}, now(), now())
  `;
  return userId;
}

function mapMaster(r: Record<string, unknown>, active = 0): MasterRow {
  return {
    id: n(r.id), first_name: String(r.first_name), last_name: String(r.last_name),
    telegram_id: r.telegram_id ? String(r.telegram_id) : null, phone: String(r.phone ?? ""),
    city: String(r.city ?? ""), district: String(r.district ?? ""), specialization: String(r.specialization),
    rating: n(r.rating), completed_orders: n(r.completed_orders), cancelled_orders: n(r.cancelled_orders),
    rejected_orders: n(r.rejected_orders), accepted_orders: n(r.accepted_orders),
    online_status: r.online_status as OnlineStatus, last_seen: String(r.last_seen),
    lat: r.lat == null ? null : n(r.lat), lng: r.lng == null ? null : n(r.lng),
    registered_at: String(r.registered_at ?? ""), avg_minutes: n(r.avg_minutes), earnings: n(r.earnings),
    active_orders: active,
  };
}

function mapOrder(r: Record<string, unknown>): OrderRow {
  return {
    id: n(r.id), public_no: n(r.public_no), client_id: n(r.client_id),
    master_id: r.master_id == null ? null : n(r.master_id), category_slug: String(r.category_slug),
    description: String(r.description), phone: String(r.phone ?? ""), city: String(r.city ?? ""),
    district: String(r.district ?? ""), address: String(r.address ?? ""),
    lat: r.lat == null ? null : n(r.lat), lng: r.lng == null ? null : n(r.lng),
    status: r.status as OrderStatus, photos: String(r.photos ?? "[]"), comment: String(r.comment ?? ""),
    price: n(r.price), master_payout: n(r.master_payout), created_at: String(r.created_at),
    assigned_at: r.assigned_at ? String(r.assigned_at) : null, accepted_at: r.accepted_at ? String(r.accepted_at) : null,
    arrived_at: r.arrived_at ? String(r.arrived_at) : null, started_at: r.started_at ? String(r.started_at) : null,
    completed_at: r.completed_at ? String(r.completed_at) : null, cancelled_at: r.cancelled_at ? String(r.cancelled_at) : null,
    updated_at: String(r.updated_at), client_name: String(r.client_name ?? ""),
    master_name: r.master_name ? String(r.master_name) : null,
    client_tg: r.client_tg ? String(r.client_tg) : null,
    client_rating: n(r.client_rating),
    cancel_reason: String(r.cancel_reason ?? ""),
    scheduled_for: r.scheduled_for ? String(r.scheduled_for) : null,
    price_estimate: r.price_estimate == null ? n(r.price) : n(r.price_estimate),
    price_agreed: r.price_agreed == null ? null : n(r.price_agreed),
    price_paid: n(r.price_paid),
    client_confirmed: asBool(r.client_confirmed),
    operator_note: String(r.operator_note ?? ""),
    assigned_by: r.assigned_by ? String(r.assigned_by) : null,
  };
}

const ORDER_SELECT = `
  o.*, c.name as client_name, c.telegram_id as client_tg, coalesce(c.rating, 5) as client_rating,
  case when m.id is null then null else m.first_name || ' ' || m.last_name end as master_name
`;

async function listMastersInner(sql: Awaited<ReturnType<typeof getSql>>, uid: string) {
  const rows = await sql`
    select * from as_masters
    where user_id = ${uid}
      and length(coalesce(telegram_id, '')) >= 8
    order by rating desc
  `;
  const active = await sql<{ master_id: number; n: number }>`
    select master_id, count(*)::int as n from as_orders
    where user_id = ${uid} and master_id is not null
      and status in ('assigned','master_accepted','enroute','arrived','in_progress')
    group by master_id
  `;
  const map = new Map(active.map((a) => [n(a.master_id), n(a.n)]));
  return rows.map((r) => mapMaster(r as Record<string, unknown>, map.get(n((r as { id: number }).id)) ?? 0));
}

export type { CreateOrderInput };

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    const [clients, masters, orders, finance] = await Promise.all([
      sql<{ total: number; today: number; returning: number }>`
        select count(*)::int as total,
          count(*) filter (where created_at >= current_date)::int as today,
          count(*) filter (where (select count(*) from as_orders o where o.client_id = as_clients.id) > 1)::int as returning
        from as_clients where user_id = ${uid}
          and name <> ${"Удалён"}
          and length(coalesce(telegram_id, '')) >= 8`,
      sql<{ total: number; online: number; busy: number; offline: number }>`
        select count(*)::int as total,
          count(*) filter (where online_status = 'online')::int as online,
          count(*) filter (where online_status = 'busy')::int as busy,
          count(*) filter (where online_status = 'offline')::int as offline
        from as_masters where user_id = ${uid}
          and length(coalesce(telegram_id, '')) >= 8`,
      sql<{ total: number; today: number; week: number; waiting: number; assigned: number; work: number; done: number; cancelled: number; rejected: number }>`
        select count(*)::int as total,
          count(*) filter (where created_at >= current_date)::int as today,
          count(*) filter (where created_at >= current_date - interval '7 days')::int as week,
          count(*) filter (where status in ('waiting_admin','master_rejected'))::int as waiting,
          count(*) filter (where status = 'assigned')::int as assigned,
          count(*) filter (where status in ('master_accepted','enroute','arrived','in_progress'))::int as work,
          count(*) filter (where status = 'completed')::int as done,
          count(*) filter (where status = 'cancelled')::int as cancelled,
          count(*) filter (where status = 'master_rejected')::int as rejected
        from as_orders where user_id = ${uid}`,
      sql<{ today: number; week: number; month: number; avg: number; payout: number }>`
        select coalesce(sum(price) filter (where status = 'completed' and completed_at >= current_date), 0)::int as today,
          coalesce(sum(price) filter (where status = 'completed' and completed_at >= current_date - interval '7 days'), 0)::int as week,
          coalesce(sum(price) filter (where status = 'completed' and completed_at >= date_trunc('month', now())), 0)::int as month,
          coalesce(avg(price) filter (where status = 'completed'), 0)::int as avg,
          coalesce(sum(master_payout) filter (where status = 'completed'), 0)::int as payout
        from as_orders where user_id = ${uid}`,
    ]);
    const recentOrders = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT} from as_orders o join as_clients c on c.id = o.client_id left join as_masters m on m.id = o.master_id where o.user_id = $1 order by o.created_at desc limit 8`,
      [uid],
    );
    const queueRows = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT} from as_orders o join as_clients c on c.id = o.client_id left join as_masters m on m.id = o.master_id
       where o.user_id = $1 and o.status in ('waiting_admin','master_rejected')
       order by o.created_at asc limit 20`,
      [uid],
    );
    const notes = await sql<NoteRow>`select id, kind, title, body, order_id, master_id, read, created_at from as_notifications where user_id = ${uid} order by created_at desc limit 8`;
    const lateRows = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT} from as_orders o join as_clients c on c.id = o.client_id left join as_masters m on m.id = o.master_id
       where o.user_id = $1 and o.status = 'assigned' and o.assigned_at < now() - interval '10 minutes'
       order by o.assigned_at asc limit 12`,
      [uid],
    );
    let payWait = 0;
    if (can(actor, "finance")) {
      try {
        const pendingPay = await sql<{ n: number }>`select count(*)::int as n from as_payments where user_id = ${uid} and status = 'pending'`;
        payWait = n(pendingPay[0]?.n);
      } catch { /* ignore */ }
    }
    let bot: { username: string | null; connected: boolean; mode: string | null } = { username: null, connected: false, mode: null };
    try {
      const row = await sql<{ bot_username: string | null; webhook_id: string | null; poll_mode: boolean }>`
        select bot_username, webhook_id, poll_mode from as_workspace where user_id = ${uid}`;
      bot = {
        username: row[0]?.bot_username ?? null,
        connected: Boolean(row[0]?.bot_username),
        mode: row[0]?.poll_mode ? "polling" : row[0]?.webhook_id ? "webhook" : null,
      };
    } catch { /* migration pending */ }
    return {
      clients: { total: n(clients[0]?.total), today: n(clients[0]?.today), returning: n(clients[0]?.returning), active: n(clients[0]?.total) },
      masters: {
        total: n(masters[0]?.total),
        online: n(masters[0]?.online),
        busy: n(masters[0]?.busy),
        offline: n(masters[0]?.offline),
      },
      orders: {
        total: n(orders[0]?.total),
        today: n(orders[0]?.today),
        week: n(orders[0]?.week),
        waiting: n(orders[0]?.waiting),
        assigned: n(orders[0]?.assigned),
        work: n(orders[0]?.work),
        done: n(orders[0]?.done),
        cancelled: n(orders[0]?.cancelled),
        rejected: n(orders[0]?.rejected),
      },
      finance: can(actor, "finance")
        ? {
            today: n(finance[0]?.today),
            week: n(finance[0]?.week),
            month: n(finance[0]?.month),
            avg: n(finance[0]?.avg),
            payout: n(finance[0]?.payout),
            hidden: false,
          }
        : { today: 0, week: 0, month: 0, avg: 0, payout: 0, hidden: true },
      recent: recentOrders.map(mapOrder),
      queue: queueRows.map(mapOrder),
      late: lateRows.map(mapOrder),
      payWait,
      notifications: notes,
      bot,
      role: actor.role,
    };
  });

export const listOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((q: { status?: string; q?: string; page?: number; from?: string; to?: string } | undefined) => q ?? {})
  .handler(async ({ context, data }) => {
    const { sql, uid } = await ctxSql(context.userId);
    const status = data.status && data.status !== "all" ? data.status : null;
    const search = data.q?.trim() ? `%${data.q.trim()}%` : null;
    const page = Math.max(1, Math.floor(Number(data.page) || 1));
    const limit = 40;
    const offset = (page - 1) * limit;
    const from = /^\d{4}-\d{2}-\d{2}$/.test(data.from ?? "") ? data.from : null;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(data.to ?? "") ? data.to : null;
    const where = `o.user_id = $1
         and ($2::text is null
           or ($2 = 'waiting' and o.status in ('waiting_admin','master_rejected'))
           or ($2 = 'work' and o.status in ('master_accepted','enroute','arrived','in_progress'))
           or o.status = $2)
         and ($3::text is null or c.name ilike $3 or o.description ilike $3 or o.phone ilike $3 or o.public_no::text ilike $3 or c.telegram_id ilike $3 or coalesce(m.first_name, '') ilike $3)
         and ($4::date is null or o.created_at::date >= $4::date)
         and ($5::date is null or o.created_at::date <= $5::date)`;
    const rows = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT}
       from as_orders o join as_clients c on c.id = o.client_id left join as_masters m on m.id = o.master_id
       where ${where}
       order by o.created_at desc limit $6 offset $7`,
      [uid, status, search, from, to, limit, offset],
    );
    const totalRows = await sql.query<{ n: number }>(
      `select count(*)::int as n
       from as_orders o join as_clients c on c.id = o.client_id left join as_masters m on m.id = o.master_id
       where ${where}`,
      [uid, status, search, from, to],
    );
    return { items: rows.map(mapOrder), total: n(totalRows[0]?.n), page };
  });

export const getOrder = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    const rows = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT} from as_orders o join as_clients c on c.id = o.client_id left join as_masters m on m.id = o.master_id where o.user_id = $1 and o.id = $2`,
      [uid, id],
    );
    const order = rows[0] ? mapOrder(rows[0]) : null;
    if (!order) return { error: "ORDER_NOT_FOUND" as const, order: null, events: [] as EventRow[], clientOrders: 0, master: null as MasterRow | null };
    const events = await sql<EventRow>`select id, event_type, actor, metadata, created_at from as_order_events where user_id = ${uid} and order_id = ${id} order by created_at asc`;
    const clientOrders = await sql<{ n: number }>`select count(*)::int as n from as_orders where user_id = ${uid} and client_id = ${order.client_id}`;
    let master: MasterRow | null = null;
    if (order.master_id) {
      const m = await sql`select * from as_masters where user_id = ${uid} and id = ${order.master_id}`;
      if (m[0]) master = mapMaster(m[0] as Record<string, unknown>);
    }
    return { order, events, clientOrders: n(clientOrders[0]?.n), master, error: null };
  });

export const listMasters = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    await tickPresence(sql, uid);
    return listMastersInner(sql, uid);
  });

export const getMaster = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    const rows = await sql`select * from as_masters where user_id = ${uid} and id = ${id}`;
    if (!rows[0]) return { master: null, orders: [] as OrderRow[], reviews: [] as ReviewListRow[], payouts: [], accessCode: "", approved: false, specs: "", zone: "", schedule: "" };
    const orders = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT} from as_orders o join as_clients c on c.id = o.client_id left join as_masters m on m.id = o.master_id where o.user_id = $1 and o.master_id = $2 order by o.created_at desc limit 30`,
      [uid, id],
    );
    const reviews = await sql<ReviewListRow>`
      select r.id, r.rating, r.comment, r.created_at, o.public_no, c.name as client_name, '' as master_name
      from as_reviews r left join as_orders o on o.id = r.order_id left join as_clients c on c.id = r.client_id
      where r.user_id = ${uid} and r.master_id = ${id} order by r.created_at desc`;
    const master = mapMaster(rows[0] as Record<string, unknown>);
    if (!can(actor, "finance")) master.earnings = 0;
    let payouts: { id: number; amount: number; status: string; note: string; created_at: string }[] = [];
    if (can(actor, "finance")) {
      try {
        payouts = await sql`
          select id, amount, status, note, created_at from as_payouts
          where user_id = ${uid} and master_id = ${id} order by created_at desc limit 30
        `;
      } catch { /* optional */ }
    }
    const raw = rows[0] as Record<string, unknown>;
    return {
      master,
      orders: orders.map(mapOrder),
      reviews,
      payouts,
      accessCode: raw.access_code ? String(raw.access_code) : "",
      approved: raw.approved == null ? true : asBool(raw.approved),
      specs: String(raw.specs ?? raw.specialization ?? ""),
      zone: String(raw.zone ?? ""),
      schedule: String(raw.schedule ?? ""),
    };
  });

export const listClients = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    return sql<ClientListRow>`
      select cl.id, cl.name, cl.phone, cl.telegram_id, cl.district, cl.rating, cl.blocked, cl.created_at,
        max(o.created_at) as last_active,
        count(o.id)::int as orders_count,
        count(o.id) filter (where o.status = 'completed')::int as completed_count,
        count(o.id) filter (where o.status = 'cancelled')::int as cancelled_count,
        coalesce(cl.lang, 'ru') as lang,
        coalesce(cl.role, 'client') as role,
        cl.lat, cl.lng,
        coalesce(cl.paid, false) as paid,
        cl.paid_at,
        cl.ref_code,
        cl.referred_by,
        (select nullif(trim(concat_ws(' ', m.first_name, m.last_name)), '')
          from as_orders ox left join as_masters m on m.id = ox.master_id
          where ox.client_id = cl.id and ox.master_id is not null
          order by coalesce(ox.completed_at, ox.updated_at) desc limit 1) as last_master,
        (select ox.status from as_orders ox where ox.client_id = cl.id order by ox.created_at desc limit 1) as last_status
      from as_clients cl
      left join as_orders o on o.client_id = cl.id
      where cl.user_id = ${uid}
        and cl.name <> ${"Удалён"}
        and length(coalesce(cl.telegram_id, '')) >= 8
      group by cl.id
      order by cl.created_at desc`;
  });

export const candidatesForOrder = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((orderId: number) => orderId)
  .handler(async ({ context, data: orderId }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    await tickPresence(sql, uid);
    const o = await sql`select * from as_orders where user_id = ${uid} and id = ${orderId}`;
    if (!o[0]) return { error: "ORDER_NOT_FOUND" as const, masters: [] as (MasterRow & { km: number | null; recommended: boolean; inZone: boolean })[] };
    const masters = await listMastersInner(sql, uid);
    const olat = o[0].lat == null ? null : n(o[0].lat);
    const olng = o[0].lng == null ? null : n(o[0].lng);
    const spec = String(o[0].category_slug);
    const orderCity = assignmentCity(String(o[0].city ?? ""), olat, olng);
    const scored = masters.map((m) => {
      const km = olat != null && olng != null && m.lat != null && m.lng != null ? haversineKm(olat, olng, m.lat, m.lng) : null;
      const inZone = m.lat != null && m.lng != null ? isInsideServiceArea(m.lat, m.lng) : false;
      const sameCity = Boolean(orderCity && assignmentCity(m.city, m.lat, m.lng) === orderCity);
      const recommended = sameCity && m.specialization === spec && m.online_status !== "offline" && m.online_status !== "blocked" && m.active_orders < 1;
      return { ...m, km, recommended, inZone, sameCity };
    });
    scored.sort((a, b) => {
      if (a.sameCity !== b.sameCity) return a.sameCity ? -1 : 1;
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
      if (a.km != null && b.km != null) return a.km - b.km;
      return b.rating - a.rating;
    });
    return { error: null, masters: scored, spec };
  });

export const assignMaster = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orderId: number; masterId: number }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    if (!can(actor, "assign")) return { success: false as const, error: NO_PERM };
    const o = await sql`select * from as_orders where user_id = ${uid} and id = ${data.orderId}`;
    const order = o[0] as Record<string, unknown> | undefined;
    if (!order) return { success: false as const, error: "ORDER_NOT_FOUND" };
    const status = String(order.status) as OrderStatus;
    if (!ASSIGNABLE.includes(status)) return { success: false as const, error: "ORDER_NOT_ASSIGNABLE" };
    const m = await sql`select * from as_masters where user_id = ${uid} and id = ${data.masterId}`;
    const master = m[0] as Record<string, unknown> | undefined;
    if (!master) return { success: false as const, error: "MASTER_NOT_FOUND" };
    if (String(master.online_status) === "blocked") return { success: false as const, error: "MASTER_BLOCKED" };
    const busy = await sql<{ id: number }>`
      select id from as_orders
      where user_id = ${uid} and master_id = ${data.masterId} and id <> ${data.orderId}
        and status in ('assigned', 'master_accepted', 'enroute', 'arrived', 'in_progress')
      limit 1
    `;
    if (busy[0]) return { success: false as const, error: "У мастера уже есть незакрытая заявка" };
    const updated = await sql<{ id: number }>`
      update as_orders
      set master_id = ${data.masterId}, status = 'assigned', assigned_at = now(), updated_at = now(), assigned_by = ${actor.email}
      where user_id = ${uid} and id = ${data.orderId}
        and status in ('waiting_admin', 'master_rejected', 'assigned')
      returning id
    `;
    if (!updated[0]) return { success: false as const, error: "ORDER_CHANGED" };
    await addEvent(sql, uid, data.orderId, "assigned", "admin", { masterId: data.masterId }, who(actor));
    await addAudit(sql, uid, "assign_master", "order", String(data.orderId), null, String(data.masterId), who(actor));
    const name = `${master.first_name} ${master.last_name}`;
    await addNote(sql, uid, "master", `Вам назначен заказ №${order.public_no}`, String(order.description), data.orderId, data.masterId);
    await pushOrderStatus(sql, uid, data.orderId, "assigned", name);
    try { await sql`update as_masters set last_offered_at = now() where user_id = ${uid} and id = ${data.masterId}`; } catch { /* 0015 */ }
    return { success: true as const, error: null, masterName: name };
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: number | { orderId: number; reason?: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    if (!can(actor, "assign")) return { success: false as const, error: NO_PERM };
    const orderId = typeof data === "number" ? data : data.orderId;
    const reason = typeof data === "number" ? "" : (data.reason ?? "").trim().slice(0, 200);
    if (!reason) return { success: false as const, error: "Укажите причину отмены" };
    const updated = await sql<{ id: number }>`
      update as_orders
      set status = 'cancelled', cancelled_at = now(), updated_at = now(), cancel_reason = ${reason}
      where user_id = ${uid} and id = ${orderId} and status not in ('completed', 'cancelled')
      returning id
    `;
    if (!updated[0]) return { success: false as const, error: "Заявку уже закрыли" };
    await addEvent(sql, uid, orderId, "cancelled", "admin", { reason }, who(actor));
    await pushOrderStatus(sql, uid, orderId, "cancelled", null);
    try { await dispatchWaiting(sql, uid); } catch { /* queue */ }
    return { success: true };
  });

async function masterByCode(
  sql: Awaited<ReturnType<typeof getSql>>,
  uid: string,
  masterId: number,
  code: string,
) {
  const clean = code.trim().toLowerCase();
  if (!clean) return null;
  const rows = await sql<{ id: number }>`
    select id from as_masters
    where user_id = ${uid} and id = ${masterId}
      and lower(access_code) = ${clean}
      and coalesce(approved, true) = true
      and online_status <> 'blocked'
    limit 1
  `;
  return rows[0] ?? null;
}

export const masterDecision = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orderId: number; accept: boolean; masterId: number; code: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid } = await ctxSql(context.userId);
    const self = await masterByCode(sql, uid, data.masterId, data.code);
    if (!self) return { success: false as const, error: "Кабинет открыт только по коду этого мастера" };
    const o = await sql`select * from as_orders where user_id = ${uid} and id = ${data.orderId}`;
    const order = o[0] as Record<string, unknown> | undefined;
    if (!order) return { success: false as const, error: "ORDER_NOT_FOUND" };
    if (n(order.master_id) !== data.masterId) return { success: false as const, error: "NOT_ASSIGNED" };
    if (String(order.status) !== "assigned") return { success: false as const, error: "WRONG_STATUS" };
    if (data.accept) {
      const updated = await sql<{ id: number }>`
        update as_orders set status = 'master_accepted', accepted_at = now(), updated_at = now()
        where user_id = ${uid} and id = ${data.orderId} and master_id = ${data.masterId} and status = 'assigned'
        returning id
      `;
      if (!updated[0]) return { success: false as const, error: "WRONG_STATUS" };
      await sql`update as_masters set accepted_orders = accepted_orders + 1, online_status = 'busy', last_seen = now() where user_id = ${uid} and id = ${data.masterId}`;
      await addEvent(sql, uid, data.orderId, "master_accepted", "master", {});
      await pushOrderStatus(sql, uid, data.orderId, "master_accepted", null);
    } else {
      const updated = await sql<{ id: number }>`
        update as_orders set status = 'master_rejected', updated_at = now()
        where user_id = ${uid} and id = ${data.orderId} and master_id = ${data.masterId} and status = 'assigned'
        returning id
      `;
      if (!updated[0]) return { success: false as const, error: "WRONG_STATUS" };
      await sql`update as_masters set rejected_orders = rejected_orders + 1, last_seen = now() where user_id = ${uid} and id = ${data.masterId}`;
      await addEvent(sql, uid, data.orderId, "master_rejected", "master", { masterId: data.masterId });
      await addNote(sql, uid, "admin", `Мастер отказался от заявки №${order.public_no}`, "Назначьте другого мастера", data.orderId, null);
      await pushOrderStatus(sql, uid, data.orderId, "master_rejected", null);
    }
    return { success: true as const, error: null };
  });

export const masterAdvance = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orderId: number; masterId: number; to: OrderStatus; code: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid } = await ctxSql(context.userId);
    const self = await masterByCode(sql, uid, data.masterId, data.code);
    if (!self) return { success: false as const, error: "Кабинет открыт только по коду этого мастера" };
    const allowed: Record<string, OrderStatus> = { master_accepted: "enroute", enroute: "arrived", arrived: "in_progress", in_progress: "completed" };
    const o = await sql`select * from as_orders where user_id = ${uid} and id = ${data.orderId}`;
    const order = o[0] as Record<string, unknown> | undefined;
    if (!order) return { success: false as const, error: "ORDER_NOT_FOUND" };
    if (n(order.master_id) !== data.masterId) return { success: false as const, error: "NOT_ASSIGNED" };
    const from = String(order.status);
    if (allowed[from] !== data.to) return { success: false as const, error: "WRONG_STATUS" };
    if (data.to === "completed") {
      const updated = await sql<{ id: number }>`
        update as_orders set status = 'completed', completed_at = now(), updated_at = now(), client_confirmed = false
        where user_id = ${uid} and id = ${data.orderId} and master_id = ${data.masterId} and status = 'in_progress'
        returning id
      `;
      if (!updated[0]) return { success: false as const, error: "WRONG_STATUS" };
      await sql`update as_masters set completed_orders = completed_orders + 1, last_seen = now() where user_id = ${uid} and id = ${data.masterId}`;
      await parkPayout(sql, uid, data.masterId, data.orderId, n(order.master_payout));
    } else if (data.to === "enroute") {
      const updated = await sql<{ id: number }>`
        update as_orders set status = 'enroute', updated_at = now()
        where user_id = ${uid} and id = ${data.orderId} and master_id = ${data.masterId} and status = ${from}
        returning id
      `;
      if (!updated[0]) return { success: false as const, error: "WRONG_STATUS" };
    } else if (data.to === "arrived") {
      const updated = await sql<{ id: number }>`
        update as_orders set status = 'arrived', arrived_at = now(), updated_at = now()
        where user_id = ${uid} and id = ${data.orderId} and master_id = ${data.masterId} and status = ${from}
        returning id
      `;
      if (!updated[0]) return { success: false as const, error: "WRONG_STATUS" };
    } else if (data.to === "in_progress") {
      const updated = await sql<{ id: number }>`
        update as_orders set status = 'in_progress', started_at = now(), updated_at = now()
        where user_id = ${uid} and id = ${data.orderId} and master_id = ${data.masterId} and status = ${from}
        returning id
      `;
      if (!updated[0]) return { success: false as const, error: "WRONG_STATUS" };
    }
    await addEvent(sql, uid, data.orderId, data.to, "master", {});
    await pushOrderStatus(sql, uid, data.orderId, data.to, null);
    return { success: true as const, error: null };
  });

export const heartbeatMaster = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { masterId: number; code: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid } = await ctxSql(context.userId);
    const self = await masterByCode(sql, uid, data.masterId, data.code);
    if (!self) return { ok: false, status: "offline" as const };
    const busy = await sql<{ n: number }>`select count(*)::int as n from as_orders where user_id = ${uid} and master_id = ${data.masterId} and status in ('assigned','master_accepted','enroute','arrived','in_progress')`;
    const row = await sql<{ online_status: string }>`select online_status from as_masters where user_id = ${uid} and id = ${data.masterId}`;
    const current = row[0]?.online_status ?? "offline";
    if (current === "blocked" || current === "offline") {
      await sql`update as_masters set last_seen = now() where user_id = ${uid} and id = ${data.masterId} and online_status <> 'blocked'`;
      return { ok: true, status: current };
    }
    const status = n(busy[0]?.n) > 0 ? "busy" : "online";
    await sql`update as_masters set last_seen = now(), online_status = ${status} where user_id = ${uid} and id = ${data.masterId} and online_status in ('online','busy')`;
    return { ok: true, status };
  });

export const openMasterDesk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { code: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid } = await ctxSql(context.userId);
    const code = data.code.trim().toLowerCase();
    if (!code) return { ok: false as const, error: "Введите код из карточки мастера" };
    let rows: Record<string, unknown>[] = [];
    try {
      rows = await sql`
        select * from as_masters where user_id = ${uid} and lower(access_code) = ${code} limit 1
      `;
    } catch {
      return { ok: false as const, error: "База ещё без кодов. На сервере нужна миграция 0014." };
    }
    const raw = rows[0];
    if (!raw) return { ok: false as const, error: "Код не найден" };
    if (raw.approved === false || raw.approved === "f" || raw.approved === "false") {
      return { ok: false as const, error: "Админ ещё не подтвердил этот профиль" };
    }
    if (String(raw.online_status) === "blocked") return { ok: false as const, error: "Профиль заблокирован" };
    const master = mapMaster(raw);
    const orders = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT} from as_orders o join as_clients c on c.id = o.client_id left join as_masters m on m.id = o.master_id
       where o.user_id = $1 and o.master_id = $2 and o.status not in ('completed','cancelled')
       order by o.created_at desc limit 40`,
      [uid, master.id],
    );
    let payouts: { id: number; amount: number; status: string; note: string; created_at: string; order_id: number | null }[] = [];
    try {
      payouts = await sql`
        select id, amount, status, note, created_at, order_id from as_payouts
        where user_id = ${uid} and master_id = ${master.id}
        order by created_at desc limit 20
      `;
    } catch { /* optional */ }
    return { ok: true as const, error: null, master, orders: orders.map(mapOrder), payouts };
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: CreateOrderInput) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    const created = await insertOrder(sql, uid, data);
    try {
      const hit = await dispatchOrder(sql, uid, created.id);
      if (hit) return { ...created, status: "assigned" as const };
    } catch { /* bot may be offline */ }
    return created;
  });

export const rateOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orderId: number; rating: number }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    const o = await sql`select * from as_orders where user_id = ${uid} and id = ${data.orderId}`;
    const order = o[0] as Record<string, unknown> | undefined;
    if (!order || String(order.status) !== "completed") return { success: false };
    if (data.rating < 1 || data.rating > 5) return { success: false };
    const existing = await sql<{ id: number }>`select id from as_reviews where user_id = ${uid} and order_id = ${data.orderId} limit 1`;
    if (existing[0]) return { success: false };
    await sql`insert into as_reviews (user_id, order_id, client_id, master_id, rating, comment) values (${uid}, ${data.orderId}, ${n(order.client_id)}, ${order.master_id == null ? null : n(order.master_id)}, ${data.rating}, ${""})`;
    return { success: true };
  });

export const getMapData = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    await tickPresence(sql, uid);
    const masters = await listMastersInner(sql, uid);
    const orders = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT} from as_orders o join as_clients c on c.id = o.client_id left join as_masters m on m.id = o.master_id where o.user_id = $1 and o.status not in ('completed','cancelled') order by o.created_at desc`,
      [uid],
    );
    return { masters, orders: orders.map(mapOrder) };
  });

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    const byDay = await sql<{ d: string; n: number; revenue: number }>`
      select to_char(created_at, 'YYYY-MM-DD') as d, count(*)::int as n, coalesce(sum(price) filter (where status = 'completed'), 0)::int as revenue
      from as_orders where user_id = ${uid} and created_at >= current_date - interval '14 days' group by 1 order by 1`;
    const byCat = await sql<{ slug: string; n: number }>`select category_slug as slug, count(*)::int as n from as_orders where user_id = ${uid} group by 1 order by n desc`;
    const byCity = await sql<{ district: string; n: number }>`select district, count(*)::int as n from as_orders where user_id = ${uid} group by 1 order by n desc`;
    const ratings = await sql<{ rating: number; n: number }>`select rating, count(*)::int as n from as_reviews where user_id = ${uid} group by 1 order by 1`;
    const byHour = await sql<{ h: number; n: number }>`
      select extract(hour from created_at)::int as h, count(*)::int as n
      from as_orders where user_id = ${uid} group by 1 order by 1`;
    const funnel = await sql<{ created: number; assigned: number; accepted: number; completed: number; cancelled: number }>`
      select count(*)::int as created, count(*) filter (where assigned_at is not null)::int as assigned,
        count(*) filter (where accepted_at is not null)::int as accepted,
        count(*) filter (where status = 'completed')::int as completed,
        count(*) filter (where status = 'cancelled')::int as cancelled from as_orders where user_id = ${uid}`;
    return {
      byDay: byDay ?? [],
      byCat: byCat ?? [],
      byCity: byCity ?? [],
      ratings: ratings ?? [],
      byHour: byHour ?? [],
      funnel: funnel[0] ?? { created: 0, assigned: 0, accepted: 0, completed: 0, cancelled: 0 },
    };
  });

export const listReviews = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
  const { sql, uid, actor } = await ctxSql(context.userId);
  return sql<ReviewListRow>`
    select r.id, r.rating, r.comment, r.created_at, o.public_no, c.name as client_name, m.first_name || ' ' || m.last_name as master_name
    from as_reviews r join as_orders o on o.id = r.order_id left join as_clients c on c.id = r.client_id left join as_masters m on m.id = r.master_id
    where r.user_id = ${uid} order by r.created_at desc`;
});

export const listAudit = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
  const { sql, uid } = await ctxSql(context.userId);
  try {
    return await sql<AuditRow>`
      select id, action, object_type, object_id, old_value, new_value, created_at, actor_name, actor_email
      from as_audit where user_id = ${uid} order by created_at desc limit 100
    `;
  } catch {
    const rows = await sql<{ id: number; action: string; object_type: string; object_id: string; old_value: string | null; new_value: string | null; created_at: string }>`
      select id, action, object_type, object_id, old_value, new_value, created_at
      from as_audit where user_id = ${uid} order by created_at desc limit 100
    `;
    return rows.map((r) => ({ ...r, actor_name: null, actor_email: null }));
  }
});

export const listNotifications = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
  const { sql, uid } = await ctxSql(context.userId);
  return sql<NoteRow>`select id, kind, title, body, order_id, master_id, read, created_at from as_notifications where user_id = ${uid} order by created_at desc limit 80`;
});

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { ids?: number[] }) => d ?? {})
  .handler(async ({ context, data }) => {
    const { sql, uid } = await ctxSql(context.userId);
    const ids = (data.ids ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id));
    if (ids.length === 0) {
      await sql`update as_notifications set read = true where user_id = ${uid} and read = false`;
    } else {
      for (const id of ids) {
        await sql`update as_notifications set read = true where user_id = ${uid} and id = ${id}`;
      }
    }
    return { ok: true };
  });

export const globalSearch = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((q: string) => q)
  .handler(async ({ context, data }) => {
    const { sql, uid } = await ctxSql(context.userId);
    const q = data.trim();
    if (q.length < 2) return { orders: [] as OrderRow[], clients: [] as { id: number; name: string; phone: string }[], masters: [] as { id: number; name: string; phone: string }[] };
    const like = `%${q}%`;
    const orders = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT}
       from as_orders o join as_clients c on c.id = o.client_id left join as_masters m on m.id = o.master_id
       where o.user_id = $1 and (
         c.name ilike $2 or c.phone ilike $2 or c.telegram_id ilike $2 or o.public_no::text ilike $2
         or o.phone ilike $2 or coalesce(m.first_name,'') ilike $2 or coalesce(m.last_name,'') ilike $2
       )
       order by o.created_at desc limit 8`,
      [uid, like],
    );
    const clients = await sql<{ id: number; name: string; phone: string }>`
      select id, name, phone from as_clients
      where user_id = ${uid} and (name ilike ${like} or phone ilike ${like} or coalesce(telegram_id,'') ilike ${like})
      order by created_at desc limit 6
    `;
    const masters = await sql<{ id: number; name: string; phone: string }>`
      select id, trim(first_name || ' ' || last_name) as name, phone from as_masters
      where user_id = ${uid} and (first_name ilike ${like} or last_name ilike ${like} or phone ilike ${like} or coalesce(telegram_id,'') ilike ${like})
      order by id desc limit 6
    `;
    return { orders: orders.map(mapOrder), clients, masters };
  });

export const saveOrderOps = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orderId: number; operatorNote?: string; priceAgreed?: number | null; pricePaid?: number; scheduledFor?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    if (!can(actor, "assign")) return { ok: false as const, error: NO_PERM };
    const note = (data.operatorNote ?? "").slice(0, 500);
    const agreed = data.priceAgreed == null || data.priceAgreed === 0 ? null : Math.max(0, Math.round(data.priceAgreed));
    const paid = Math.max(0, Math.round(Number(data.pricePaid ?? 0) || 0));
    const when = data.scheduledFor && !Number.isNaN(Date.parse(data.scheduledFor)) ? new Date(data.scheduledFor).toISOString() : null;
    try {
      await sql`
        update as_orders set
          operator_note = ${note},
          price_agreed = ${agreed},
          price_paid = ${paid},
          scheduled_for = ${when},
          updated_at = now()
        where user_id = ${uid} and id = ${data.orderId}
      `;
    } catch {
      return { ok: false as const, error: "Колонки заявки появятся после миграции 0014" };
    }
    await addAudit(sql, uid, "order_ops", "order", String(data.orderId), null, note || String(agreed ?? ""), who(actor));
    return { ok: true as const, error: null };
  });

export const confirmClientOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((orderId: number) => orderId)
  .handler(async ({ context, data: orderId }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    if (!can(actor, "assign")) return { ok: false as const, error: NO_PERM };
    const o = await sql<{ id: number; master_id: number | null; master_payout: number; status: string }>`
      select id, master_id, master_payout, status from as_orders where user_id = ${uid} and id = ${orderId}
    `;
    if (!o[0] || o[0].status !== "completed") return { ok: false as const, error: "Подтверждать можно только завершённую заявку" };
    const upd = await sql<{ id: number }>`
      update as_orders set client_confirmed = true, updated_at = now()
      where user_id = ${uid} and id = ${orderId} and coalesce(client_confirmed, false) = false
      returning id
    `;
    if (!upd[0]) return { ok: false as const, error: "Уже подтверждено" };
    if (o[0].master_id) await accruePayout(sql, uid, n(o[0].master_id), orderId, n(o[0].master_payout));
    await addAudit(sql, uid, "client_confirm", "order", String(orderId), null, "confirmed", who(actor));
    return { ok: true as const, error: null };
  });

export const markPayoutPaid = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    if (!can(actor, "finance")) return { ok: false as const, error: NO_PERM };
    const upd = await sql<{ id: number }>`
      update as_payouts set status = 'paid'
      where user_id = ${uid} and id = ${id} and status = 'accrued'
      returning id
    `;
    if (!upd[0]) return { ok: false as const, error: "Начисление не найдено или клиент ещё не подтвердил" };
    await addAudit(sql, uid, "payout_paid", "payout", String(id), "accrued", "paid", who(actor));
    return { ok: true as const, error: null };
  });

export const setMasterProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; approved?: boolean; specs?: string; zone?: string; schedule?: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    if (!can(actor, "assign")) return { ok: false as const, error: NO_PERM };
    try {
      await sql`
        update as_masters set
          approved = ${data.approved !== false},
          specs = ${ (data.specs ?? "").slice(0, 200) },
          zone = ${ (data.zone ?? "").slice(0, 120) },
          schedule = ${ (data.schedule ?? "").slice(0, 200) }
        where user_id = ${uid} and id = ${data.id}
      `;
    } catch {
      return { ok: false as const, error: "Профиль мастера обновится после миграции 0014" };
    }
    if (!(await sql<{ access_code: string | null }>`select access_code from as_masters where user_id = ${uid} and id = ${data.id}`)[0]?.access_code) {
      await sql`update as_masters set access_code = substr(md5(user_id || ':' || id::text), 1, 8) where user_id = ${uid} and id = ${data.id}`;
    }
    await addAudit(sql, uid, "master_profile", "master", String(data.id), null, data.approved === false ? "unapproved" : "approved", who(actor));
    return { ok: true as const, error: null };
  });

export const pollOrder = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    const rows = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT} from as_orders o join as_clients c on c.id = o.client_id left join as_masters m on m.id = o.master_id where o.user_id = $1 and o.id = $2`,
      [uid, id],
    );
    return rows[0] ? mapOrder(rows[0]) : null;
  });

export const getBotSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    type WsRow = {
      bot_username: string | null; webhook_id: string | null; bot_connected_at: string | null; bot_token: string | null;
      poll_mode: boolean; channel_username: string | null; pay_card: string | null; pay_bank: string | null;
      pay_holder: string | null; pay_amount: number; alerts_channel_id: string | null; last_alert_error?: string | null;
      require_subscribe?: boolean;
    };
    let w: WsRow | undefined;
    try {
      const row = await sql<WsRow>`
        select bot_username, webhook_id, bot_connected_at, bot_token, poll_mode,
          channel_username, pay_card, pay_bank, pay_holder, pay_amount, alerts_channel_id, last_alert_error,
          require_subscribe
        from as_workspace where user_id = ${uid}`;
      w = row[0];
    } catch {
      try {
        const row = await sql<WsRow>`
          select bot_username, webhook_id, bot_connected_at, bot_token, poll_mode,
            channel_username, pay_card, pay_bank, pay_holder, pay_amount, alerts_channel_id, last_alert_error
          from as_workspace where user_id = ${uid}`;
        w = row[0];
      } catch {
        const row = await sql<WsRow>`
          select bot_username, webhook_id, bot_connected_at, bot_token, poll_mode,
            channel_username, pay_card, pay_bank, pay_holder, pay_amount, alerts_channel_id
          from as_workspace where user_id = ${uid}`;
        w = row[0];
      }
    }
    const token = w?.bot_token ?? "";
    const canBots = can(actor, "bots");
    const masked = canBots && token ? `${token.slice(0, 8)}…${token.slice(-4)}` : null;
    return {
      connected: Boolean(w?.bot_username),
      username: w?.bot_username ?? null,
      webhookId: canBots ? (w?.webhook_id ?? null) : null,
      connectedAt: w?.bot_connected_at ?? null,
      tokenMasked: masked,
      pollMode: Boolean(w?.poll_mode),
      channel: w?.channel_username ?? "",
      payCard: canBots ? (w?.pay_card ?? "") : "",
      payBank: canBots ? (w?.pay_bank ?? "") : "",
      payHolder: canBots ? (w?.pay_holder ?? "") : "",
      payAmount: n(w?.pay_amount),
      alertsChannel: canBots ? (w?.alerts_channel_id ?? "") : "",
      lastAlertError: canBots ? (w?.last_alert_error ?? "") : "",
      requireSubscribe: w?.require_subscribe !== false,
      role: actor.role,
      email: actor.email,
    };
  });

export const saveBotToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { token: string; publicOrigin: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    if (!can(actor, "bots")) return { ok: false as const, error: NO_PERM, username: null as string | null, mode: null as string | null };
    return connectTelegramBot(sql, uid, data.token.trim(), data.publicOrigin.replace(/\/$/, ""));
  });

export const dropBotToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "bots")) return { ok: false as const, error: NO_PERM };
    await disconnectTelegramBot(sql, uid);
    return { ok: true as const, error: null as string | null };
  });

export const getAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const emptyPerms = { invite: false, delete: false, assign: false, finance: false, bots: false };
    try {
      const { actor } = await ctxSql(context.userId);
      return {
        ok: true as const,
        error: null as string | null,
        role: actor.role as "owner" | "admin",
        email: actor.email,
        name: actor.name,
        workspaceId: actor.workspaceId,
        perms: actor.perms,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ERROR";
      if (msg === "NOT_INVITED" || msg === "BLOCKED") {
        return {
          ok: false as const,
          error: msg,
          role: null as "owner" | "admin" | null,
          email: "",
          name: "",
          workspaceId: "",
          perms: emptyPerms,
        };
      }
      throw e;
    }
  });

export const listStaff = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid } = await ctxSql(context.userId);
    try {
      const rows = await sql<{
        id: number; user_id: string | null; email: string; name: string; role: string; blocked: boolean; created_at: string;
        can_invite: boolean; can_delete: boolean; can_assign: boolean; can_finance: boolean; can_bots: boolean;
        last_seen: string | null;
      }>`
        select id, user_id, email, name, role, blocked, created_at,
          coalesce(can_invite, false) as can_invite,
          coalesce(can_delete, false) as can_delete,
          coalesce(can_assign, false) as can_assign,
          coalesce(can_finance, false) as can_finance,
          coalesce(can_bots, false) as can_bots,
          last_seen
        from as_staff where workspace_id = ${uid} order by role asc, created_at asc
      `;
      const now = Date.now();
      return rows.map((r) => ({
        ...r,
        can_invite: asBool(r.can_invite),
        can_delete: asBool(r.can_delete),
        can_assign: asBool(r.can_assign),
        can_finance: asBool(r.can_finance),
        can_bots: asBool(r.can_bots),
        last_seen: r.last_seen ? String(r.last_seen) : null,
        online: Boolean(r.last_seen) && now - new Date(String(r.last_seen)).getTime() < 150_000,
      }));
    } catch {
      const rows = await sql<{
        id: number; user_id: string | null; email: string; name: string; role: string; blocked: boolean; created_at: string;
      }>`select id, user_id, email, name, role, blocked, created_at from as_staff where workspace_id = ${uid} order by role asc, created_at asc`;
      return rows.map((r) => ({ ...r, can_invite: false, can_delete: false, can_assign: false, can_finance: false, can_bots: false, last_seen: null as string | null, online: false }));
    }
  });

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: {
    email: string; name?: string; password?: string;
    can_invite?: boolean; can_delete?: boolean; can_assign?: boolean; can_finance?: boolean; can_bots?: boolean;
  }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    if (actor.role !== "owner" && !can(actor, "invite")) {
      return { ok: false as const, error: "Нет права добавлять пользователей. Только владелец или тот, кому он это разрешил." };
    }
    const email = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: "Некорректный email" };
    const password = (data.password ?? "").trim();
    if (password.length < 8) return { ok: false as const, error: "Пароль минимум 8 символов" };
    const exists = await sql<{ id: number }>`select id from as_staff where workspace_id = ${uid} and email = ${email}`;
    if (exists[0]) return { ok: false as const, error: "Этот email уже в команде" };
    const owner = actor.role === "owner";
    const invite = owner && Boolean(data.can_invite);
    const del = owner && Boolean(data.can_delete);
    const assign = owner && Boolean(data.can_assign);
    const finance = owner && Boolean(data.can_finance);
    const bots = owner && Boolean(data.can_bots);
    const name = data.name?.trim() || email;
    let authUserId: string | null = null;
    try {
      authUserId = await ensureCredentialUser(sql, email, name, password);
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Не удалось создать логин" };
    }
    await sql`
      insert into as_staff (workspace_id, user_id, email, name, role, blocked, can_invite, can_delete, can_assign, can_finance, can_bots)
      values (${uid}, ${authUserId}, ${email}, ${name}, ${"admin"}, ${false}, ${invite}, ${del}, ${assign}, ${finance}, ${bots})
    `;
    await addAudit(sql, uid, "invite_staff", "staff", email, null, "admin", who(actor));
    return { ok: true as const, error: null };
  });

export const setStaffBlocked = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; blocked: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireOwner(actor);
    const row = await sql<{ id: number; role: string; email: string }>`
      select id, role, email from as_staff where workspace_id = ${uid} and id = ${data.id}
    `;
    if (!row[0]) return { ok: false as const, error: "Пользователь не найден" };
    if (row[0].role === "owner") return { ok: false as const, error: "Владельца нельзя заблокировать" };
    await sql`update as_staff set blocked = ${data.blocked} where id = ${data.id} and workspace_id = ${uid}`;
    await addAudit(sql, uid, data.blocked ? "block_staff" : "unblock_staff", "staff", String(data.id), null, row[0].email, who(actor));
    return { ok: true as const, error: null };
  });

export const deleteStaff = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireOwner(actor);
    const row = await sql<{ role: string; email: string }>`
      select role, email from as_staff where workspace_id = ${uid} and id = ${data.id}
    `;
    if (!row[0]) return { ok: false as const, error: "Пользователь не найден" };
    if (row[0].role === "owner") return { ok: false as const, error: "Владельца нельзя удалить" };
    await sql`delete from as_staff where workspace_id = ${uid} and id = ${data.id}`;
    await addAudit(sql, uid, "delete_staff", "staff", String(data.id), row[0].email, null, who(actor));
    return { ok: true as const, error: null };
  });

export const setClientBlocked = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; blocked: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "delete")) return { ok: false as const, error: NO_PERM };
    const row = await sql<{ id: number; name: string }>`select id, name from as_clients where user_id = ${uid} and id = ${data.id}`;
    if (!row[0]) return { ok: false as const, error: "Клиент не найден" };
    await sql`update as_clients set blocked = ${data.blocked} where user_id = ${uid} and id = ${data.id}`;
    await addAudit(sql, uid, data.blocked ? "block_client" : "unblock_client", "client", String(data.id), null, row[0].name, who(actor));
    return { ok: true as const, error: null };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "delete")) return { ok: false as const, error: NO_PERM };
    const row = await sql<{ name: string }>`select name from as_clients where user_id = ${uid} and id = ${data.id}`;
    if (!row[0]) return { ok: false as const, error: "Клиент не найден" };
    const ids = await sql<{ id: number }>`select id from as_orders where user_id = ${uid} and client_id = ${data.id}`;
    for (const row of ids) {
      await sql`delete from as_order_events where user_id = ${uid} and order_id = ${row.id}`;
      await sql`delete from as_notifications where user_id = ${uid} and order_id = ${row.id}`;
    }
    try { await sql`delete from as_reviews where user_id = ${uid} and client_id = ${data.id}`; } catch { /* ignore */ }
    try { await sql`delete from as_payments where user_id = ${uid} and client_id = ${data.id}`; } catch { /* ignore */ }
    await sql`delete from as_orders where user_id = ${uid} and client_id = ${data.id}`;
    const tg = await sql<{ telegram_id: string | null }>`select telegram_id from as_clients where user_id = ${uid} and id = ${data.id}`;
    if (tg[0]?.telegram_id) {
      await sql`delete from as_tg_sessions where user_id = ${uid} and chat_id = ${tg[0].telegram_id}`;
    }
    await sql`delete from as_clients where user_id = ${uid} and id = ${data.id}`;
    await addAudit(sql, uid, "delete_client", "client", String(data.id), row[0].name, "removed", who(actor));
    return { ok: true as const, error: null };
  });

export const setMasterBlocked = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; blocked: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "delete")) return { ok: false as const, error: NO_PERM };
    const status = data.blocked ? "blocked" : "offline";
    await sql`update as_masters set online_status = ${status} where user_id = ${uid} and id = ${data.id}`;
    await addAudit(sql, uid, data.blocked ? "block_master" : "unblock_master", "master", String(data.id), null, status, who(actor));
    return { ok: true as const, error: null };
  });

export const deleteMaster = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "delete")) return { ok: false as const, error: NO_PERM };
    await sql`update as_orders set status = 'cancelled', cancelled_at = now(), updated_at = now(), master_id = null
      where user_id = ${uid} and master_id = ${data.id} and status in ('assigned','master_accepted','enroute','arrived','in_progress')`;
    try { await sql`delete from as_reviews where user_id = ${uid} and master_id = ${data.id}`; } catch { /* ignore */ }
    await sql`update as_orders set master_id = null where user_id = ${uid} and master_id = ${data.id}`;
    await sql`delete from as_notifications where user_id = ${uid} and master_id = ${data.id}`;
    await sql`delete from as_masters where user_id = ${uid} and id = ${data.id}`;
    await addAudit(sql, uid, "delete_master", "master", String(data.id), null, "removed", who(actor));
    return { ok: true as const, error: null };
  });

export type BotListRow = {
  id: number; kind: string; label: string; bot_username: string | null; connected_at: string | null;
  log_chat_id: string | null; tokenMasked: string | null;
};

export const listBots = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    if (!can(actor, "bots")) return [];
    const rows = await sql<{
      id: number; kind: string; label: string; bot_username: string | null; bot_token: string | null;
      connected_at: string | null; log_chat_id: string | null;
    }>`
      select id, kind, label, bot_username, bot_token, connected_at, log_chat_id
      from as_bots where user_id = ${uid} order by kind asc, id asc
    `;
    return rows.map((r) => ({
      id: n(r.id),
      kind: r.kind,
      label: r.label,
      bot_username: r.bot_username,
      connected_at: r.connected_at,
      log_chat_id: r.log_chat_id,
      tokenMasked: r.bot_token ? `${r.bot_token.slice(0, 8)}…${r.bot_token.slice(-4)}` : null,
    }));
  });

export const addServiceBot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { token: string; publicOrigin: string; kind: "client" | "logs"; label?: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "bots")) return { ok: false as const, error: NO_PERM, username: null as string | null, mode: null as string | null };
    const result = await connectExtraBot(
      sql,
      uid,
      data.token.trim(),
      data.publicOrigin.replace(/\/$/, ""),
      data.kind,
      data.label?.trim() || (data.kind === "logs" ? "Логи" : "Клиентский бот"),
    );
    if (result.ok) await addAudit(sql, uid, "connect_bot", "bot", data.kind, null, result.username, who(actor));
    return result;
  });

export const removeServiceBot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "bots")) return { ok: false as const, error: NO_PERM };
    await disconnectBotById(sql, uid, data.id);
    await addAudit(sql, uid, "remove_bot", "bot", String(data.id), null, null, who(actor));
    return { ok: true as const };
  });

export const saveRequisites = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { channel?: string; payCard?: string; payBank?: string; payHolder?: string; payAmount?: number; alertsChannel?: string; requireSubscribe?: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "bots")) return { ok: false as const, error: NO_PERM };
    let channel = (data.channel ?? "").trim();
    channel = channel.replace(/^https?:\/\//i, "").replace(/^(?:t\.me|telegram\.me)\//i, "").replace(/^@/, "");
    channel = channel.split(/[?#]/)[0].replace(/\/$/, "");
    const amount = Math.max(0, Math.round(Number(data.payAmount ?? 0) || 0));
    const rawAlerts = (data.alertsChannel ?? "").trim();
    let alerts = rawAlerts ? normalizeChatId(rawAlerts) : "";
    if (alerts && channel && !alerts.startsWith("-") && channelOverlap(channel, alerts)) alerts = "";
    const requireSub = data.requireSubscribe !== false;
    try {
      await sql`
        update as_workspace set
          channel_username = ${channel || null},
          require_subscribe = ${requireSub},
          pay_card = ${data.payCard?.trim() || null},
          pay_bank = ${data.payBank?.trim() || null},
          pay_holder = ${data.payHolder?.trim() || null},
          pay_amount = ${amount},
          alerts_channel_id = ${alerts || null}
        where user_id = ${uid}
      `;
    } catch {
      await sql`
        update as_workspace set
          channel_username = ${channel || null},
          pay_card = ${data.payCard?.trim() || null},
          pay_bank = ${data.payBank?.trim() || null},
          pay_holder = ${data.payHolder?.trim() || null},
          pay_amount = ${amount},
          alerts_channel_id = ${alerts || null}
        where user_id = ${uid}
      `;
    }
    if (alerts) {
      await sql`update as_bots set log_chat_id = ${alerts} where user_id = ${uid} and kind = ${"logs"}`;
    } else {
      try { await sql`update as_bots set log_chat_id = ${null} where user_id = ${uid} and kind = ${"logs"}`; } catch { /* ignore */ }
    }
    await addAudit(sql, uid, "save_requisites", "workspace", uid, null, channel || "requisites", who(actor));
    try { await sanitizeAlertRouting(sql, uid); } catch { /* ignore */ }
    return { ok: true as const, error: null as string | null };
  });

export const testAlerts = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d?: { channel?: string }) => d ?? {})
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "bots")) return { ok: false as const, error: NO_PERM };
    return sendWorkspaceAlertTest(sql, uid, data.channel);
  });

export const listPayments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    if (!can(actor, "finance")) return [];
    return sql<{
      id: number; client_name: string; telegram_id: string | null; amount: number; screenshot: string;
      status: string; created_at: string; client_id: number | null;
    }>`
      select id, client_name, telegram_id, amount, screenshot, status, created_at, client_id
      from as_payments where user_id = ${uid} order by created_at desc limit 80
    `;
  });

async function refreshClientPaid(
  sql: Awaited<ReturnType<typeof getSql>>,
  uid: string,
  clientId: number | null,
  telegramId: string | null,
) {
  const left = await sql<{ n: number }>`
    select count(*)::int as n from as_payments
    where user_id = ${uid} and status = 'approved'
      and (
        (${clientId ?? 0} > 0 and client_id = ${clientId ?? 0})
        or (${telegramId ?? ""} <> '' and telegram_id = ${telegramId ?? ""})
      )
  `;
  const paid = n(left[0]?.n) > 0;
  if (clientId) {
    if (paid) await sql`update as_clients set paid = true, paid_at = coalesce(paid_at, now()) where user_id = ${uid} and id = ${clientId}`;
    else await sql`update as_clients set paid = false, paid_at = null where user_id = ${uid} and id = ${clientId}`;
  } else if (telegramId) {
    if (paid) await sql`update as_clients set paid = true, paid_at = coalesce(paid_at, now()) where user_id = ${uid} and telegram_id = ${telegramId}`;
    else await sql`update as_clients set paid = false, paid_at = null where user_id = ${uid} and telegram_id = ${telegramId}`;
  }
  return paid;
}

export const reviewPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; approve: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "finance")) return { ok: false as const, error: NO_PERM };
    const row = await sql<{ id: number; telegram_id: string | null; client_id: number | null; client_name: string; status: string }>`
      select id, telegram_id, client_id, client_name, status from as_payments where user_id = ${uid} and id = ${data.id}
    `;
    if (!row[0]) return { ok: false as const, error: "Платёж не найден" };
    const status = data.approve ? "approved" : "rejected";
    const changed = await sql<{ id: number }>`
      update as_payments set status = ${status}, reviewed_at = now()
      where id = ${data.id} and user_id = ${uid} and status = 'pending'
      returning id
    `;
    if (!changed[0]) return { ok: false as const, error: "Платёж уже разобран" };
    if (data.approve) {
      if (row[0].client_id) {
        await sql`update as_clients set paid = true, paid_at = now() where user_id = ${uid} and id = ${row[0].client_id}`;
      } else if (row[0].telegram_id) {
        await sql`update as_clients set paid = true, paid_at = now() where user_id = ${uid} and telegram_id = ${row[0].telegram_id}`;
      }
    } else {
      await refreshClientPaid(sql, uid, row[0].client_id, row[0].telegram_id);
    }
    await addAudit(sql, uid, data.approve ? "approve_pay" : "reject_pay", "payment", String(data.id), null, row[0].client_name, who(actor));
    const ws = await sql<{ bot_token: string | null }>`select bot_token from as_workspace where user_id = ${uid}`;
    const token = ws[0]?.bot_token;
    const chat = row[0].telegram_id;
    if (token && chat && /^\d+$/.test(chat)) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: Number(chat),
            text: data.approve
              ? "Оплата подтверждена. Напишите /start — можно создавать заявки."
              : "Оплата не принята. Пришлите корректный скрин перевода.",
          }),
        });
      } catch { /* ignore */ }
    }
    return { ok: true as const, error: null };
  });

async function notifyClientPay(sql: Awaited<ReturnType<typeof getSql>>, uid: string, chat: string | null, text: string) {
  if (!chat || !/^\d+$/.test(chat)) return;
  const ws = await sql<{ bot_token: string | null }>`select bot_token from as_workspace where user_id = ${uid}`;
  const token = ws[0]?.bot_token;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: Number(chat), text }),
    });
  } catch { /* ignore */ }
}

export const addManualPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { clientId: number; amount?: number }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "finance")) return { ok: false as const, error: NO_PERM };
    const client = await sql<{ id: number; name: string; telegram_id: string | null; paid: boolean }>`
      select id, name, telegram_id, paid from as_clients where user_id = ${uid} and id = ${data.clientId}
    `;
    if (!client[0]) return { ok: false as const, error: "Клиент не найден" };
    let amount = Math.max(0, Math.round(Number(data.amount ?? 0) || 0));
    if (!amount) {
      const ws = await sql<{ pay_amount: number }>`select pay_amount from as_workspace where user_id = ${uid}`;
      amount = n(ws[0]?.pay_amount);
    }
    await sql`
      insert into as_payments (user_id, client_id, telegram_id, client_name, amount, screenshot, status, reviewed_at)
      values (${uid}, ${client[0].id}, ${client[0].telegram_id}, ${client[0].name}, ${amount}, ${"manual"}, ${"approved"}, now())
    `;
    await sql`update as_clients set paid = true, paid_at = now() where user_id = ${uid} and id = ${client[0].id}`;
    await addAudit(sql, uid, "add_pay", "client", String(client[0].id), null, `${client[0].name} · ${amount}`, who(actor));
    await notifyClientPay(sql, uid, client[0].telegram_id, "Оплата подтверждена администратором. Напишите /start — можно создавать заявки.");
    return { ok: true as const, error: null };
  });

export const revokePayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id?: number; clientId?: number }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "finance")) return { ok: false as const, error: NO_PERM };
    let clientId = data.clientId ?? null;
    let telegramId: string | null = null;
    let name = "";
    if (data.id) {
      const row = await sql<{ id: number; client_id: number | null; telegram_id: string | null; client_name: string }>`
        select id, client_id, telegram_id, client_name from as_payments where user_id = ${uid} and id = ${data.id}
      `;
      if (!row[0]) return { ok: false as const, error: "Платёж не найден" };
      await sql`update as_payments set status = ${"cancelled"}, reviewed_at = now() where user_id = ${uid} and id = ${data.id}`;
      clientId = row[0].client_id;
      telegramId = row[0].telegram_id;
      name = row[0].client_name;
      const still = await refreshClientPaid(sql, uid, clientId, telegramId);
      await addAudit(sql, uid, "revoke_pay", "payment", String(data.id), name, "cancelled", who(actor));
      await notifyClientPay(
        sql,
        uid,
        telegramId,
        still
          ? "Один платёж отменён. Доступ к заявкам сохранён — есть другая подтверждённая оплата."
          : "Доступ закрыт. Чтобы снова вызывать мастера — оплатите доступ.",
      );
      return { ok: true as const, error: null, access: still };
    } else if (clientId) {
      const row = await sql<{ id: number; telegram_id: string | null; client_name: string }>`
        select id, telegram_id, client_name from as_payments
        where user_id = ${uid} and client_id = ${clientId} and status = 'approved'
        order by id desc limit 1
      `;
      if (!row[0]) return { ok: false as const, error: "Нет подтверждённой оплаты" };
      await sql`update as_payments set status = ${"cancelled"}, reviewed_at = now() where user_id = ${uid} and id = ${row[0].id}`;
      telegramId = row[0].telegram_id;
      name = row[0].client_name;
      const still = await refreshClientPaid(sql, uid, clientId, telegramId);
      await addAudit(sql, uid, "revoke_pay", "client", String(clientId), name, "cancelled", who(actor));
      await notifyClientPay(
        sql,
        uid,
        telegramId,
        still
          ? "Последний платёж отменён. Доступ сохранён — есть другая подтверждённая оплата."
          : "Доступ закрыт. Чтобы снова вызывать мастера — оплатите доступ.",
      );
      return { ok: true as const, error: null, access: still };
    }
    return { ok: false as const, error: "Не указан платёж" };
  });

export const setMasterOnline = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { masterId: number; online: boolean; code: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid } = await ctxSql(context.userId);
    const self = await masterByCode(sql, uid, data.masterId, data.code);
    if (!self) return { ok: false as const, error: "Кабинет открыт только по коду этого мастера", status: "offline" as const };
    const status = data.online ? "online" : "offline";
    await sql`update as_masters set online_status = ${status}, last_seen = now() where user_id = ${uid} and id = ${data.masterId} and online_status <> 'blocked'`;
    return { ok: true as const, status };
  });

export const setStaffPerms = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; can_invite?: boolean; can_delete?: boolean; can_assign?: boolean; can_finance?: boolean; can_bots?: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireOwner(actor);
    const row = await sql<{ role: string; email: string; name: string }>`
      select role, email, name from as_staff where workspace_id = ${uid} and id = ${data.id}
    `;
    if (!row[0]) return { ok: false as const, error: "Не найден" };
    if (row[0].role === "owner") return { ok: false as const, error: "Права владельца нельзя менять" };
    await sql`
      update as_staff set
        can_invite = ${Boolean(data.can_invite)},
        can_delete = ${Boolean(data.can_delete)},
        can_assign = ${Boolean(data.can_assign)},
        can_finance = ${Boolean(data.can_finance)},
        can_bots = ${Boolean(data.can_bots)}
      where id = ${data.id} and workspace_id = ${uid}
    `;
    const flags = [
      data.can_invite ? "приглашать" : null,
      data.can_delete ? "удалять" : null,
      data.can_assign ? "назначать" : null,
      data.can_finance ? "пополнения" : null,
      data.can_bots ? "боты" : null,
    ].filter(Boolean).join(", ") || "без прав";
    await addAudit(sql, uid, "set_perms", "staff", String(data.id), row[0].email, flags, who(actor));
    return { ok: true as const, error: null };
  });

function makeRefCode() {
  return Math.random().toString(36).slice(2, 8);
}

export const listRefLinks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid } = await ctxSql(context.userId);
    const ws = await sql<{ bot_username: string | null }>`select bot_username from as_workspace where user_id = ${uid}`;
    const username = ws[0]?.bot_username ?? "";
    let campaigns: {
      id: number; code: string; label: string; source: string; clicks: number; joins: number; orders: number; created_at: string;
    }[] = [];
    try {
      campaigns = await sql`
        select id, code, label, source, clicks, joins, orders, created_at
        from as_ref_links where user_id = ${uid} order by created_at desc
      `;
    } catch { campaigns = []; }
    let people: { name: string; ref_code: string; invited: number }[] = [];
    try {
      people = await sql`
        select c.name, c.ref_code, count(o.id)::int as invited
        from as_clients c
        left join as_clients o on o.user_id = c.user_id and o.referred_by = c.ref_code
        where c.user_id = ${uid} and c.ref_code is not null
        group by c.id, c.name, c.ref_code
        having count(o.id) > 0
        order by count(o.id) desc
        limit 20
      `;
    } catch { people = []; }
    let bySource: { source: string; n: number }[] = [];
    try {
      bySource = await sql`
        select coalesce(nullif(ref_source, ''), 'organic') as source, count(*)::int as n
        from as_clients where user_id = ${uid} and name <> ${"Удалён"}
          and length(coalesce(telegram_id, '')) >= 8
        group by 1 order by n desc
      `;
    } catch { bySource = []; }
    return { username, campaigns, people, bySource };
  });

export const createRefLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { label: string; source: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    if (!can(actor, "bots")) return { ok: false as const, code: "", link: "", error: NO_PERM };
    const label = data.label.trim() || "Реклама";
    const source = (data.source || "ads").trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24) || "ads";
    const code = `c${makeRefCode()}`;
    await sql`
      insert into as_ref_links (user_id, code, label, source)
      values (${uid}, ${code}, ${label}, ${source})
    `;
    const ws = await sql<{ bot_username: string | null }>`select bot_username from as_workspace where user_id = ${uid}`;
    const username = ws[0]?.bot_username ?? "";
    const link = username ? `https://t.me/${username}?start=${code}` : code;
    return { ok: true as const, code, link, error: null as string | null };
  });

const STEP_RU: Record<string, string> = {
  lang: "выбор языка",
  role: "выбор: клиент или мастер",
  category: "меню после /start",
  problem: "описывает проблему",
  photo: "ждёт фото",
  geo_choice: "выбор геолокации",
  district: "выбирает район",
  geo: "отправляет геолокацию",
  phone: "ждёт телефон",
  comment: "комментарий к заявке",
  confirm: "подтверждает заявку",
  live: "есть активная заявка",
  support: "написал в поддержку",
  rate: "ставит оценку",
  idle: "в меню",
  master_spec: "мастер: не указал специализацию",
  master_phone: "мастер: не отправил телефон",
  master_geo: "мастер: не отправил геолокацию",
};

type PersonDraft = {
  name?: string;
  phone?: string;
  lang?: string;
  role?: string;
  city?: string;
  neighborhood?: string;
  districtId?: string;
  fullAddress?: string;
};

export const listBotPeople = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid } = await ctxSql(context.userId);
    const rows = await sql<{
      telegram_id: string | null;
      tg_name: string | null;
      tg_username: string | null;
      step: string | null;
      draft: string | null;
      started_at: string | null;
      session_at: string | null;
      client_id: number | null;
      client_name: string | null;
      client_phone: string | null;
      client_district: string | null;
      client_lang: string | null;
      client_role: string | null;
      paid: boolean | null;
      blocked: boolean | null;
      client_created: string | null;
      ref_code: string | null;
      referred_by: string | null;
      orders_count: number | null;
      master_id: number | null;
      master_first: string | null;
      master_last: string | null;
      master_phone: string | null;
      specialization: string | null;
      online_status: string | null;
      master_registered: string | null;
      master_city: string | null;
      master_district: string | null;
    }>`
      select
        coalesce(s.chat_id, c.telegram_id, m.telegram_id) as telegram_id,
        s.tg_name,
        s.tg_username,
        s.step,
        s.draft,
        s.started_at,
        s.updated_at as session_at,
        c.id as client_id,
        c.name as client_name,
        c.phone as client_phone,
        c.district as client_district,
        c.lang as client_lang,
        c.role as client_role,
        coalesce(c.paid, false) as paid,
        coalesce(c.blocked, false) as blocked,
        c.created_at as client_created,
        c.ref_code,
        c.referred_by,
        (select count(*)::int from as_orders o where o.client_id = c.id) as orders_count,
        m.id as master_id,
        m.first_name as master_first,
        m.last_name as master_last,
        m.phone as master_phone,
        m.specialization,
        m.online_status,
        m.registered_at as master_registered,
        m.city as master_city,
        m.district as master_district
      from (select * from as_tg_sessions where user_id = ${uid}) s
      full outer join (
        select * from as_clients
        where user_id = ${uid}
          and length(coalesce(telegram_id, '')) >= 5
          and name <> ${"Удалён"}
      ) c on c.telegram_id = s.chat_id
      full outer join (
        select * from as_masters
        where user_id = ${uid} and length(coalesce(telegram_id, '')) >= 5
      ) m on m.telegram_id = coalesce(s.chat_id, c.telegram_id)
      order by coalesce(s.updated_at, m.last_seen, m.registered_at, c.created_at) desc
    `;

    return rows.flatMap((row) => {
      const telegramId = row.telegram_id ?? "";
      if (telegramId.length < 5) return [];
      let draft: PersonDraft = {};
      try {
        draft = JSON.parse(row.draft || "{}") as PersonDraft;
      } catch {
        draft = {};
      }
      const master = Boolean(row.master_id);
      const registeringMaster = !master && (row.step ?? "").startsWith("master_");
      const phone = (master ? row.master_phone : row.client_phone) || draft.phone || "";
      const finishedClient = Boolean(row.client_id) && phone.trim().length >= 5;
      const role = master && row.client_id ? "both" : master || registeringMaster ? "master" : "client";
      const stage = master
        ? "зарегистрирован"
        : registeringMaster
          ? "регистрация не закончена"
          : finishedClient
            ? "зарегистрирован"
            : "только /start";
      const name = master
        ? [row.master_first, row.master_last].filter(Boolean).join(" ")
        : row.client_name || row.tg_name || draft.name || "Без имени";
      return [{
        telegramId,
        username: row.tg_username || "",
        name,
        role,
        stage,
        step: STEP_RU[row.step ?? ""] ?? (row.step || "нет сессии"),
        phone,
        lang: row.client_lang || draft.lang || "",
        place: [row.master_district || row.client_district || draft.neighborhood || draft.districtId || "", row.master_city || draft.city || ""].filter(Boolean).join(", "),
        specialization: row.specialization || "",
        online: row.online_status || "",
        orders: row.orders_count ?? 0,
        paid: Boolean(row.paid),
        blocked: Boolean(row.blocked),
        ref: row.referred_by || "",
        seenAt: row.session_at || row.master_registered || row.client_created || row.started_at,
      }];
    });
  });

export { SERVICES, clientLabel };
