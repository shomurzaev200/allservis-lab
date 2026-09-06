import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { SERVICES, serviceById } from "@/lib/catalog";
import {
  ASSIGNABLE,
  haversineKm,
  type OrderStatus,
  type OnlineStatus,
} from "@/lib/domain";
import { addAudit, addEvent, addNote, ensureWorkspace, tickPresence } from "./workspace";

async function ctxSql(userId: string) {
  const sql = await getSql();
  await ensureWorkspace(sql, userId);
  return sql;
}

export type MasterRow = {
  id: number;
  first_name: string;
  last_name: string;
  telegram_id: string | null;
  phone: string;
  city: string;
  district: string;
  specialization: string;
  rating: number;
  completed_orders: number;
  cancelled_orders: number;
  rejected_orders: number;
  accepted_orders: number;
  online_status: OnlineStatus;
  last_seen: string;
  lat: number | null;
  lng: number | null;
  registered_at: string;
  avg_minutes: number;
  earnings: number;
  active_orders: number;
};

export type OrderRow = {
  id: number;
  public_no: number;
  client_id: number;
  master_id: number | null;
  category_slug: string;
  description: string;
  phone: string;
  city: string;
  district: string;
  address: string;
  lat: number | null;
  lng: number | null;
  status: OrderStatus;
  photos: string;
  comment: string;
  price: number;
  master_payout: number;
  created_at: string;
  assigned_at: string | null;
  accepted_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
  client_name: string;
  client_tg: string | null;
  client_rating: number;
  master_name: string | null;
};

export type NoteRow = {
  id: number;
  kind: string;
  title: string;
  body: string;
  order_id: number | null;
  master_id: number | null;
  read: boolean;
  created_at: string;
};

export type EventRow = {
  id: number;
  event_type: string;
  actor: string;
  metadata: string;
  created_at: string;
};

export type ClientListRow = {
  id: number;
  name: string;
  phone: string;
  telegram_id: string | null;
  district: string;
  rating: number;
  blocked: boolean;
  created_at: string;
  last_active: string | null;
  orders_count: number;
  completed_count: number;
  cancelled_count: number;
};

export type ReviewListRow = {
  id: number;
  rating: number;
  comment: string;
  created_at: string;
  public_no: number;
  client_name: string | null;
  master_name: string | null;
};

