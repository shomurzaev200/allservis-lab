import { SERVICES, DISTRICTS } from "@/lib/catalog";
import type { OnlineStatus, OrderStatus } from "@/lib/domain";

export type Sql = Awaited<ReturnType<typeof import("@/lib/db").getSql>>;

const shiftStarted = new Set<string>();

export async function ensureWorkspace(sql: Sql, userId: string) {
  const existing = await sql<{ user_id: string }>`
    select user_id from as_workspace where user_id = ${userId}
  `;
  if (!existing[0]) {
    await seed(sql, userId);
    shiftStarted.add(userId);
    return;
  }
  if (!shiftStarted.has(userId)) {
    shiftStarted.add(userId);
    await sql`
      update as_masters
      set last_seen = now(),
          online_status = case when online_status = 'blocked' then 'blocked' else 'online' end
      where user_id = ${userId}
    `;
  }
}

async function seed(sql: Sql, userId: string) {
  await sql`insert into as_workspace (user_id, seeded) values (${userId}, true)`;

  for (const s of SERVICES) {
    await sql`
      insert into as_categories (user_id, slug, title, hint, price_from, diag_fee)
      values (${userId}, ${s.id}, ${s.title}, ${s.hint}, ${s.from}, ${s.diag})
    `;
  }

  const fleet: {
    first: string;
    last: string;
    spec: string;
    district: string;
    phone: string;
    tg: string;
    rating: number;
    completed: number;
    cancelled: number;
    rejected: number;
    accepted: number;
    status: OnlineStatus;
    avg: number;
    earnings: number;
    seenMin: number;
  }[] = [
    { first: "Алишер", last: "Каримов", spec: "plumb", district: "chilanzar", phone: "+998 90 117 24 11", tg: "501001", rating: 4.92, completed: 327, cancelled: 8, rejected: 6, accepted: 341, status: "online", avg: 38, earnings: 28_400_000, seenMin: 0 },
    { first: "Дилшод", last: "Рахимов", spec: "elec", district: "yunusabad", phone: "+998 93 401 55 20", tg: "501002", rating: 4.88, completed: 186, cancelled: 5, rejected: 9, accepted: 200, status: "busy", avg: 41, earnings: 14_900_000, seenMin: 1 },
    { first: "Жавлон", last: "Исмаилов", spec: "ac", district: "mirabad", phone: "+998 97 700 12 45", tg: "501003", rating: 4.74, completed: 154, cancelled: 11, rejected: 14, accepted: 179, status: "online", avg: 52, earnings: 22_100_000, seenMin: 2 },
    { first: "Нигора", last: "Юсупова", spec: "appliance", district: "yakkasaray", phone: "+998 91 333 08 17", tg: "501004", rating: 4.98, completed: 98, cancelled: 1, rejected: 2, accepted: 101, status: "online", avg: 44, earnings: 11_200_000, seenMin: 0 },
    { first: "Бекзод", last: "Турсунов", spec: "furniture", district: "mirzo", phone: "+998 94 555 61 02", tg: "501005", rating: 4.91, completed: 210, cancelled: 4, rejected: 7, accepted: 221, status: "offline", avg: 70, earnings: 18_600_000, seenMin: 80 },
    { first: "Шерзод", last: "Ахмедов", spec: "lock", district: "shayhantahur", phone: "+998 99 812 44 70", tg: "501006", rating: 4.86, completed: 320, cancelled: 6, rejected: 4, accepted: 330, status: "online", avg: 22, earnings: 24_800_000, seenMin: 3 },
    { first: "Умар", last: "Саидов", spec: "paint", district: "almazar", phone: "+998 88 210 19 33", tg: "501007", rating: 4.61, completed: 72, cancelled: 9, rejected: 12, accepted: 93, status: "offline", avg: 95, earnings: 9_400_000, seenMin: 240 },
    { first: "Рустам", last: "Назаров", spec: "other", district: "uchtepa", phone: "+998 90 980 03 14", tg: "501008", rating: 4.79, completed: 130, cancelled: 7, rejected: 8, accepted: 145, status: "busy", avg: 48, earnings: 12_700_000, seenMin: 4 },
  ];

  for (const m of fleet) {
    const d = DISTRICTS.find((x) => x.id === m.district)!;
    const lastSeen = new Date(Date.now() - m.seenMin * 60_000).toISOString();
    const registered = new Date(Date.now() - (200 + m.completed) * 86400_000).toISOString();
    await sql`
      insert into as_masters (
        user_id, first_name, last_name, telegram_id, phone, city, district,
        specialization, rating, completed_orders, cancelled_orders, rejected_orders,
        accepted_orders, online_status, last_seen, lat, lng, registered_at, avg_minutes, earnings
      ) values (
        ${userId}, ${m.first}, ${m.last}, ${m.tg}, ${m.phone}, ${"Ташкент"}, ${d.title},
        ${m.spec}, ${m.rating}, ${m.completed}, ${m.cancelled}, ${m.rejected},
        ${m.accepted}, ${m.status}, ${lastSeen}, ${d.lat + 0.004}, ${d.lng - 0.003},
        ${registered}, ${m.avg}, ${m.earnings}
      )
    `;
  }

  const clientSeed = [
    { name: "Абдулазиз Шомурзаев", phone: "+998 90 123 45 67", district: "chilanzar", tg: "70001" },
    { name: "Мадина Алиева", phone: "+998 93 210 11 02", district: "yunusabad", tg: "70002" },
    { name: "Отабек Холматов", phone: "+998 97 555 08 19", district: "mirabad", tg: "70003" },
    { name: "Зухра Каримова", phone: "+998 91 404 33 21", district: "yakkasaray", tg: "70004" },
    { name: "Жасур Рахимов", phone: "+998 94 777 12 90", district: "mirzo", tg: "70005" },
    { name: "Нилуфар Саидова", phone: "+998 99 318 44 07", district: "shayhantahur", tg: "70006" },
    { name: "Акмал Юсупов", phone: "+998 88 101 29 55", district: "almazar", tg: "70007" },
    { name: "Дилноза Турсунова", phone: "+998 90 612 73 18", district: "uchtepa", tg: "70008" },
    { name: "Шохрух Исмаилов", phone: "+998 93 880 02 41", district: "sergeli", tg: "70009" },
    { name: "Камола Назарова", phone: "+998 97 246 19 30", district: "yashnabad", tg: "70010" },
  ];

  for (const c of clientSeed) {
    const d = DISTRICTS.find((x) => x.id === c.district)!;
    await sql`
      insert into as_clients (user_id, telegram_id, name, phone, city, district, lat, lng, rating)
      values (${userId}, ${c.tg}, ${c.name}, ${c.phone}, ${"Ташкент"}, ${d.title}, ${d.lat}, ${d.lng}, ${4.6 + Math.random() * 0.4})
    `;
  }

  const masters = await sql<{ id: number; specialization: string; district: string }>`
    select id, specialization, district from as_masters where user_id = ${userId} order by id
  `;
  const clients = await sql<{ id: number; name: string; phone: string; district: string; lat: number; lng: number }>`
    select id, name, phone, district, lat, lng from as_clients where user_id = ${userId} order by id
  `;

  const bySpec = (slug: string) => masters.find((m) => m.specialization === slug)?.id ?? masters[0]!.id;

  type SeedOrder = {
    no: number;
    client: number;
    spec: string;
    desc: string;
    status: OrderStatus;
    hoursAgo: number;
    master?: boolean;
    price: number;
    rating?: number;
  };

  const orders: SeedOrder[] = [
    { no: 12401, client: 0, spec: "plumb", desc: "Течёт смеситель на кухне, уже несколько дней", status: "waiting_admin", hoursAgo: 0.4, price: 80_000 },
    { no: 12402, client: 1, spec: "elec", desc: "Нет света в двух комнатах после скачка напряжения", status: "waiting_admin", hoursAgo: 0.7, price: 70_000 },
    { no: 12403, client: 2, spec: "ac", desc: "Кондиционер дует тёплым, нужна заправка", status: "waiting_admin", hoursAgo: 1.1, price: 150_000 },
    { no: 12397, client: 9, spec: "paint", desc: "Покраска балкона — мастер отказался, нужен другой", status: "master_rejected", hoursAgo: 0.55, master: true, price: 220_000 },
    { no: 12390, client: 3, spec: "lock", desc: "Заклинило замок входной двери, не открывается", status: "assigned", hoursAgo: 0.9, master: true, price: 90_000 },
    { no: 12388, client: 4, spec: "elec", desc: "Искрит розетка в коридоре", status: "enroute", hoursAgo: 1.5, master: true, price: 70_000 },
    { no: 12380, client: 5, spec: "plumb", desc: "Засор стояка на 4 этаже", status: "in_progress", hoursAgo: 2.2, master: true, price: 120_000 },
    { no: 12340, client: 6, spec: "appliance", desc: "Стиральная машина не сливает воду", status: "completed", hoursAgo: 8, master: true, price: 100_000, rating: 5 },
    { no: 12331, client: 7, spec: "furniture", desc: "Сборка шкафа IKEA PAX", status: "completed", hoursAgo: 22, master: true, price: 180_000, rating: 5 },
    { no: 12322, client: 8, spec: "ac", desc: "Чистка внутреннего блока сплита", status: "completed", hoursAgo: 30, master: true, price: 150_000, rating: 4 },
    { no: 12310, client: 9, spec: "paint", desc: "Покраска комнаты 16 м²", status: "completed", hoursAgo: 48, master: true, price: 320_000, rating: 5 },
    { no: 12290, client: 0, spec: "plumb", desc: "Замена унитаза", status: "completed", hoursAgo: 54, master: true, price: 200_000, rating: 5 },
    { no: 12270, client: 1, spec: "elec", desc: "Установка люстры и двух бра", status: "completed", hoursAgo: 70, master: true, price: 110_000, rating: 4 },
    { no: 12240, client: 2, spec: "lock", desc: "Замена личинки", status: "completed", hoursAgo: 96, master: true, price: 90_000, rating: 5 },
    { no: 12210, client: 3, spec: "other", desc: "Повесить карниз и зеркало", status: "completed", hoursAgo: 120, master: true, price: 80_000, rating: 5 },
    { no: 12180, client: 4, spec: "appliance", desc: "Не морозит холодильник", status: "cancelled", hoursAgo: 10, price: 100_000 },
    { no: 12150, client: 5, spec: "paint", desc: "Поклейка обоев — клиент передумал", status: "cancelled", hoursAgo: 36, price: 200_000 },
  ];

  for (const o of orders) {
    const client = clients[o.client] ?? clients[0]!;
    const created = new Date(Date.now() - o.hoursAgo * 3600_000).toISOString();
    const masterId = o.master ? bySpec(o.spec) : null;
    const payout = Math.round(o.price * 0.7);
    const assigned = o.master ? new Date(Date.now() - (o.hoursAgo - 0.15) * 3600_000).toISOString() : null;
    const accepted =
      o.status === "enroute" || o.status === "in_progress" || o.status === "completed"
        ? new Date(Date.now() - (o.hoursAgo - 0.25) * 3600_000).toISOString()
        : null;
    const completedAt = o.status === "completed" ? new Date(Date.now() - (o.hoursAgo - 1.2) * 3600_000).toISOString() : null;
    const cancelledAt = o.status === "cancelled" ? created : null;
    const startedAt = o.status === "in_progress" || o.status === "completed" ? accepted : null;

    const rows = await sql<{ id: number }>`
      insert into as_orders (
        user_id, public_no, client_id, master_id, category_slug, description, phone,
        city, district, address, lat, lng, status, price, master_payout, created_at,
        assigned_at, accepted_at, started_at, completed_at, cancelled_at, updated_at
      ) values (
        ${userId}, ${o.no}, ${client.id}, ${masterId}, ${o.spec}, ${o.desc}, ${client.phone},
        ${"Ташкент"}, ${client.district}, ${client.district + ", ул. Навои"}, ${client.lat}, ${client.lng},
        ${o.status}, ${o.price}, ${payout}, ${created},
        ${assigned}, ${accepted}, ${startedAt}, ${completedAt}, ${cancelledAt}, ${created}
      ) returning id
    `;
    const orderId = rows[0]!.id;

    await addEvent(sql, userId, orderId, "created", "client", { source: "telegram" });
    await addEvent(sql, userId, orderId, "geo", "client", { district: client.district });
    if (masterId) {
      await addEvent(sql, userId, orderId, "assigned", "admin", { masterId });
      await addAudit(sql, userId, "assign_master", "order", String(orderId), null, String(masterId));
    }
    if (accepted) await addEvent(sql, userId, orderId, "master_accepted", "master", {});
    if (o.status === "enroute") await addEvent(sql, userId, orderId, "enroute", "master", {});
    if (o.status === "in_progress") {
      await addEvent(sql, userId, orderId, "arrived", "master", {});
      await addEvent(sql, userId, orderId, "started", "master", {});
    }
    if (o.status === "master_rejected") {
      await addEvent(sql, userId, orderId, "master_rejected", "master", { masterId });
      await addNote(
        sql,
        userId,
        "admin",
        `Мастер отказался от заявки №${o.no}`,
        "Назначьте другого мастера — автоподбора нет",
        orderId,
        null,
      );
    }
    if (o.status === "completed") {
      await addEvent(sql, userId, orderId, "completed", "master", {});
      if (o.rating) {
        await sql`
          insert into as_reviews (user_id, order_id, client_id, master_id, rating, comment, created_at)
          values (${userId}, ${orderId}, ${client.id}, ${masterId}, ${o.rating}, ${o.rating === 5 ? "Всё быстро и аккуратно" : "Сделали, но чуть задержались"}, ${completedAt})
        `;
        await addEvent(sql, userId, orderId, "reviewed", "client", { rating: o.rating });
      }
    }
    if (o.status === "cancelled") await addEvent(sql, userId, orderId, "cancelled", "client", {});
  }

  const waiting = await sql<{ id: number; public_no: number }>`
    select id, public_no from as_orders where user_id = ${userId} and status = 'waiting_admin'
  `;
  for (const w of waiting) {
    await addNote(
      sql,
      userId,
      "admin",
      `Новая заявка №${w.public_no}`,
      "Ожидает назначения мастера",
      w.id,
      null,
    );
  }
}

