import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { SERVICES } from "@/lib/catalog";
import { ASSIGNABLE, haversineKm, clientLabel, type OrderStatus, type OnlineStatus } from "@/lib/domain";
import { addAudit, addEvent, addNote, tickPresence } from "./workspace";
import { insertOrder, type CreateOrderInput } from "./orders";
import { connectTelegramBot, connectExtraBot, disconnectTelegramBot, disconnectBotById, pushOrderStatus } from "./telegram";
import { actorCtx, requireAdmin, requireOwner } from "./access";

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
};
export type NoteRow = { id: number; kind: string; title: string; body: string; order_id: number | null; master_id: number | null; read: boolean; created_at: string };
export type EventRow = { id: number; event_type: string; actor: string; metadata: string; created_at: string };
export type ClientListRow = {
  id: number; name: string; phone: string; telegram_id: string | null; district: string;
  rating: number; blocked: boolean; created_at: string; last_active: string | null;
  orders_count: number; completed_count: number; cancelled_count: number;
  lang: string; role: string; lat: number | null; lng: number | null;
};
export type ReviewListRow = { id: number; rating: number; comment: string; created_at: string; public_no: number; client_name: string | null; master_name: string | null };
export type AuditRow = { id: number; action: string; object_type: string; object_id: string; old_value: string | null; new_value: string | null; created_at: string };

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
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
  };
}

const ORDER_SELECT = `
  o.*, c.name as client_name, c.telegram_id as client_tg, coalesce(c.rating, 5) as client_rating,
  case when m.id is null then null else m.first_name || ' ' || m.last_name end as master_name
`;