export type AuditRow = {
  id: number;
  action: string;
  object_type: string;
  object_id: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

export type MapClient = {
  id: number;
  name: string;
  lat: number | null;
  lng: number | null;
  district: string;
};

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mapMaster(r: Record<string, unknown>, active = 0): MasterRow {
  return {
    id: n(r.id),
    first_name: String(r.first_name),
    last_name: String(r.last_name),
    telegram_id: r.telegram_id ? String(r.telegram_id) : null,
    phone: String(r.phone ?? ""),
    city: String(r.city ?? ""),
    district: String(r.district ?? ""),
    specialization: String(r.specialization),
    rating: n(r.rating),
    completed_orders: n(r.completed_orders),
    cancelled_orders: n(r.cancelled_orders),
    rejected_orders: n(r.rejected_orders),
    accepted_orders: n(r.accepted_orders),
    online_status: r.online_status as OnlineStatus,
    last_seen: String(r.last_seen),
    lat: r.lat == null ? null : n(r.lat),
    lng: r.lng == null ? null : n(r.lng),
    registered_at: String(r.registered_at),
    avg_minutes: n(r.avg_minutes),
    earnings: n(r.earnings),
    active_orders: active,
  };
}

function mapOrder(r: Record<string, unknown>): OrderRow {
  return {
    id: n(r.id),
    public_no: n(r.public_no),
    client_id: n(r.client_id),
    master_id: r.master_id == null ? null : n(r.master_id),
    category_slug: String(r.category_slug),
    description: String(r.description),
    phone: String(r.phone ?? ""),
    city: String(r.city ?? ""),
    district: String(r.district ?? ""),
    address: String(r.address ?? ""),
    lat: r.lat == null ? null : n(r.lat),
    lng: r.lng == null ? null : n(r.lng),
    status: r.status as OrderStatus,
    photos: String(r.photos ?? "[]"),
    comment: String(r.comment ?? ""),
    price: n(r.price),
    master_payout: n(r.master_payout),
    created_at: String(r.created_at),
    assigned_at: r.assigned_at ? String(r.assigned_at) : null,
    accepted_at: r.accepted_at ? String(r.accepted_at) : null,
    arrived_at: r.arrived_at ? String(r.arrived_at) : null,
    started_at: r.started_at ? String(r.started_at) : null,
    completed_at: r.completed_at ? String(r.completed_at) : null,
    cancelled_at: r.cancelled_at ? String(r.cancelled_at) : null,
    updated_at: String(r.updated_at),
    client_name: String(r.client_name ?? ""),
    client_tg: r.client_tg ? String(r.client_tg) : null,
    client_rating: n(r.client_rating),
    master_name: r.master_name ? String(r.master_name) : null,
  };
}

const ORDER_SELECT = `
  o.*, c.name as client_name, c.telegram_id as client_tg, c.rating as client_rating,
  case when m.id is null then null else m.first_name || ' ' || m.last_name end as master_name
`;

export const bootstrap = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ctxSql(context.userId);
    await tickPresence(sql, context.userId);
    return { ok: true };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ctxSql(context.userId);
    await tickPresence(sql, context.userId);
    const uid = context.userId;

    const [clients, masters, orders, finance, returning] = await Promise.all([
      sql<{ total: number; today: number; week: number; blocked: number }>`
        select
          count(*)::int as total,
          count(*) filter (where created_at >= current_date)::int as today,
          count(*) filter (where created_at >= current_date - interval '7 days')::int as week,
          count(*) filter (where blocked)::int as blocked
        from as_clients where user_id = ${uid}
      `,
      sql<{ total: number; online: number; busy: number; offline: number; blocked: number; free: number }>`
        select
          count(*)::int as total,
          count(*) filter (where online_status = 'online')::int as online,
          count(*) filter (where online_status = 'busy')::int as busy,
          count(*) filter (where online_status = 'offline')::int as offline,
          count(*) filter (where online_status = 'blocked')::int as blocked,
          count(*) filter (
            where online_status = 'online'
              and not exists (
                select 1 from as_orders o
                where o.master_id = as_masters.id
                  and o.status in ('assigned','master_accepted','enroute','arrived','in_progress')
              )
          )::int as free
        from as_masters where user_id = ${uid}
      `,
      sql<{
        total: number; today: number; week: number; waiting: number; assigned: number;
        work: number; done: number; cancelled: number; rejected: number;
      }>`
        select
          count(*)::int as total,
          count(*) filter (where created_at >= current_date)::int as today,
          count(*) filter (where created_at >= current_date - interval '7 days')::int as week,
          count(*) filter (where status in ('waiting_admin','master_rejected'))::int as waiting,
          count(*) filter (where status = 'assigned')::int as assigned,
          count(*) filter (where status in ('master_accepted','enroute','arrived','in_progress'))::int as work,
          count(*) filter (where status = 'completed')::int as done,
          count(*) filter (where status = 'cancelled')::int as cancelled,
          count(*) filter (where status = 'master_rejected')::int as rejected
        from as_orders where user_id = ${uid}
      `,
      sql<{ today: number; week: number; month: number; avg: number; payout: number }>`
        select
          coalesce(sum(price) filter (where status = 'completed' and completed_at >= current_date), 0)::int as today,
          coalesce(sum(price) filter (where status = 'completed' and completed_at >= current_date - interval '7 days'), 0)::int as week,
          coalesce(sum(price) filter (where status = 'completed' and completed_at >= date_trunc('month', now())), 0)::int as month,
          coalesce(avg(price) filter (where status = 'completed'), 0)::int as avg,
          coalesce(sum(master_payout) filter (where status = 'completed'), 0)::int as payout
        from as_orders where user_id = ${uid}
      `,
      sql<{ n: number }>`
        select count(*)::int as n from (
          select client_id from as_orders where user_id = ${uid} group by client_id having count(*) > 1
        ) t
      `,
    ]);

    const recentOrders = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT}
       from as_orders o
       join as_clients c on c.id = o.client_id
       left join as_masters m on m.id = o.master_id
       where o.user_id = $1
       order by o.created_at desc
       limit 8`,
      [uid],
    );

    const notes = await sql<NoteRow>`
      select id, kind, title, body, order_id, master_id, read, created_at
      from as_notifications where user_id = ${uid} order by created_at desc limit 8
    `;

    return {
      clients: {
        ...clients[0]!,
        active: n(clients[0]?.total) - n(clients[0]?.blocked),
        returning: n(returning[0]?.n),
      },
      masters: masters[0]!,
      orders: orders[0]!,
      finance: finance[0]!,
      recent: recentOrders.map(mapOrder),
      notifications: notes,
    };
  });

export const listOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((q: { status?: string; q?: string; limit?: number } | undefined) => q ?? {})
  .handler(async ({ context, data }) => {
    const sql = await ctxSql(context.userId);
    const uid = context.userId;
    const status = data.status && data.status !== "all" ? data.status : null;
    const search = data.q?.trim() ? `%${data.q.trim()}%` : null;
    const limit = Math.min(data.limit ?? 80, 200);

    const rows = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT}
       from as_orders o
       join as_clients c on c.id = o.client_id
       left join as_masters m on m.id = o.master_id
       where o.user_id = $1
         and (
           $2::text is null
           or ($2 = 'waiting' and o.status in ('waiting_admin','master_rejected'))
           or ($2 = 'work' and o.status in ('master_accepted','enroute','arrived','in_progress'))
           or o.status = $2
         )
         and ($3::text is null or c.name ilike $3 or o.description ilike $3 or o.phone ilike $3 or o.public_no::text ilike $3)
       order by o.created_at desc
       limit $4`,
      [uid, status, search, limit],
    );
    return rows.map(mapOrder);
  });