export async function addEvent(
  sql: Sql,
  userId: string,
  orderId: number,
  eventType: string,
  actor: string,
  metadata: Record<string, unknown>,
) {
  const meta = JSON.stringify(metadata);
  await sql`
    insert into as_order_events (user_id, order_id, event_type, actor, metadata)
    values (${userId}, ${orderId}, ${eventType}, ${actor}, ${meta})
  `;
}

export async function addAudit(
  sql: Sql,
  userId: string,
  action: string,
  objectType: string,
  objectId: string,
  oldValue: string | null,
  newValue: string | null,
) {
  await sql`
    insert into as_audit (user_id, action, object_type, object_id, old_value, new_value)
    values (${userId}, ${action}, ${objectType}, ${objectId}, ${oldValue}, ${newValue})
  `;
}

export async function addNote(
  sql: Sql,
  userId: string,
  kind: string,
  title: string,
  body: string,
  orderId: number | null,
  masterId: number | null,
) {
  await sql`
    insert into as_notifications (user_id, kind, title, body, order_id, master_id)
    values (${userId}, ${kind}, ${title}, ${body}, ${orderId}, ${masterId})
  `;
}

export async function tickPresence(sql: Sql, userId: string) {
  await sql`
    update as_masters
    set online_status = 'offline'
    where user_id = ${userId}
      and online_status in ('online', 'busy')
      and last_seen < now() - interval '2 minutes'
      and not exists (
        select 1 from as_orders o
        where o.user_id = ${userId}
          and o.master_id = as_masters.id
          and o.status in ('assigned','master_accepted','enroute','arrived','in_progress')
      )
  `;
  await sql`
    update as_masters m
    set online_status = 'busy'
    where m.user_id = ${userId}
      and m.online_status <> 'blocked'
      and exists (
        select 1 from as_orders o
        where o.user_id = ${userId}
          and o.master_id = m.id
          and o.status in ('assigned','master_accepted','enroute','arrived','in_progress')
      )
  `;
}