async function listMastersInner(sql: Awaited<ReturnType<typeof getSql>>, uid: string) {
  const rows = await sql`select * from as_masters where user_id = ${uid} order by rating desc`;
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
        from as_clients where user_id = ${uid}`,
      sql<{ total: number; online: number; busy: number; offline: number }>`
        select count(*)::int as total,
          count(*) filter (where online_status = 'online')::int as online,
          count(*) filter (where online_status = 'busy')::int as busy,
          count(*) filter (where online_status = 'offline')::int as offline
        from as_masters where user_id = ${uid}`,
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
    const notes = await sql<NoteRow>`select id, kind, title, body, order_id, master_id, read, created_at from as_notifications where user_id = ${uid} order by created_at desc limit 8`;
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
      finance: {
        today: n(finance[0]?.today),
        week: n(finance[0]?.week),
        month: n(finance[0]?.month),
        avg: n(finance[0]?.avg),
        payout: n(finance[0]?.payout),
      },
      recent: recentOrders.map(mapOrder),
      notifications: notes,
      bot,
      role: actor.role,
    };
  });

export const listOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((q: { status?: string; q?: string } | undefined) => q ?? {})
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    const status = data.status && data.status !== "all" ? data.status : null;
    const search = data.q?.trim() ? `%${data.q.trim()}%` : null;
    const rows = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT}
       from as_orders o join as_clients c on c.id = o.client_id left join as_masters m on m.id = o.master_id
       where o.user_id = $1
         and ($2::text is null
           or ($2 = 'waiting' and o.status in ('waiting_admin','master_rejected'))
           or ($2 = 'work' and o.status in ('master_accepted','enroute','arrived','in_progress'))
           or o.status = $2)
         and ($3::text is null or c.name ilike $3 or o.description ilike $3 or o.phone ilike $3 or o.public_no::text ilike $3)
       order by o.created_at desc limit 80`,
      [uid, status, search],
    );
    return rows.map(mapOrder);
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
    if (!rows[0]) return { master: null, orders: [] as OrderRow[], reviews: [] as ReviewListRow[] };
    const orders = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT} from as_orders o join as_clients c on c.id = o.client_id left join as_masters m on m.id = o.master_id where o.user_id = $1 and o.master_id = $2 order by o.created_at desc limit 30`,
      [uid, id],
    );
    const reviews = await sql<ReviewListRow>`
      select r.id, r.rating, r.comment, r.created_at, o.public_no, c.name as client_name, '' as master_name
      from as_reviews r left join as_orders o on o.id = r.order_id left join as_clients c on c.id = r.client_id
      where r.user_id = ${uid} and r.master_id = ${id} order by r.created_at desc`;
    return { master: mapMaster(rows[0] as Record<string, unknown>), orders: orders.map(mapOrder), reviews };
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
        cl.lat, cl.lng
      from as_clients cl
      left join as_orders o on o.client_id = cl.id
      where cl.user_id = ${uid}
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
    if (!o[0]) return { error: "ORDER_NOT_FOUND" as const, masters: [] as (MasterRow & { km: number | null; recommended: boolean })[] };
    const masters = await listMastersInner(sql, uid);
    const olat = o[0].lat == null ? null : n(o[0].lat);
    const olng = o[0].lng == null ? null : n(o[0].lng);
    const spec = String(o[0].category_slug);
    const scored = masters.map((m) => {
      const km = olat != null && olng != null && m.lat != null && m.lng != null ? haversineKm(olat, olng, m.lat, m.lng) : null;
      const recommended = m.specialization === spec && m.online_status !== "offline" && m.online_status !== "blocked" && m.active_orders < 3;
      return { ...m, km, recommended };
    });
    scored.sort((a, b) => {
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
    const o = await sql`select * from as_orders where user_id = ${uid} and id = ${data.orderId}`;
    const order = o[0] as Record<string, unknown> | undefined;
    if (!order) return { success: false as const, error: "ORDER_NOT_FOUND" };
    const status = String(order.status) as OrderStatus;
    if (!ASSIGNABLE.includes(status)) return { success: false as const, error: "ORDER_NOT_ASSIGNABLE" };
    const m = await sql`select * from as_masters where user_id = ${uid} and id = ${data.masterId}`;
    const master = m[0] as Record<string, unknown> | undefined;
    if (!master) return { success: false as const, error: "MASTER_NOT_FOUND" };
    if (String(master.online_status) === "blocked") return { success: false as const, error: "MASTER_BLOCKED" };
    await sql`update as_orders set master_id = ${data.masterId}, status = 'assigned', assigned_at = now(), updated_at = now() where user_id = ${uid} and id = ${data.orderId}`;
    await addEvent(sql, uid, data.orderId, "assigned", "admin", { masterId: data.masterId });
    await addAudit(sql, uid, "assign_master", "order", String(data.orderId), null, String(data.masterId));
    const name = `${master.first_name} ${master.last_name}`;
    await addNote(sql, uid, "master", `Вам назначен заказ №${order.public_no}`, String(order.description), data.orderId, data.masterId);
    await pushOrderStatus(sql, uid, data.orderId, "assigned", name);
    return { success: true as const, error: null, masterName: name };
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((orderId: number) => orderId)
  .handler(async ({ context, data: orderId }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    await sql`update as_orders set status = 'cancelled', cancelled_at = now(), updated_at = now() where user_id = ${uid} and id = ${orderId} and status <> 'completed'`;
    await addEvent(sql, uid, orderId, "cancelled", "admin", {});
    await pushOrderStatus(sql, uid, orderId, "cancelled", null);
    return { success: true };
  });

export const masterDecision = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orderId: number; accept: boolean; masterId: number }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    const o = await sql`select * from as_orders where user_id = ${uid} and id = ${data.orderId}`;
    const order = o[0] as Record<string, unknown> | undefined;
    if (!order) return { success: false as const, error: "ORDER_NOT_FOUND" };
    if (n(order.master_id) !== data.masterId) return { success: false as const, error: "NOT_ASSIGNED" };
    if (String(order.status) !== "assigned") return { success: false as const, error: "WRONG_STATUS" };
    if (data.accept) {
      await sql`update as_orders set status = 'master_accepted', accepted_at = now(), updated_at = now() where user_id = ${uid} and id = ${data.orderId}`;
      await sql`update as_masters set accepted_orders = accepted_orders + 1, online_status = 'busy', last_seen = now() where user_id = ${uid} and id = ${data.masterId}`;
      await addEvent(sql, uid, data.orderId, "master_accepted", "master", {});
      await pushOrderStatus(sql, uid, data.orderId, "master_accepted", null);
    } else {
      await sql`update as_orders set status = 'master_rejected', updated_at = now() where user_id = ${uid} and id = ${data.orderId}`;
      await sql`update as_masters set rejected_orders = rejected_orders + 1, last_seen = now() where user_id = ${uid} and id = ${data.masterId}`;
      await addEvent(sql, uid, data.orderId, "master_rejected", "master", { masterId: data.masterId });
      await addNote(sql, uid, "admin", `Мастер отказался от заявки №${order.public_no}`, "Назначьте другого мастера", data.orderId, null);
      await pushOrderStatus(sql, uid, data.orderId, "master_rejected", null);
    }
    return { success: true as const, error: null };
  });

export const masterAdvance = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orderId: number; masterId: number; to: OrderStatus }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    const allowed: Record<string, OrderStatus> = { master_accepted: "enroute", enroute: "arrived", arrived: "in_progress", in_progress: "completed" };
    const o = await sql`select * from as_orders where user_id = ${uid} and id = ${data.orderId}`;
    const order = o[0] as Record<string, unknown> | undefined;
    if (!order) return { success: false as const, error: "ORDER_NOT_FOUND" };
    if (n(order.master_id) !== data.masterId) return { success: false as const, error: "NOT_ASSIGNED" };
    if (allowed[String(order.status)] !== data.to) return { success: false as const, error: "WRONG_STATUS" };
    if (data.to === "enroute") await sql`update as_orders set status = 'enroute', updated_at = now() where user_id = ${uid} and id = ${data.orderId}`;
    else if (data.to === "arrived") await sql`update as_orders set status = 'arrived', arrived_at = now(), updated_at = now() where user_id = ${uid} and id = ${data.orderId}`;
    else if (data.to === "in_progress") await sql`update as_orders set status = 'in_progress', started_at = now(), updated_at = now() where user_id = ${uid} and id = ${data.orderId}`;
    else if (data.to === "completed") {
      await sql`update as_orders set status = 'completed', completed_at = now(), updated_at = now() where user_id = ${uid} and id = ${data.orderId}`;
      await sql`update as_masters set completed_orders = completed_orders + 1, earnings = earnings + ${n(order.master_payout)}, online_status = 'online', last_seen = now() where user_id = ${uid} and id = ${data.masterId}`;
    }
    await addEvent(sql, uid, data.orderId, data.to, "master", {});
    await pushOrderStatus(sql, uid, data.orderId, data.to, null);
    return { success: true as const, error: null };
  });

export const heartbeatMaster = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((masterId: number) => masterId)
  .handler(async ({ context, data: masterId }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    const busy = await sql<{ n: number }>`select count(*)::int as n from as_orders where user_id = ${uid} and master_id = ${masterId} and status in ('assigned','master_accepted','enroute','arrived','in_progress')`;
    const status = n(busy[0]?.n) > 0 ? "busy" : "online";
    await sql`update as_masters set last_seen = now(), online_status = ${status} where user_id = ${uid} and id = ${masterId} and online_status <> 'blocked'`;
    return { ok: true, status };
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: CreateOrderInput) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    return insertOrder(sql, uid, data);
  });

export const rateOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orderId: number; rating: number }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    const o = await sql`select * from as_orders where user_id = ${uid} and id = ${data.orderId}`;
    const order = o[0] as Record<string, unknown> | undefined;
    if (!order || String(order.status) !== "completed") return { success: false };
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
  const { sql, uid, actor } = await ctxSql(context.userId);
  return sql<AuditRow>`select id, action, object_type, object_id, old_value, new_value, created_at from as_audit where user_id = ${uid} order by created_at desc limit 100`;
});

export const listNotifications = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
  const { sql, uid, actor } = await ctxSql(context.userId);
  return sql<NoteRow>`select id, kind, title, body, order_id, master_id, read, created_at from as_notifications where user_id = ${uid} order by created_at desc limit 40`;
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
    const row = await sql<{
      bot_username: string | null; webhook_id: string | null; bot_connected_at: string | null; bot_token: string | null;
      poll_mode: boolean; channel_username: string | null; pay_card: string | null; pay_bank: string | null;
      pay_holder: string | null; pay_amount: number; alerts_channel_id: string | null;
    }>`
      select bot_username, webhook_id, bot_connected_at, bot_token, poll_mode,
        channel_username, pay_card, pay_bank, pay_holder, pay_amount, alerts_channel_id
      from as_workspace where user_id = ${uid}`;
    const w = row[0];
    const token = w?.bot_token ?? "";
    const masked = token ? `${token.slice(0, 8)}…${token.slice(-4)}` : null;
    return {
      connected: Boolean(w?.bot_username),
      username: w?.bot_username ?? null,
      webhookId: w?.webhook_id ?? null,
      connectedAt: w?.bot_connected_at ?? null,
      tokenMasked: masked,
      pollMode: Boolean(w?.poll_mode),
      channel: w?.channel_username ?? "",
      payCard: w?.pay_card ?? "",
      payBank: w?.pay_bank ?? "",
      payHolder: w?.pay_holder ?? "",
      payAmount: n(w?.pay_amount),
      alertsChannel: w?.alerts_channel_id ?? "",
      role: actor.role,
      email: actor.email,
    };
  });

export const saveBotToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { token: string; publicOrigin: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    return connectTelegramBot(sql, uid, data.token.trim(), data.publicOrigin.replace(/\/$/, ""));
  });

export const dropBotToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    await disconnectTelegramBot(sql, uid);
    return { ok: true };
  });

export const getAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { actor } = await ctxSql(context.userId);
    return { role: actor.role, email: actor.email, name: actor.name, workspaceId: actor.workspaceId };
  });

export const listStaff = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid } = await ctxSql(context.userId);
    return sql<{
      id: number; user_id: string | null; email: string; name: string; role: string; blocked: boolean; created_at: string;
    }>`
      select id, user_id, email, name, role, blocked, created_at
      from as_staff where workspace_id = ${uid} order by role asc, created_at asc
    `;
  });

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { email: string; role?: string; name?: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireOwner(actor);
    const email = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: "Некорректный email" };
    const role = data.role === "owner" ? "admin" : "admin";
    const exists = await sql<{ id: number }>`select id from as_staff where workspace_id = ${uid} and email = ${email}`;
    if (exists[0]) return { ok: false as const, error: "Этот email уже в команде" };
    await sql`
      insert into as_staff (workspace_id, user_id, email, name, role, blocked)
      values (${uid}, ${null}, ${email}, ${data.name?.trim() || email}, ${role}, ${false})
    `;
    await addAudit(sql, uid, "invite_staff", "staff", email, null, role);
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
    await addAudit(sql, uid, data.blocked ? "block_staff" : "unblock_staff", "staff", String(data.id), null, row[0].email);
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
    await addAudit(sql, uid, "delete_staff", "staff", String(data.id), row[0].email, null);
    return { ok: true as const, error: null };
  });

export const setClientBlocked = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; blocked: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    const row = await sql<{ id: number; name: string }>`select id, name from as_clients where user_id = ${uid} and id = ${data.id}`;
    if (!row[0]) return { ok: false as const, error: "Клиент не найден" };
    await sql`update as_clients set blocked = ${data.blocked} where user_id = ${uid} and id = ${data.id}`;
    await addAudit(sql, uid, data.blocked ? "block_client" : "unblock_client", "client", String(data.id), null, row[0].name);
    return { ok: true as const, error: null };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    const row = await sql<{ name: string }>`select name from as_clients where user_id = ${uid} and id = ${data.id}`;
    if (!row[0]) return { ok: false as const, error: "Клиент не найден" };
    await sql`
      update as_clients
      set name = ${"Удалён"}, phone = ${""}, telegram_id = ${null}, blocked = ${false}, paid = ${false}
      where user_id = ${uid} and id = ${data.id}
    `;
    await addAudit(sql, uid, "delete_client", "client", String(data.id), row[0].name, "anonymized");
    return { ok: true as const, error: null };
  });

export const setMasterBlocked = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; blocked: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    const status = data.blocked ? "blocked" : "offline";
    await sql`update as_masters set online_status = ${status} where user_id = ${uid} and id = ${data.id}`;
    await addAudit(sql, uid, data.blocked ? "block_master" : "unblock_master", "master", String(data.id), null, status);
    return { ok: true as const, error: null };
  });

export const deleteMaster = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    const active = await sql<{ n: number }>`
      select count(*)::int as n from as_orders
      where user_id = ${uid} and master_id = ${data.id}
        and status in ('assigned','master_accepted','enroute','arrived','in_progress')
    `;
    if (n(active[0]?.n)) return { ok: false as const, error: "Сначала закройте активные заявки мастера" };
    await sql`update as_orders set master_id = null where user_id = ${uid} and master_id = ${data.id}`;
    await sql`delete from as_masters where user_id = ${uid} and id = ${data.id}`;
    await addAudit(sql, uid, "delete_master", "master", String(data.id), null, null);
    return { ok: true as const, error: null };
  });

export type BotListRow = {
  id: number; kind: string; label: string; bot_username: string | null; connected_at: string | null;
  log_chat_id: string | null; tokenMasked: string | null;
};

export const listBots = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid } = await ctxSql(context.userId);
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
    const result = await connectExtraBot(
      sql,
      uid,
      data.token.trim(),
      data.publicOrigin.replace(/\/$/, ""),
      data.kind,
      data.label?.trim() || (data.kind === "logs" ? "Логи" : "Клиентский бот"),
    );
    if (result.ok) await addAudit(sql, uid, "connect_bot", "bot", data.kind, null, result.username);
    return result;
  });

export const removeServiceBot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    await disconnectBotById(sql, uid, data.id);
    await addAudit(sql, uid, "remove_bot", "bot", String(data.id), null, null);
    return { ok: true as const };
  });

export const saveRequisites = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { channel?: string; payCard?: string; payBank?: string; payHolder?: string; payAmount?: number; alertsChannel?: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    const channel = (data.channel ?? "").replace(/^@/, "").trim();
    const amount = Math.max(0, Math.round(Number(data.payAmount ?? 0) || 0));
    const alerts = (data.alertsChannel ?? "").trim();
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
    if (alerts) {
      await sql`update as_bots set log_chat_id = ${alerts} where user_id = ${uid} and kind = ${"logs"}`;
      const log = await sql<{ bot_token: string | null }>`
        select bot_token from as_bots where user_id = ${uid} and kind = ${"logs"} and bot_token is not null limit 1
      `;
      if (log[0]?.bot_token) {
        try {
          await fetch(`https://api.telegram.org/bot${log[0].bot_token}/sendMessage`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              chat_id: Number(alerts),
              text: "All Servis: алерты подключены к этому каналу.",
            }),
          });
        } catch { /* ignore */ }
      }
    }
    await addAudit(sql, uid, "save_requisites", "workspace", uid, null, channel || "requisites");
    return { ok: true as const };
  });