export const getOrder = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await ctxSql(context.userId);
    const rows = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT}
       from as_orders o
       join as_clients c on c.id = o.client_id
       left join as_masters m on m.id = o.master_id
       where o.user_id = $1 and o.id = $2`,
      [context.userId, id],
    );
    const order = rows[0] ? mapOrder(rows[0]) : null;
    if (!order) return { error: "ORDER_NOT_FOUND" as const, order: null, events: [], clientOrders: 0, master: null };

    const events = await sql<EventRow>`
      select id, event_type, actor, metadata, created_at
      from as_order_events where user_id = ${context.userId} and order_id = ${id}
      order by created_at asc
    `;
    const clientOrders = await sql<{ n: number }>`
      select count(*)::int as n from as_orders where user_id = ${context.userId} and client_id = ${order.client_id}
    `;
    let master: MasterRow | null = null;
    if (order.master_id) {
      const m = await sql`select * from as_masters where user_id = ${context.userId} and id = ${order.master_id}`;
      if (m[0]) master = mapMaster(m[0] as Record<string, unknown>);
    }
    return { order, events, clientOrders: n(clientOrders[0]?.n), master, error: null };
  });

export const listMasters = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ctxSql(context.userId);
    await tickPresence(sql, context.userId);
    const rows = await sql`select * from as_masters where user_id = ${context.userId} order by rating desc`;
    const active = await sql<{ master_id: number; n: number }>`
      select master_id, count(*)::int as n from as_orders
      where user_id = ${context.userId} and master_id is not null
        and status in ('assigned','master_accepted','enroute','arrived','in_progress')
      group by master_id
    `;
    const map = new Map(active.map((a) => [n(a.master_id), n(a.n)]));
    return rows.map((r) => mapMaster(r as Record<string, unknown>, map.get(n((r as { id: number }).id)) ?? 0));
  });

export const getMaster = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await ctxSql(context.userId);
    const rows = await sql`select * from as_masters where user_id = ${context.userId} and id = ${id}`;
    if (!rows[0]) return { master: null, orders: [] as OrderRow[], reviews: [] as ReviewListRow[] };
    const active = await sql<{ n: number }>`
      select count(*)::int as n from as_orders
      where user_id = ${context.userId} and master_id = ${id}
        and status in ('assigned','master_accepted','enroute','arrived','in_progress')
    `;
    const orders = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT}
       from as_orders o join as_clients c on c.id = o.client_id
       left join as_masters m on m.id = o.master_id
       where o.user_id = $1 and o.master_id = $2
       order by o.created_at desc limit 30`,
      [context.userId, id],
    );
    const reviews = await sql<ReviewListRow>`
      select r.id, r.rating, r.comment, r.created_at, coalesce(o.public_no, 0) as public_no,
             coalesce(c.name, '') as client_name, '' as master_name
      from as_reviews r
      left join as_orders o on o.id = r.order_id
      left join as_clients c on c.id = r.client_id
      where r.user_id = ${context.userId} and r.master_id = ${id}
      order by r.created_at desc
    `;
    return {
      master: mapMaster(rows[0] as Record<string, unknown>, n(active[0]?.n)),
      orders: orders.map(mapOrder),
      reviews,
    };
  });

