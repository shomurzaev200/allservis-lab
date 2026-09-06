import { c as haversineKm, t as ASSIGNABLE } from "./domain-zUVhUtxQ.mjs";
import { a as serviceById, n as SERVICES, t as DISTRICTS } from "./catalog-Cq__2iHb.mjs";
import { i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { r as getSql } from "./db-C9iVfLqo.mjs";
import { t as authMiddleware } from "./middleware-rmRr0XO7.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-DI_AvJdY.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var shiftStarted = /* @__PURE__ */ new Set();
async function ensureWorkspace(sql, userId) {
	if (!(await sql`
    select user_id from as_workspace where user_id = ${userId}
  `)[0]) {
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
async function seed(sql, userId) {
	await sql`insert into as_workspace (user_id, seeded) values (${userId}, true)`;
	for (const s of SERVICES) await sql`
      insert into as_categories (user_id, slug, title, hint, price_from, diag_fee)
      values (${userId}, ${s.id}, ${s.title}, ${s.hint}, ${s.from}, ${s.diag})
    `;
	for (const m of [
		{
			first: "Алишер",
			last: "Каримов",
			spec: "plumb",
			district: "chilanzar",
			phone: "+998 90 117 24 11",
			tg: "501001",
			rating: 4.92,
			completed: 327,
			cancelled: 8,
			rejected: 6,
			accepted: 341,
			status: "online",
			avg: 38,
			earnings: 284e5,
			seenMin: 0
		},
		{
			first: "Дилшод",
			last: "Рахимов",
			spec: "elec",
			district: "yunusabad",
			phone: "+998 93 401 55 20",
			tg: "501002",
			rating: 4.88,
			completed: 186,
			cancelled: 5,
			rejected: 9,
			accepted: 200,
			status: "busy",
			avg: 41,
			earnings: 149e5,
			seenMin: 1
		},
		{
			first: "Жавлон",
			last: "Исмаилов",
			spec: "ac",
			district: "mirabad",
			phone: "+998 97 700 12 45",
			tg: "501003",
			rating: 4.74,
			completed: 154,
			cancelled: 11,
			rejected: 14,
			accepted: 179,
			status: "online",
			avg: 52,
			earnings: 221e5,
			seenMin: 2
		},
		{
			first: "Нигора",
			last: "Юсупова",
			spec: "appliance",
			district: "yakkasaray",
			phone: "+998 91 333 08 17",
			tg: "501004",
			rating: 4.98,
			completed: 98,
			cancelled: 1,
			rejected: 2,
			accepted: 101,
			status: "online",
			avg: 44,
			earnings: 112e5,
			seenMin: 0
		},
		{
			first: "Бекзод",
			last: "Турсунов",
			spec: "furniture",
			district: "mirzo",
			phone: "+998 94 555 61 02",
			tg: "501005",
			rating: 4.91,
			completed: 210,
			cancelled: 4,
			rejected: 7,
			accepted: 221,
			status: "offline",
			avg: 70,
			earnings: 186e5,
			seenMin: 80
		},
		{
			first: "Шерзод",
			last: "Ахмедов",
			spec: "lock",
			district: "shayhantahur",
			phone: "+998 99 812 44 70",
			tg: "501006",
			rating: 4.86,
			completed: 320,
			cancelled: 6,
			rejected: 4,
			accepted: 330,
			status: "online",
			avg: 22,
			earnings: 248e5,
			seenMin: 3
		},
		{
			first: "Умар",
			last: "Саидов",
			spec: "paint",
			district: "almazar",
			phone: "+998 88 210 19 33",
			tg: "501007",
			rating: 4.61,
			completed: 72,
			cancelled: 9,
			rejected: 12,
			accepted: 93,
			status: "offline",
			avg: 95,
			earnings: 94e5,
			seenMin: 240
		},
		{
			first: "Рустам",
			last: "Назаров",
			spec: "other",
			district: "uchtepa",
			phone: "+998 90 980 03 14",
			tg: "501008",
			rating: 4.79,
			completed: 130,
			cancelled: 7,
			rejected: 8,
			accepted: 145,
			status: "busy",
			avg: 48,
			earnings: 127e5,
			seenMin: 4
		}
	]) {
		const d = DISTRICTS.find((x) => x.id === m.district);
		const lastSeen = (/* @__PURE__ */ new Date(Date.now() - m.seenMin * 6e4)).toISOString();
		const registered = (/* @__PURE__ */ new Date(Date.now() - (200 + m.completed) * 864e5)).toISOString();
		await sql`
      insert into as_masters (
        user_id, first_name, last_name, telegram_id, phone, city, district,
        specialization, rating, completed_orders, cancelled_orders, rejected_orders,
        accepted_orders, online_status, last_seen, lat, lng, registered_at, avg_minutes, earnings
      ) values (
        ${userId}, ${m.first}, ${m.last}, ${m.tg}, ${m.phone}, ${"Ташкент"}, ${d.title},
        ${m.spec}, ${m.rating}, ${m.completed}, ${m.cancelled}, ${m.rejected},
        ${m.accepted}, ${m.status}, ${lastSeen}, ${d.lat + .004}, ${d.lng - .003},
        ${registered}, ${m.avg}, ${m.earnings}
      )
    `;
	}
	for (const c of [
		{
			name: "Абдулазиз Шомурзаев",
			phone: "+998 90 123 45 67",
			district: "chilanzar",
			tg: "70001"
		},
		{
			name: "Мадина Алиева",
			phone: "+998 93 210 11 02",
			district: "yunusabad",
			tg: "70002"
		},
		{
			name: "Отабек Холматов",
			phone: "+998 97 555 08 19",
			district: "mirabad",
			tg: "70003"
		},
		{
			name: "Зухра Каримова",
			phone: "+998 91 404 33 21",
			district: "yakkasaray",
			tg: "70004"
		},
		{
			name: "Жасур Рахимов",
			phone: "+998 94 777 12 90",
			district: "mirzo",
			tg: "70005"
		},
		{
			name: "Нилуфар Саидова",
			phone: "+998 99 318 44 07",
			district: "shayhantahur",
			tg: "70006"
		},
		{
			name: "Акмал Юсупов",
			phone: "+998 88 101 29 55",
			district: "almazar",
			tg: "70007"
		},
		{
			name: "Дилноза Турсунова",
			phone: "+998 90 612 73 18",
			district: "uchtepa",
			tg: "70008"
		},
		{
			name: "Шохрух Исмаилов",
			phone: "+998 93 880 02 41",
			district: "sergeli",
			tg: "70009"
		},
		{
			name: "Камола Назарова",
			phone: "+998 97 246 19 30",
			district: "yashnabad",
			tg: "70010"
		}
	]) {
		const d = DISTRICTS.find((x) => x.id === c.district);
		await sql`
      insert into as_clients (user_id, telegram_id, name, phone, city, district, lat, lng, rating)
      values (${userId}, ${c.tg}, ${c.name}, ${c.phone}, ${"Ташкент"}, ${d.title}, ${d.lat}, ${d.lng}, ${4.6 + Math.random() * .4})
    `;
	}
	const masters = await sql`
    select id, specialization, district from as_masters where user_id = ${userId} order by id
  `;
	const clients = await sql`
    select id, name, phone, district, lat, lng from as_clients where user_id = ${userId} order by id
  `;
	const bySpec = (slug) => masters.find((m) => m.specialization === slug)?.id ?? masters[0].id;
	for (const o of [
		{
			no: 12401,
			client: 0,
			spec: "plumb",
			desc: "Течёт смеситель на кухне, уже несколько дней",
			status: "waiting_admin",
			hoursAgo: .4,
			price: 8e4
		},
		{
			no: 12402,
			client: 1,
			spec: "elec",
			desc: "Нет света в двух комнатах после скачка напряжения",
			status: "waiting_admin",
			hoursAgo: .7,
			price: 7e4
		},
		{
			no: 12403,
			client: 2,
			spec: "ac",
			desc: "Кондиционер дует тёплым, нужна заправка",
			status: "waiting_admin",
			hoursAgo: 1.1,
			price: 15e4
		},
		{
			no: 12397,
			client: 9,
			spec: "paint",
			desc: "Покраска балкона — мастер отказался, нужен другой",
			status: "master_rejected",
			hoursAgo: .55,
			master: true,
			price: 22e4
		},
		{
			no: 12390,
			client: 3,
			spec: "lock",
			desc: "Заклинило замок входной двери, не открывается",
			status: "assigned",
			hoursAgo: .9,
			master: true,
			price: 9e4
		},
		{
			no: 12388,
			client: 4,
			spec: "elec",
			desc: "Искрит розетка в коридоре",
			status: "enroute",
			hoursAgo: 1.5,
			master: true,
			price: 7e4
		},
		{
			no: 12380,
			client: 5,
			spec: "plumb",
			desc: "Засор стояка на 4 этаже",
			status: "in_progress",
			hoursAgo: 2.2,
			master: true,
			price: 12e4
		},
		{
			no: 12340,
			client: 6,
			spec: "appliance",
			desc: "Стиральная машина не сливает воду",
			status: "completed",
			hoursAgo: 8,
			master: true,
			price: 1e5,
			rating: 5
		},
		{
			no: 12331,
			client: 7,
			spec: "furniture",
			desc: "Сборка шкафа IKEA PAX",
			status: "completed",
			hoursAgo: 22,
			master: true,
			price: 18e4,
			rating: 5
		},
		{
			no: 12322,
			client: 8,
			spec: "ac",
			desc: "Чистка внутреннего блока сплита",
			status: "completed",
			hoursAgo: 30,
			master: true,
			price: 15e4,
			rating: 4
		},
		{
			no: 12310,
			client: 9,
			spec: "paint",
			desc: "Покраска комнаты 16 м²",
			status: "completed",
			hoursAgo: 48,
			master: true,
			price: 32e4,
			rating: 5
		},
		{
			no: 12290,
			client: 0,
			spec: "plumb",
			desc: "Замена унитаза",
			status: "completed",
			hoursAgo: 54,
			master: true,
			price: 2e5,
			rating: 5
		},
		{
			no: 12270,
			client: 1,
			spec: "elec",
			desc: "Установка люстры и двух бра",
			status: "completed",
			hoursAgo: 70,
			master: true,
			price: 11e4,
			rating: 4
		},
		{
			no: 12240,
			client: 2,
			spec: "lock",
			desc: "Замена личинки",
			status: "completed",
			hoursAgo: 96,
			master: true,
			price: 9e4,
			rating: 5
		},
		{
			no: 12210,
			client: 3,
			spec: "other",
			desc: "Повесить карниз и зеркало",
			status: "completed",
			hoursAgo: 120,
			master: true,
			price: 8e4,
			rating: 5
		},
		{
			no: 12180,
			client: 4,
			spec: "appliance",
			desc: "Не морозит холодильник",
			status: "cancelled",
			hoursAgo: 10,
			price: 1e5
		},
		{
			no: 12150,
			client: 5,
			spec: "paint",
			desc: "Поклейка обоев — клиент передумал",
			status: "cancelled",
			hoursAgo: 36,
			price: 2e5
		}
	]) {
		const client = clients[o.client] ?? clients[0];
		const created = (/* @__PURE__ */ new Date(Date.now() - o.hoursAgo * 36e5)).toISOString();
		const masterId = o.master ? bySpec(o.spec) : null;
		const payout = Math.round(o.price * .7);
		const assigned = o.master ? (/* @__PURE__ */ new Date(Date.now() - (o.hoursAgo - .15) * 36e5)).toISOString() : null;
		const accepted = o.status === "enroute" || o.status === "in_progress" || o.status === "completed" ? (/* @__PURE__ */ new Date(Date.now() - (o.hoursAgo - .25) * 36e5)).toISOString() : null;
		const completedAt = o.status === "completed" ? (/* @__PURE__ */ new Date(Date.now() - (o.hoursAgo - 1.2) * 36e5)).toISOString() : null;
		const cancelledAt = o.status === "cancelled" ? created : null;
		const startedAt = o.status === "in_progress" || o.status === "completed" ? accepted : null;
		const orderId = (await sql`
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
    `)[0].id;
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
			await addNote(sql, userId, "admin", `Мастер отказался от заявки №${o.no}`, "Назначьте другого мастера — автоподбора нет", orderId, null);
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
	const waiting = await sql`
    select id, public_no from as_orders where user_id = ${userId} and status = 'waiting_admin'
  `;
	for (const w of waiting) await addNote(sql, userId, "admin", `Новая заявка №${w.public_no}`, "Ожидает назначения мастера", w.id, null);
}
async function addEvent(sql, userId, orderId, eventType, actor, metadata) {
	await sql`
    insert into as_order_events (user_id, order_id, event_type, actor, metadata)
    values (${userId}, ${orderId}, ${eventType}, ${actor}, ${JSON.stringify(metadata)})
  `;
}
async function addAudit(sql, userId, action, objectType, objectId, oldValue, newValue) {
	await sql`
    insert into as_audit (user_id, action, object_type, object_id, old_value, new_value)
    values (${userId}, ${action}, ${objectType}, ${objectId}, ${oldValue}, ${newValue})
  `;
}
async function addNote(sql, userId, kind, title, body, orderId, masterId) {
	await sql`
    insert into as_notifications (user_id, kind, title, body, order_id, master_id)
    values (${userId}, ${kind}, ${title}, ${body}, ${orderId}, ${masterId})
  `;
}
async function tickPresence(sql, userId) {
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
async function ctxSql(userId) {
	const sql = await getSql();
	await ensureWorkspace(sql, userId);
	return sql;
}
function n(v) {
	const x = typeof v === "number" ? v : Number(v);
	return Number.isFinite(x) ? x : 0;
}
function mapMaster(r, active = 0) {
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
		online_status: r.online_status,
		last_seen: String(r.last_seen),
		lat: r.lat == null ? null : n(r.lat),
		lng: r.lng == null ? null : n(r.lng),
		registered_at: String(r.registered_at),
		avg_minutes: n(r.avg_minutes),
		earnings: n(r.earnings),
		active_orders: active
	};
}
function mapOrder(r) {
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
		status: r.status,
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
		master_name: r.master_name ? String(r.master_name) : null
	};
}
var ORDER_SELECT = `
  o.*, c.name as client_name, c.telegram_id as client_tg, c.rating as client_rating,
  case when m.id is null then null else m.first_name || ' ' || m.last_name end as master_name
`;
var bootstrap_createServerFn_handler = createServerRpc({
	id: "bcee57888284512163ce188ef314601cbe1872c893a3cb32212c42475e952876",
	name: "bootstrap",
	filename: "src/lib/server/api.ts"
}, (opts) => bootstrap.__executeServer(opts));
var bootstrap = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(bootstrap_createServerFn_handler, async ({ context }) => {
	await tickPresence(await ctxSql(context.userId), context.userId);
	return { ok: true };
});
var getDashboard_createServerFn_handler = createServerRpc({
	id: "4303ff2527037c84f7e30b270e3f6e8a6118e8bf6a13e0e3f4d48144dd33a3ab",
	name: "getDashboard",
	filename: "src/lib/server/api.ts"
}, (opts) => getDashboard.__executeServer(opts));
var getDashboard = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getDashboard_createServerFn_handler, async ({ context }) => {
	const sql = await ctxSql(context.userId);
	await tickPresence(sql, context.userId);
	const uid = context.userId;
	const [clients, masters, orders, finance, returning] = await Promise.all([
		sql`
        select
          count(*)::int as total,
          count(*) filter (where created_at >= current_date)::int as today,
          count(*) filter (where created_at >= current_date - interval '7 days')::int as week,
          count(*) filter (where blocked)::int as blocked
        from as_clients where user_id = ${uid}
      `,
		sql`
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
		sql`
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
		sql`
        select
          coalesce(sum(price) filter (where status = 'completed' and completed_at >= current_date), 0)::int as today,
          coalesce(sum(price) filter (where status = 'completed' and completed_at >= current_date - interval '7 days'), 0)::int as week,
          coalesce(sum(price) filter (where status = 'completed' and completed_at >= date_trunc('month', now())), 0)::int as month,
          coalesce(avg(price) filter (where status = 'completed'), 0)::int as avg,
          coalesce(sum(master_payout) filter (where status = 'completed'), 0)::int as payout
        from as_orders where user_id = ${uid}
      `,
		sql`
        select count(*)::int as n from (
          select client_id from as_orders where user_id = ${uid} group by client_id having count(*) > 1
        ) t
      `
	]);
	const recentOrders = await sql.query(`select ${ORDER_SELECT}
       from as_orders o
       join as_clients c on c.id = o.client_id
       left join as_masters m on m.id = o.master_id
       where o.user_id = $1
       order by o.created_at desc
       limit 8`, [uid]);
	const notes = await sql`
      select id, kind, title, body, order_id, master_id, read, created_at
      from as_notifications where user_id = ${uid} order by created_at desc limit 8
    `;
	return {
		clients: {
			...clients[0],
			active: n(clients[0]?.total) - n(clients[0]?.blocked),
			returning: n(returning[0]?.n)
		},
		masters: masters[0],
		orders: orders[0],
		finance: finance[0],
		recent: recentOrders.map(mapOrder),
		notifications: notes
	};
});
var listOrders_createServerFn_handler = createServerRpc({
	id: "202fbb145d2052de8349c5e1f4290bfb8ba1a4b77fb94f23ecd2a258156ed6fb",
	name: "listOrders",
	filename: "src/lib/server/api.ts"
}, (opts) => listOrders.__executeServer(opts));
var listOrders = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((q) => q ?? {}).handler(listOrders_createServerFn_handler, async ({ context, data }) => {
	const sql = await ctxSql(context.userId);
	const uid = context.userId;
	const status = data.status && data.status !== "all" ? data.status : null;
	const search = data.q?.trim() ? `%${data.q.trim()}%` : null;
	const limit = Math.min(data.limit ?? 80, 200);
	return (await sql.query(`select ${ORDER_SELECT}
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
       limit $4`, [
		uid,
		status,
		search,
		limit
	])).map(mapOrder);
});
var getOrder_createServerFn_handler = createServerRpc({
	id: "453d097a7c34892f9bd6191b8fff54cdbd80cd8c29e0d7b0c460a5ed586968b9",
	name: "getOrder",
	filename: "src/lib/server/api.ts"
}, (opts) => getOrder.__executeServer(opts));
var getOrder = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((id) => id).handler(getOrder_createServerFn_handler, async ({ context, data: id }) => {
	const sql = await ctxSql(context.userId);
	const rows = await sql.query(`select ${ORDER_SELECT}
       from as_orders o
       join as_clients c on c.id = o.client_id
       left join as_masters m on m.id = o.master_id
       where o.user_id = $1 and o.id = $2`, [context.userId, id]);
	const order = rows[0] ? mapOrder(rows[0]) : null;
	if (!order) return {
		error: "ORDER_NOT_FOUND",
		order: null,
		events: [],
		clientOrders: 0,
		master: null
	};
	const events = await sql`
      select id, event_type, actor, metadata, created_at
      from as_order_events where user_id = ${context.userId} and order_id = ${id}
      order by created_at asc
    `;
	const clientOrders = await sql`
      select count(*)::int as n from as_orders where user_id = ${context.userId} and client_id = ${order.client_id}
    `;
	let master = null;
	if (order.master_id) {
		const m = await sql`select * from as_masters where user_id = ${context.userId} and id = ${order.master_id}`;
		if (m[0]) master = mapMaster(m[0]);
	}
	return {
		order,
		events,
		clientOrders: n(clientOrders[0]?.n),
		master,
		error: null
	};
});
var listMasters_createServerFn_handler = createServerRpc({
	id: "5e417ceff8cef4b1a7aceeef244eb450c166dd5f3343d639e9c2449c3dda1757",
	name: "listMasters",
	filename: "src/lib/server/api.ts"
}, (opts) => listMasters.__executeServer(opts));
var listMasters = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listMasters_createServerFn_handler, async ({ context }) => {
	const sql = await ctxSql(context.userId);
	await tickPresence(sql, context.userId);
	const rows = await sql`select * from as_masters where user_id = ${context.userId} order by rating desc`;
	const active = await sql`
      select master_id, count(*)::int as n from as_orders
      where user_id = ${context.userId} and master_id is not null
        and status in ('assigned','master_accepted','enroute','arrived','in_progress')
      group by master_id
    `;
	const map = new Map(active.map((a) => [n(a.master_id), n(a.n)]));
	return rows.map((r) => mapMaster(r, map.get(n(r.id)) ?? 0));
});
var getMaster_createServerFn_handler = createServerRpc({
	id: "089abd061d1b05f1569598e712a50563d15a89d7498c1cf127b7a93ae9585855",
	name: "getMaster",
	filename: "src/lib/server/api.ts"
}, (opts) => getMaster.__executeServer(opts));
var getMaster = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((id) => id).handler(getMaster_createServerFn_handler, async ({ context, data: id }) => {
	const sql = await ctxSql(context.userId);
	const rows = await sql`select * from as_masters where user_id = ${context.userId} and id = ${id}`;
	if (!rows[0]) return {
		master: null,
		orders: [],
		reviews: []
	};
	const active = await sql`
      select count(*)::int as n from as_orders
      where user_id = ${context.userId} and master_id = ${id}
        and status in ('assigned','master_accepted','enroute','arrived','in_progress')
    `;
	const orders = await sql.query(`select ${ORDER_SELECT}
       from as_orders o join as_clients c on c.id = o.client_id
       left join as_masters m on m.id = o.master_id
       where o.user_id = $1 and o.master_id = $2
       order by o.created_at desc limit 30`, [context.userId, id]);
	const reviews = await sql`
      select r.id, r.rating, r.comment, r.created_at, coalesce(o.public_no, 0) as public_no,
             coalesce(c.name, '') as client_name, '' as master_name
      from as_reviews r
      left join as_orders o on o.id = r.order_id
      left join as_clients c on c.id = r.client_id
      where r.user_id = ${context.userId} and r.master_id = ${id}
      order by r.created_at desc
    `;
	return {
		master: mapMaster(rows[0], n(active[0]?.n)),
		orders: orders.map(mapOrder),
		reviews
	};
});
var listClients_createServerFn_handler = createServerRpc({
	id: "e97090349ac20a696306f2e3bb514ace9e3f94429545a22f9e237ad7ab72b861",
	name: "listClients",
	filename: "src/lib/server/api.ts"
}, (opts) => listClients.__executeServer(opts));
var listClients = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listClients_createServerFn_handler, async ({ context }) => {
	return await (await ctxSql(context.userId))`
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
});
var candidatesForOrder_createServerFn_handler = createServerRpc({
	id: "039ed02e2cf72d530f94e43b3df30b754b8896bdd94a786b0da5f10df778b6c7",
	name: "candidatesForOrder",
	filename: "src/lib/server/api.ts"
}, (opts) => candidatesForOrder.__executeServer(opts));
var candidatesForOrder = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((orderId) => orderId).handler(candidatesForOrder_createServerFn_handler, async ({ context, data: orderId }) => {
	const sql = await ctxSql(context.userId);
	await tickPresence(sql, context.userId);
	const order = (await sql`select * from as_orders where user_id = ${context.userId} and id = ${orderId}`)[0];
	if (!order) return {
		error: "ORDER_NOT_FOUND",
		masters: []
	};
	const masters = await listMastersInner(sql, context.userId);
	const olat = order.lat == null ? null : n(order.lat);
	const olng = order.lng == null ? null : n(order.lng);
	const spec = String(order.category_slug);
	const scored = masters.map((m) => {
		const km = olat != null && olng != null && m.lat != null && m.lng != null ? haversineKm(olat, olng, m.lat, m.lng) : null;
		const recommended = m.specialization === spec && m.online_status !== "offline" && m.online_status !== "blocked" && m.active_orders < 3;
		return {
			...m,
			km,
			recommended
		};
	});
	scored.sort((a, b) => {
		if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
		if (a.km != null && b.km != null) return a.km - b.km;
		return b.rating - a.rating;
	});
	return {
		error: null,
		masters: scored,
		spec
	};
});
async function listMastersInner(sql, uid) {
	const rows = await sql`select * from as_masters where user_id = ${uid} order by rating desc`;
	const active = await sql`
    select master_id, count(*)::int as n from as_orders
    where user_id = ${uid} and master_id is not null
      and status in ('assigned','master_accepted','enroute','arrived','in_progress')
    group by master_id
  `;
	const map = new Map(active.map((a) => [n(a.master_id), n(a.n)]));
	return rows.map((r) => mapMaster(r, map.get(n(r.id)) ?? 0));
}
var assignMaster_createServerFn_handler = createServerRpc({
	id: "3915cf46293774e384236bcabc185f12ef0e24cd084b8ac72a8f330f10f9668e",
	name: "assignMaster",
	filename: "src/lib/server/api.ts"
}, (opts) => assignMaster.__executeServer(opts));
var assignMaster = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(assignMaster_createServerFn_handler, async ({ context, data }) => {
	const sql = await ctxSql(context.userId);
	const uid = context.userId;
	const order = (await sql`select * from as_orders where user_id = ${uid} and id = ${data.orderId}`)[0];
	if (!order) return {
		success: false,
		error: "ORDER_NOT_FOUND"
	};
	const status = String(order.status);
	if (!ASSIGNABLE.includes(status) && status !== "assigned") return {
		success: false,
		error: "ORDER_NOT_ASSIGNABLE"
	};
	const master = (await sql`select * from as_masters where user_id = ${uid} and id = ${data.masterId}`)[0];
	if (!master) return {
		success: false,
		error: "MASTER_NOT_FOUND"
	};
	if (String(master.online_status) === "blocked") return {
		success: false,
		error: "MASTER_BLOCKED"
	};
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
	await addNote(sql, uid, "master", `Вам назначен заказ №${order.public_no}`, `${order.description}`, data.orderId, data.masterId);
	await addNote(sql, uid, "client", `Мастер назначен`, `${name} — ожидает подтверждения`, data.orderId, data.masterId);
	return {
		success: true,
		error: null,
		masterName: name
	};
});
var cancelOrder_createServerFn_handler = createServerRpc({
	id: "6017d46f10284f0e86b960d2ff3addeca29517995bcdaa38324909d3db0c6739",
	name: "cancelOrder",
	filename: "src/lib/server/api.ts"
}, (opts) => cancelOrder.__executeServer(opts));
var cancelOrder = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((orderId) => orderId).handler(cancelOrder_createServerFn_handler, async ({ context, data: orderId }) => {
	const sql = await ctxSql(context.userId);
	await sql`
      update as_orders set status = 'cancelled', cancelled_at = now(), updated_at = now()
      where user_id = ${context.userId} and id = ${orderId} and status <> 'completed'
    `;
	await addEvent(sql, context.userId, orderId, "cancelled", "admin", {});
	await addAudit(sql, context.userId, "cancel_order", "order", String(orderId), null, "cancelled");
	return { success: true };
});
var masterDecision_createServerFn_handler = createServerRpc({
	id: "ba1c7b0ba3e4dbff43f472ea8d14d65ba6d11c5e276240b298451db5aafc5c79",
	name: "masterDecision",
	filename: "src/lib/server/api.ts"
}, (opts) => masterDecision.__executeServer(opts));
var masterDecision = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(masterDecision_createServerFn_handler, async ({ context, data }) => {
	const sql = await ctxSql(context.userId);
	const uid = context.userId;
	const order = (await sql`select * from as_orders where user_id = ${uid} and id = ${data.orderId}`)[0];
	if (!order) return {
		success: false,
		error: "ORDER_NOT_FOUND"
	};
	if (n(order.master_id) !== data.masterId) return {
		success: false,
		error: "NOT_ASSIGNED"
	};
	if (String(order.status) !== "assigned") return {
		success: false,
		error: "WRONG_STATUS"
	};
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
		await addNote(sql, uid, "admin", `Мастер отказался от заявки №${order.public_no}`, "Назначьте другого мастера — система никого не подберёт сама", data.orderId, null);
		await addNote(sql, uid, "client", "Мастер отказался", "Администратор назначит другого", data.orderId, null);
	}
	return {
		success: true,
		error: null
	};
});
var masterAdvance_createServerFn_handler = createServerRpc({
	id: "5a6c98f82d6a7c87424440a9a2bd303e27a2813fbab8c7094dff50c45fdc3db2",
	name: "masterAdvance",
	filename: "src/lib/server/api.ts"
}, (opts) => masterAdvance.__executeServer(opts));
var masterAdvance = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(masterAdvance_createServerFn_handler, async ({ context, data }) => {
	const sql = await ctxSql(context.userId);
	const allowed = {
		master_accepted: "enroute",
		enroute: "arrived",
		arrived: "in_progress",
		in_progress: "completed"
	};
	const order = (await sql`select * from as_orders where user_id = ${context.userId} and id = ${data.orderId}`)[0];
	if (!order) return {
		success: false,
		error: "ORDER_NOT_FOUND"
	};
	if (n(order.master_id) !== data.masterId) return {
		success: false,
		error: "NOT_ASSIGNED"
	};
	if (allowed[String(order.status)] !== data.to) return {
		success: false,
		error: "WRONG_STATUS"
	};
	if (data.to === "enroute") await sql`update as_orders set status = 'enroute', updated_at = now() where user_id = ${context.userId} and id = ${data.orderId}`;
	else if (data.to === "arrived") await sql`update as_orders set status = 'arrived', arrived_at = now(), updated_at = now() where user_id = ${context.userId} and id = ${data.orderId}`;
	else if (data.to === "in_progress") await sql`update as_orders set status = 'in_progress', started_at = now(), updated_at = now() where user_id = ${context.userId} and id = ${data.orderId}`;
	else if (data.to === "completed") {
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
	return {
		success: true,
		error: null
	};
});
var heartbeatMaster_createServerFn_handler = createServerRpc({
	id: "28996e49bd3e2d1b68355ed9ddfafb9b247000d8836be2b442d90f48f4764904",
	name: "heartbeatMaster",
	filename: "src/lib/server/api.ts"
}, (opts) => heartbeatMaster.__executeServer(opts));
var heartbeatMaster = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((masterId) => masterId).handler(heartbeatMaster_createServerFn_handler, async ({ context, data: masterId }) => {
	const sql = await ctxSql(context.userId);
	const status = n((await sql`
      select count(*)::int as n from as_orders
      where user_id = ${context.userId} and master_id = ${masterId}
        and status in ('assigned','master_accepted','enroute','arrived','in_progress')
    `)[0]?.n) > 0 ? "busy" : "online";
	await sql`
      update as_masters set last_seen = now(), online_status = ${status}
      where user_id = ${context.userId} and id = ${masterId} and online_status <> 'blocked'
    `;
	return {
		ok: true,
		status
	};
});
var createOrder_createServerFn_handler = createServerRpc({
	id: "90fd3c78b75753d13c0d8c571c4d9f025a05c757f33fc65c5b5732924d2770f4",
	name: "createOrder",
	filename: "src/lib/server/api.ts"
}, (opts) => createOrder.__executeServer(opts));
var createOrder = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createOrder_createServerFn_handler, async ({ context, data }) => {
	const sql = await ctxSql(context.userId);
	const uid = context.userId;
	const svc = serviceById(data.category) ?? SERVICES[0];
	let client = await sql`
      select id from as_clients where user_id = ${uid} and phone = ${data.phone} limit 1
    `;
	if (!client[0]) client = await sql`
        insert into as_clients (user_id, telegram_id, name, phone, city, district, lat, lng)
        values (${uid}, ${"bot"}, ${data.name}, ${data.phone}, ${"Ташкент"}, ${data.district}, ${data.lat}, ${data.lng})
        returning id
      `;
	const clientId = client[0].id;
	const publicNo = n((await sql`
      select coalesce(max(public_no), 12000) + 1 as n from as_orders where user_id = ${uid}
    `)[0]?.n);
	const photos = JSON.stringify((data.photos ?? []).slice(0, 3));
	const price = svc.from;
	const id = (await sql`
      insert into as_orders (
        user_id, public_no, client_id, category_slug, description, phone, city, district, address,
        lat, lng, status, photos, comment, price, master_payout
      ) values (
        ${uid}, ${publicNo}, ${clientId}, ${svc.id}, ${data.description}, ${data.phone}, ${"Ташкент"},
        ${data.district}, ${data.district}, ${data.lat}, ${data.lng}, ${"waiting_admin"}, ${photos},
        ${data.comment ?? ""}, ${price}, ${Math.round(price * .7)}
      ) returning id
    `)[0].id;
	await addEvent(sql, uid, id, "created", "client", { source: "telegram" });
	await addEvent(sql, uid, id, "geo", "client", {
		district: data.district,
		lat: data.lat,
		lng: data.lng
	});
	if (data.photos?.length) await addEvent(sql, uid, id, "photos", "client", { count: data.photos.length });
	await addNote(sql, uid, "admin", `Новая заявка №${publicNo}`, data.description, id, null);
	await addAudit(sql, uid, "create_order", "order", String(id), null, "waiting_admin");
	return {
		id,
		publicNo,
		status: "waiting_admin",
		price
	};
});
var rateOrder_createServerFn_handler = createServerRpc({
	id: "f93cb4c7119028cb25ec3b46abd4bd7440c71023f65b0166920bdd5d08ed5a65",
	name: "rateOrder",
	filename: "src/lib/server/api.ts"
}, (opts) => rateOrder.__executeServer(opts));
var rateOrder = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(rateOrder_createServerFn_handler, async ({ context, data }) => {
	const sql = await ctxSql(context.userId);
	const order = (await sql`select * from as_orders where user_id = ${context.userId} and id = ${data.orderId}`)[0];
	if (!order || String(order.status) !== "completed") return { success: false };
	await sql`
      insert into as_reviews (user_id, order_id, client_id, master_id, rating, comment)
      values (${context.userId}, ${data.orderId}, ${n(order.client_id)}, ${order.master_id == null ? null : n(order.master_id)}, ${data.rating}, ${data.comment ?? ""})
    `;
	if (order.master_id != null) await sql`
        update as_masters set rating = (
          select round(avg(rating)::numeric, 2) from as_reviews
          where user_id = ${context.userId} and master_id = ${n(order.master_id)}
        )
        where user_id = ${context.userId} and id = ${n(order.master_id)}
      `;
	await addEvent(sql, context.userId, data.orderId, "reviewed", "client", { rating: data.rating });
	return { success: true };
});
var getMapData_createServerFn_handler = createServerRpc({
	id: "862c476a59719f767f96324bc02e68e49a16e1af07ee37d3683ef7281871592c",
	name: "getMapData",
	filename: "src/lib/server/api.ts"
}, (opts) => getMapData.__executeServer(opts));
var getMapData = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getMapData_createServerFn_handler, async ({ context }) => {
	const sql = await ctxSql(context.userId);
	await tickPresence(sql, context.userId);
	const masters = await listMastersInner(sql, context.userId);
	const orders = await sql.query(`select ${ORDER_SELECT}
       from as_orders o join as_clients c on c.id = o.client_id
       left join as_masters m on m.id = o.master_id
       where o.user_id = $1 and o.status not in ('completed','cancelled')
       order by o.created_at desc`, [context.userId]);
	const clients = await sql`
      select id, name, lat, lng, district from as_clients where user_id = ${context.userId}
    `;
	return {
		masters,
		orders: orders.map(mapOrder),
		clients
	};
});
var getAnalytics_createServerFn_handler = createServerRpc({
	id: "4cb0c004d1395b50a3d126168a8cdd18353f3971a6159e50c5b1c895a32f7625",
	name: "getAnalytics",
	filename: "src/lib/server/api.ts"
}, (opts) => getAnalytics.__executeServer(opts));
var getAnalytics = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getAnalytics_createServerFn_handler, async ({ context }) => {
	const sql = await ctxSql(context.userId);
	const uid = context.userId;
	const byDay = await sql`
      select to_char(created_at, 'YYYY-MM-DD') as d, count(*)::int as n,
             coalesce(sum(price) filter (where status = 'completed'), 0)::int as revenue
      from as_orders where user_id = ${uid} and created_at >= current_date - interval '14 days'
      group by 1 order by 1
    `;
	const byCat = await sql`
      select category_slug as slug, count(*)::int as n from as_orders
      where user_id = ${uid} group by 1 order by n desc
    `;
	const byCity = await sql`
      select district, count(*)::int as n from as_orders where user_id = ${uid} group by 1 order by n desc
    `;
	const ratings = await sql`
      select rating, count(*)::int as n from as_reviews where user_id = ${uid} group by 1 order by 1
    `;
	const funnel = await sql`
      select
        count(*)::int as created,
        count(*) filter (where assigned_at is not null)::int as assigned,
        count(*) filter (where accepted_at is not null)::int as accepted,
        count(*) filter (where status = 'completed')::int as completed,
        count(*) filter (where status = 'cancelled')::int as cancelled
      from as_orders where user_id = ${uid}
    `;
	const byHour = await sql`
      select extract(hour from created_at)::int as h, count(*)::int as n
      from as_orders where user_id = ${uid}
      group by 1 order by 1
    `;
	return {
		byDay,
		byCat,
		byCity,
		ratings,
		funnel: funnel[0],
		byHour
	};
});
var listReviews_createServerFn_handler = createServerRpc({
	id: "6c04d81788a3c57d766af26335d2a82b9ab514e7c7ce26545d83c260a93e473f",
	name: "listReviews",
	filename: "src/lib/server/api.ts"
}, (opts) => listReviews.__executeServer(opts));
var listReviews = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listReviews_createServerFn_handler, async ({ context }) => {
	return (await ctxSql(context.userId))`
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
var listAudit_createServerFn_handler = createServerRpc({
	id: "84aef8fa63c4455597f669a5df96a0a760073d7655821458f5c8c8c3d2236a55",
	name: "listAudit",
	filename: "src/lib/server/api.ts"
}, (opts) => listAudit.__executeServer(opts));
var listAudit = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listAudit_createServerFn_handler, async ({ context }) => {
	return (await ctxSql(context.userId))`
      select id, action, object_type, object_id, old_value, new_value, created_at
      from as_audit where user_id = ${context.userId} order by created_at desc limit 100
    `;
});
var listNotifications_createServerFn_handler = createServerRpc({
	id: "c3972ee4d0736a00df2095b11cc29da4af69edc7462b684c3b8b7d301bd86b49",
	name: "listNotifications",
	filename: "src/lib/server/api.ts"
}, (opts) => listNotifications.__executeServer(opts));
var listNotifications = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listNotifications_createServerFn_handler, async ({ context }) => {
	return (await ctxSql(context.userId))`
      select id, kind, title, body, order_id, master_id, read, created_at
      from as_notifications where user_id = ${context.userId} order by created_at desc limit 40
    `;
});
var pollOrder_createServerFn_handler = createServerRpc({
	id: "1e0f2965b7521f4746fce81272de642d119351d8918684efa0ad549530ab2cde",
	name: "pollOrder",
	filename: "src/lib/server/api.ts"
}, (opts) => pollOrder.__executeServer(opts));
var pollOrder = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((id) => id).handler(pollOrder_createServerFn_handler, async ({ context, data: id }) => {
	const rows = await (await ctxSql(context.userId)).query(`select ${ORDER_SELECT}
       from as_orders o join as_clients c on c.id = o.client_id
       left join as_masters m on m.id = o.master_id
       where o.user_id = $1 and o.id = $2`, [context.userId, id]);
	return rows[0] ? mapOrder(rows[0]) : null;
});
//#endregion
export { assignMaster_createServerFn_handler, bootstrap_createServerFn_handler, cancelOrder_createServerFn_handler, candidatesForOrder_createServerFn_handler, createOrder_createServerFn_handler, getAnalytics_createServerFn_handler, getDashboard_createServerFn_handler, getMapData_createServerFn_handler, getMaster_createServerFn_handler, getOrder_createServerFn_handler, heartbeatMaster_createServerFn_handler, listAudit_createServerFn_handler, listClients_createServerFn_handler, listMasters_createServerFn_handler, listNotifications_createServerFn_handler, listOrders_createServerFn_handler, listReviews_createServerFn_handler, masterAdvance_createServerFn_handler, masterDecision_createServerFn_handler, pollOrder_createServerFn_handler, rateOrder_createServerFn_handler };
