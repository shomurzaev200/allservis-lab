import { SERVICES, serviceById } from "@/lib/catalog";
import { addAudit, addEvent, addNote, type Sql } from "./workspace";
import { trackRefEvent } from "./refs";
import { haversineKm } from "@/lib/domain";
import { assignmentCity, isInsideServiceArea, OUTSIDE_SERVICE_AREA, resolveLocation, sameDispatchCity } from "@/lib/geo";

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
  telegramId?: string;
  city?: string;
  address?: string;
  neighborhood?: string;
  scheduledFor?: string | null;
};

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

export async function insertOrder(sql: Sql, uid: string, data: CreateOrderInput) {
  const lat = n(data.lat);
  const lng = n(data.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInsideServiceArea(lat, lng)) {
    throw new Error(OUTSIDE_SERVICE_AREA);
  }
  const geo = await resolveLocation(lat, lng);
  if (!geo.inside) throw new Error(OUTSIDE_SERVICE_AREA);
  const city = assignmentCity(geo.city || data.city, lat, lng) || (geo.city || data.city || "").trim();
  const district = (geo.neighborhood || geo.district || data.district || data.neighborhood || "").trim();
  const address = (data.address || geo.fullAddress || [city, district].filter(Boolean).join(", ")).trim();

  const svc = serviceById(data.category) ?? SERVICES[0]!;
  const tg = data.telegramId ?? "";
  let client = await sql<{ id: number }>`
    select id from as_clients
    where user_id = ${uid} and (phone = ${data.phone} or (${tg} <> '' and telegram_id = ${tg}))
    limit 1
  `;
  if (!client[0]) {
    client = await sql<{ id: number }>`
      insert into as_clients (user_id, telegram_id, name, phone, city, district, lat, lng)
      values (${uid}, ${data.telegramId && data.telegramId.length >= 5 ? data.telegramId : null}, ${data.name}, ${data.phone}, ${city}, ${district}, ${lat}, ${lng})
      returning id
    `;
  } else if (data.telegramId) {
    await sql`update as_clients set telegram_id = ${data.telegramId}, phone = ${data.phone}, name = ${data.name}, city = ${city}, district = ${district}, lat = ${lat}, lng = ${lng} where id = ${client[0].id}`;
  }
  const clientId = client[0]!.id;
  const blocked = await sql<{ blocked: boolean }>`select blocked from as_clients where id = ${clientId} and user_id = ${uid}`;
  if (blocked[0]?.blocked) {
    throw new Error("CLIENT_BLOCKED");
  }
  const photos = JSON.stringify((data.photos ?? []).slice(0, 3));
  const price = svc.from;
  const whenRaw = data.scheduledFor ? Date.parse(data.scheduledFor) : NaN;
  const scheduledFor = Number.isFinite(whenRaw) ? new Date(whenRaw).toISOString() : null;
  let id = 0;
  let publicNo = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const no = await sql<{ n: number }>`select coalesce(max(public_no), 12000) + 1 as n from as_orders where user_id = ${uid}`;
    publicNo = n(no[0]?.n);
    try {
      const rows = await sql<{ id: number }>`
        insert into as_orders (
          user_id, public_no, client_id, category_slug, description, phone, city, district, address,
          lat, lng, status, photos, comment, price, master_payout, price_estimate, scheduled_for
        ) values (
          ${uid}, ${publicNo}, ${clientId}, ${svc.id}, ${data.description}, ${data.phone}, ${city},
          ${district}, ${address}, ${lat}, ${lng}, ${"waiting_admin"}, ${photos},
          ${data.comment ?? ""}, ${price}, ${Math.round(price * 0.7)}, ${price}, ${scheduledFor}
        ) returning id
      `;
      id = rows[0]!.id;
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/unique|duplicate/i.test(msg) || attempt === 4) throw err;
    }
  }
  await addEvent(sql, uid, id, "created", "client", { source: "telegram" });
  await addNote(sql, uid, "admin", `Новая заявка №${publicNo}`, data.description, id, null);
  await addAudit(sql, uid, "create_order", "order", String(id), null, "waiting_admin");
  try {
    const cl = await sql<{ referred_by: string | null }>`select referred_by from as_clients where id = ${clientId}`;
    const code = cl[0]?.referred_by;
    if (code?.startsWith("c")) {
      await sql`update as_ref_links set orders = orders + 1 where user_id = ${uid} and code = ${code}`;
      await trackRefEvent(sql, uid, code, "order", data.telegramId ?? null);
    } else if (code) {
      await trackRefEvent(sql, uid, code, "order", data.telegramId ?? null);
    }
  } catch { /* ignore */ }
  return { id, publicNo, status: "waiting_admin" as const, price, city };
}