export const listClients = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ctxSql(context.userId);
    const rows = await sql<ClientListRow>`
      select cl.id, cl.name, cl.phone, cl.telegram_id, cl.district, cl.rating, cl.blocked, cl.created_at,
        max(o.created_at) as last_active,
        count(o.id)::int as orders_count,
        count(o.id) filter (where o.status = 'completed')::int as completed_count,
        count(o.id) filter (where o.status = 'cancelled')::int as cancelled_count
      from as_clients cl
      left join as_orders o on o.client_id = cl.id
      where cl.user_id = ${context.userId}
      group by cl.id
      order by cl.created_at desc
    `;
    return rows;
  });

export const candidatesForOrder = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((orderId: number) => orderId)
  .handler(async ({ context, data: orderId }) => {
    const sql = await ctxSql(context.userId);
    await tickPresence(sql, context.userId);
    const o = await sql`select * from as_orders where user_id = ${context.userId} and id = ${orderId}`;
    const order = o[0];
    if (!order) return { error: "ORDER_NOT_FOUND" as const, masters: [] as (MasterRow & { km: number | null; recommended: boolean })[] };
    const masters = await listMastersInner(sql, context.userId);
    const olat = order.lat == null ? null : n(order.lat);
    const olng = order.lng == null ? null : n(order.lng);
    const spec = String(order.category_slug);
    const scored = masters.map((m) => {
      const km =
        olat != null && olng != null && m.lat != null && m.lng != null
          ? haversineKm(olat, olng, m.lat, m.lng)
          : null;
      const recommended =
        m.specialization === spec &&
        m.online_status !== "offline" &&
        m.online_status !== "blocked" &&
        m.active_orders < 3;
      return { ...m, km, recommended };
    });
    scored.sort((a, b) => {
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
      if (a.km != null && b.km != null) return a.km - b.km;
      return b.rating - a.rating;
    });
    return { error: null, masters: scored, spec };
  });

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

export const assignMaster = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orderId: number; masterId: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await ctxSql(context.userId);
    const uid = context.userId;
    const o = await sql`select * from as_orders where user_id = ${uid} and id = ${data.orderId}`;
    const order = o[0] as Record<string, unknown> | undefined;
    if (!order) return { success: false as const, error: "ORDER_NOT_FOUND" };
    const status = String(order.status) as OrderStatus;
    if (!ASSIGNABLE.includes(status) && status !== "assigned") {
      return { success: false as const, error: "ORDER_NOT_ASSIGNABLE" };
    }
    const m = await sql`select * from as_masters where user_id = ${uid} and id = ${data.masterId}`;
    const master = m[0] as Record<string, unknown> | undefined;
    if (!master) return { success: false as const, error: "MASTER_NOT_FOUND" };
    if (String(master.online_status) === "blocked") {
      return { success: false as const, error: "MASTER_BLOCKED" };
    }
    const old = order.master_id == null ? null : String(order.master_id);
    await sql`
      update as_orders
      set master_id = ${data.masterId}, status = 'assigned', assigned_at = now(), updated_at = now(),
          cancelled_at = null
      where user_id = ${uid} and id = ${data.orderId}
    `;
    await addEvent(sql, uid, data.orderId, "assigned", "admin", { masterId: data.masterId });
    await addAudit(sql, uid, "assign_master", "order", String(data.orderId), old, String(data.masterId));
    const name = `${master.first_name} ${master.last_name}`;
    await addNote(
      sql,
      uid,
      "master",
      `Вам назначен заказ №${order.public_no}`,
      `${order.description}`,
      data.orderId,
      data.masterId,
    );
    await addNote(
      sql,
      uid,
      "client",
      `Мастер назначен`,
      `${name} — ожидает подтверждения`,
      data.orderId,
      data.masterId,
    );
    return { success: true as const, error: null, masterName: name };
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((orderId: number) => orderId)
  .handler(async ({ context, data: orderId }) => {
    const sql = await ctxSql(context.userId);
    await sql`
      update as_orders set status = 'cancelled', cancelled_at = now(), updated_at = now()
      where user_id = ${context.userId} and id = ${orderId} and status <> 'completed'
    `;
    await addEvent(sql, context.userId, orderId, "cancelled", "admin", {});
    await addAudit(sql, context.userId, "cancel_order", "order", String(orderId), null, "cancelled");
    return { success: true };
  });