export const listPayments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, uid } = await ctxSql(context.userId);
    return sql<{
      id: number; client_name: string; telegram_id: string | null; amount: number; screenshot: string;
      status: string; created_at: string; client_id: number | null;
    }>`
      select id, client_name, telegram_id, amount, screenshot, status, created_at, client_id
      from as_payments where user_id = ${uid} order by created_at desc limit 80
    `;
  });

export const reviewPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; approve: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid, actor } = await ctxSql(context.userId);
    requireAdmin(actor);
    const row = await sql<{ id: number; telegram_id: string | null; client_id: number | null; client_name: string; status: string }>`
      select id, telegram_id, client_id, client_name, status from as_payments where user_id = ${uid} and id = ${data.id}
    `;
    if (!row[0]) return { ok: false as const, error: "Платёж не найден" };
    const status = data.approve ? "approved" : "rejected";
    await sql`update as_payments set status = ${status}, reviewed_at = now() where id = ${data.id} and user_id = ${uid}`;
    if (data.approve) {
      if (row[0].client_id) {
        await sql`update as_clients set paid = true, paid_at = now() where user_id = ${uid} and id = ${row[0].client_id}`;
      } else if (row[0].telegram_id) {
        await sql`update as_clients set paid = true, paid_at = now() where user_id = ${uid} and telegram_id = ${row[0].telegram_id}`;
      }
    }
    await addAudit(sql, uid, data.approve ? "approve_pay" : "reject_pay", "payment", String(data.id), null, row[0].client_name);
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

export const setMasterOnline = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { masterId: number; online: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { sql, uid } = await ctxSql(context.userId);
    const status = data.online ? "online" : "offline";
    await sql`update as_masters set online_status = ${status}, last_seen = now() where user_id = ${uid} and id = ${data.masterId} and online_status <> 'blocked'`;
    return { ok: true as const, status };
  });

export { SERVICES, clientLabel };