const OFFER_KM = 45;

type MasterCand = {
  id: number;
  first_name: string;
  last_name: string;
  lat: number;
  lng: number;
  city: string | null;
  specialization: string | null;
  last_offered_at: string | null;
};

/** Free masters in the SAME city. Oldest offer first, then the closer one — so the circle stays inside the city. */
export async function autoAssignNearest(sql: Sql, uid: string, orderId: number) {
  const orders = await sql<{
    id: number; lat: number | null; lng: number | null; status: string; city: string | null; category_slug: string | null;
  }>`
    select id, lat, lng, status, city, category_slug from as_orders where user_id = ${uid} and id = ${orderId}
  `;
  const order = orders[0];
  if (!order || !["waiting_admin", "master_rejected"].includes(String(order.status))) return null;
  const lat = Number(order.lat);
  const lng = Number(order.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const orderCity = assignmentCity(order.city, lat, lng);
  if (!orderCity) return null;

  const rejected = await sql<{ metadata: string }>`
    select metadata from as_order_events
    where user_id = ${uid} and order_id = ${orderId} and event_type = 'master_rejected'
  `;
  const skip = new Set<number>();
  for (const row of rejected) {
    try {
      const meta = JSON.parse(String(row.metadata || "{}")) as { masterId?: number };
      if (meta.masterId) skip.add(Number(meta.masterId));
    } catch { /* ignore */ }
  }

  let masters: MasterCand[] = [];
  try {
    masters = await sql`
      select id, first_name, last_name, lat, lng, city, specialization, last_offered_at
      from as_masters
      where user_id = ${uid}
        and online_status in ('online', 'busy')
        and lat is not null and lng is not null
        and length(coalesce(telegram_id, '')) >= 5
    `;
  } catch {
    masters = await sql`
      select id, first_name, last_name, lat, lng, city, specialization, null::timestamptz as last_offered_at
      from as_masters
      where user_id = ${uid}
        and online_status in ('online', 'busy')
        and lat is not null and lng is not null
        and length(coalesce(telegram_id, '')) >= 5
    `;
  }
  const busy = await sql<{ master_id: number }>`
    select master_id from as_orders
    where user_id = ${uid} and master_id is not null
      and status in ('assigned', 'master_accepted', 'enroute', 'arrived', 'in_progress')
  `;
  const taken = new Set(busy.map((b) => Number(b.master_id)));

  const cands = masters
    .filter((m) => !skip.has(m.id) && !taken.has(m.id))
    .filter((m) => sameDispatchCity(order.city, lat, lng, m.city, Number(m.lat), Number(m.lng)))
    .map((m) => ({
      id: m.id,
      name: `${m.first_name} ${m.last_name}`.trim(),
      km: haversineKm(lat, lng, Number(m.lat), Number(m.lng)),
      offered: m.last_offered_at ? new Date(m.last_offered_at).getTime() : 0,
    }))
    .filter((m) => m.km <= OFFER_KM)
    .sort((a, b) => (a.offered - b.offered) || (a.km - b.km));

  const pick = cands[0];
  if (!pick) return null;
  const updated = await sql<{ id: number }>`
    update as_orders
    set master_id = ${pick.id}, status = 'assigned', assigned_at = now(), updated_at = now(), assigned_by = ${"auto"}
    where user_id = ${uid} and id = ${orderId}
      and status in ('waiting_admin', 'master_rejected')
      and not exists (
        select 1 from as_orders o2
        where o2.user_id = ${uid} and o2.master_id = ${pick.id} and o2.id <> ${orderId}
          and o2.status in ('assigned', 'master_accepted', 'enroute', 'arrived', 'in_progress')
      )
    returning id
  `;
  if (!updated[0]) return null;
  try {
    await sql`update as_masters set last_offered_at = now(), last_seen = now() where user_id = ${uid} and id = ${pick.id}`;
  } catch { /* column arrives with 0015 */ }
  await addEvent(sql, uid, orderId, "assigned", "auto", { masterId: pick.id, km: pick.km, city: orderCity });
  return { masterId: pick.id, name: pick.name, km: pick.km, city: orderCity };
}

export async function waitingOrderIds(sql: Sql, uid: string) {
  const rows = await sql<{ id: number }>`
    select id from as_orders
    where user_id = ${uid} and status in ('waiting_admin', 'master_rejected')
    order by created_at asc
    limit 12
  `;
  return rows.map((r) => r.id);
}