export const masterDecision = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orderId: number; accept: boolean; masterId: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await ctxSql(context.userId);
    const uid = context.userId;
    const o = await sql`select * from as_orders where user_id = ${uid} and id = ${data.orderId}`;
    const order = o[0] as Record<string, unknown> | undefined;
    if (!order) return { success: false as const, error: "ORDER_NOT_FOUND" };
    if (n(order.master_id) !== data.masterId) return { success: false as const, error: "NOT_ASSIGNED" };
    if (String(order.status) !== "assigned") return { success: false as const, error: "WRONG_STATUS" };

    if (data.accept) {
      await sql`
        update as_orders set status = 'master_accepted', accepted_at = now(), updated_at = now()
        where user_id = ${uid} and id = ${data.orderId}
      `;
      await sql`
        update as_masters set accepted_orders = accepted_orders + 1, online_status = 'busy', last_seen = now()
        where user_id = ${uid} and id = ${data.masterId}
      `;
      await addEvent(sql, uid, data.orderId, "master_accepted", "master", {});
      await addNote(sql, uid, "client", "Мастер принял заявку", "Мастер уже готовится выехать", data.orderId, data.masterId);
      await addNote(sql, uid, "admin", `Мастер принял №${order.public_no}`, "", data.orderId, data.masterId);
    } else {
      await sql`
        update as_orders set status = 'master_rejected', updated_at = now()
        where user_id = ${uid} and id = ${data.orderId}
      `;
      await sql`
        update as_masters set rejected_orders = rejected_orders + 1, last_seen = now()
        where user_id = ${uid} and id = ${data.masterId}
      `;
      await addEvent(sql, uid, data.orderId, "master_rejected", "master", { masterId: data.masterId });
      await addAudit(sql, uid, "master_reject", "order", String(data.orderId), String(data.masterId), "master_rejected");
      await addNote(
        sql,
        uid,
        "admin",
        `Мастер отказался от заявки №${order.public_no}`,
        "Назначьте другого мастера — система никого не подберёт сама",
        data.orderId,
        null,
      );
      await addNote(sql, uid, "client", "Мастер отказался", "Администратор назначит другого", data.orderId, null);
    }
    return { success: true as const, error: null };
  });

export const masterAdvance = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orderId: number; masterId: number; to: OrderStatus }) => d)
  .handler(async ({ context, data }) => {
    const sql = await ctxSql(context.userId);
    const allowed: Record<string, OrderStatus> = {
      master_accepted: "enroute",
      enroute: "arrived",
      arrived: "in_progress",
      in_progress: "completed",
    };
    const o = await sql`select * from as_orders where user_id = ${context.userId} and id = ${data.orderId}`;
    const order = o[0] as Record<string, unknown> | undefined;
    if (!order) return { success: false as const, error: "ORDER_NOT_FOUND" };
    if (n(order.master_id) !== data.masterId) return { success: false as const, error: "NOT_ASSIGNED" };
    const next = allowed[String(order.status)];
    if (next !== data.to) return { success: false as const, error: "WRONG_STATUS" };

    if (data.to === "enroute") {
      await sql`update as_orders set status = 'enroute', updated_at = now() where user_id = ${context.userId} and id = ${data.orderId}`;
    } else if (data.to === "arrived") {
      await sql`update as_orders set status = 'arrived', arrived_at = now(), updated_at = now() where user_id = ${context.userId} and id = ${data.orderId}`;
    } else if (data.to === "in_progress") {
      await sql`update as_orders set status = 'in_progress', started_at = now(), updated_at = now() where user_id = ${context.userId} and id = ${data.orderId}`;
    } else if (data.to === "completed") {
      await sql`update as_orders set status = 'completed', completed_at = now(), updated_at = now() where user_id = ${context.userId} and id = ${data.orderId}`;
      await sql`
        update as_masters
        set completed_orders = completed_orders + 1,
            earnings = earnings + ${n(order.master_payout)},
            online_status = 'online',
            last_seen = now()
        where user_id = ${context.userId} and id = ${data.masterId}
      `;
    }
    await addEvent(sql, context.userId, data.orderId, data.to, "master", {});
    await addNote(sql, context.userId, "client", "Статус заявки обновлён", data.to, data.orderId, data.masterId);
    return { success: true as const, error: null };
  });

export const heartbeatMaster = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((masterId: number) => masterId)
  .handler(async ({ context, data: masterId }) => {
    const sql = await ctxSql(context.userId);
    const busy = await sql<{ n: number }>`
      select count(*)::int as n from as_orders
      where user_id = ${context.userId} and master_id = ${masterId}
        and status in ('assigned','master_accepted','enroute','arrived','in_progress')
    `;
    const status = n(busy[0]?.n) > 0 ? "busy" : "online";
    await sql`
      update as_masters set last_seen = now(), online_status = ${status}
      where user_id = ${context.userId} and id = ${masterId} and online_status <> 'blocked'
    `;
    return { ok: true, status };
  });

export type CreateOrderInput = {
  name: string;
  phone: string;
  category: string;
  description: string;
  district: string;
  lat: number;
  lng: number;
  comment?: string;
  photos?: string[];
};

export const createOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: CreateOrderInput) => d)
  .handler(async ({ context, data }) => {
    const sql = await ctxSql(context.userId);
    const uid = context.userId;
    const svc = serviceById(data.category) ?? SERVICES[0]!;
    let client = await sql<{ id: number }>`
      select id from as_clients where user_id = ${uid} and phone = ${data.phone} limit 1
    `;
    if (!client[0]) {
      client = await sql<{ id: number }>`
        insert into as_clients (user_id, telegram_id, name, phone, city, district, lat, lng)
        values (${uid}, ${"bot"}, ${data.name}, ${data.phone}, ${"Ташкент"}, ${data.district}, ${data.lat}, ${data.lng})
        returning id
      `;
    }
    const clientId = client[0]!.id;
    const no = await sql<{ n: number }>`
      select coalesce(max(public_no), 12000) + 1 as n from as_orders where user_id = ${uid}
    `;
    const publicNo = n(no[0]?.n);
    const photos = JSON.stringify((data.photos ?? []).slice(0, 3));
    const price = svc.from;
    const rows = await sql<{ id: number }>`
      insert into as_orders (
        user_id, public_no, client_id, category_slug, description, phone, city, district, address,
        lat, lng, status, photos, comment, price, master_payout
      ) values (
        ${uid}, ${publicNo}, ${clientId}, ${svc.id}, ${data.description}, ${data.phone}, ${"Ташкент"},
        ${data.district}, ${data.district}, ${data.lat}, ${data.lng}, ${"waiting_admin"}, ${photos},
        ${data.comment ?? ""}, ${price}, ${Math.round(price * 0.7)}
      ) returning id
    `;
    const id = rows[0]!.id;
    await addEvent(sql, uid, id, "created", "client", { source: "telegram" });
    await addEvent(sql, uid, id, "geo", "client", { district: data.district, lat: data.lat, lng: data.lng });
    if (data.photos?.length) await addEvent(sql, uid, id, "photos", "client", { count: data.photos.length });
    await addNote(sql, uid, "admin", `Новая заявка №${publicNo}`, data.description, id, null);
    await addAudit(sql, uid, "create_order", "order", String(id), null, "waiting_admin");
    return { id, publicNo, status: "waiting_admin" as const, price };
  });

export const rateOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { orderId: number; rating: number; comment?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await ctxSql(context.userId);
    const o = await sql`select * from as_orders where user_id = ${context.userId} and id = ${data.orderId}`;
    const order = o[0] as Record<string, unknown> | undefined;
    if (!order || String(order.status) !== "completed") return { success: false };
    await sql`
      insert into as_reviews (user_id, order_id, client_id, master_id, rating, comment)
      values (${context.userId}, ${data.orderId}, ${n(order.client_id)}, ${order.master_id == null ? null : n(order.master_id)}, ${data.rating}, ${data.comment ?? ""})
    `;
    if (order.master_id != null) {
      await sql`
        update as_masters set rating = (
          select round(avg(rating)::numeric, 2) from as_reviews
          where user_id = ${context.userId} and master_id = ${n(order.master_id)}
        )
        where user_id = ${context.userId} and id = ${n(order.master_id)}
      `;
    }
    await addEvent(sql, context.userId, data.orderId, "reviewed", "client", { rating: data.rating });
    return { success: true };
  });

export const getMapData = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ctxSql(context.userId);
    await tickPresence(sql, context.userId);
    const masters = await listMastersInner(sql, context.userId);
    const orders = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT}
       from as_orders o join as_clients c on c.id = o.client_id
       left join as_masters m on m.id = o.master_id
       where o.user_id = $1 and o.status not in ('completed','cancelled')
       order by o.created_at desc`,
      [context.userId],
    );
    const clients = await sql<MapClient>`
      select id, name, lat, lng, district from as_clients where user_id = ${context.userId}
    `;
    return { masters, orders: orders.map(mapOrder), clients };
  });

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ctxSql(context.userId);
    const uid = context.userId;
    const byDay = await sql<{ d: string; n: number; revenue: number }>`
      select to_char(created_at, 'YYYY-MM-DD') as d, count(*)::int as n,
             coalesce(sum(price) filter (where status = 'completed'), 0)::int as revenue
      from as_orders where user_id = ${uid} and created_at >= current_date - interval '14 days'
      group by 1 order by 1
    `;
    const byCat = await sql<{ slug: string; n: number }>`
      select category_slug as slug, count(*)::int as n from as_orders
      where user_id = ${uid} group by 1 order by n desc
    `;
    const byCity = await sql<{ district: string; n: number }>`
      select district, count(*)::int as n from as_orders where user_id = ${uid} group by 1 order by n desc
    `;
    const ratings = await sql<{ rating: number; n: number }>`
      select rating, count(*)::int as n from as_reviews where user_id = ${uid} group by 1 order by 1
    `;
    const funnel = await sql<{
      created: number; assigned: number; accepted: number; completed: number; cancelled: number;
    }>`
      select
        count(*)::int as created,
        count(*) filter (where assigned_at is not null)::int as assigned,
        count(*) filter (where accepted_at is not null)::int as accepted,
        count(*) filter (where status = 'completed')::int as completed,
        count(*) filter (where status = 'cancelled')::int as cancelled
      from as_orders where user_id = ${uid}
    `;
    const byHour = await sql<{ h: number; n: number }>`
      select extract(hour from created_at)::int as h, count(*)::int as n
      from as_orders where user_id = ${uid}
      group by 1 order by 1
    `;
    return { byDay, byCat, byCity, ratings, funnel: funnel[0]!, byHour };
  });

export const listReviews = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ctxSql(context.userId);
    return sql<ReviewListRow>`
      select r.id, r.rating, r.comment, r.created_at, o.public_no,
             c.name as client_name, m.first_name || ' ' || m.last_name as master_name
      from as_reviews r
      join as_orders o on o.id = r.order_id
      left join as_clients c on c.id = r.client_id
      left join as_masters m on m.id = r.master_id
      where r.user_id = ${context.userId}
      order by r.created_at desc
    `;
  });

export const listAudit = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ctxSql(context.userId);
    return sql<AuditRow>`
      select id, action, object_type, object_id, old_value, new_value, created_at
      from as_audit where user_id = ${context.userId} order by created_at desc limit 100
    `;
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ctxSql(context.userId);
    return sql<NoteRow>`
      select id, kind, title, body, order_id, master_id, read, created_at
      from as_notifications where user_id = ${context.userId} order by created_at desc limit 40
    `;
  });

export const pollOrder = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await ctxSql(context.userId);
    const rows = await sql.query<Record<string, unknown>>(
      `select ${ORDER_SELECT}
       from as_orders o join as_clients c on c.id = o.client_id
       left join as_masters m on m.id = o.master_id
       where o.user_id = $1 and o.id = $2`,
      [context.userId, id],
    );
    return rows[0] ? mapOrder(rows[0]) : null;
  });

export { SERVICES };
