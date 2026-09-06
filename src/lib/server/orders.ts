import { SERVICES, serviceById } from "@/lib/catalog";
import { addAudit, addEvent, addNote, type Sql } from "./workspace";

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
};

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

export async function insertOrder(sql: Sql, uid: string, data: CreateOrderInput) {
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
      values (${uid}, ${data.telegramId && data.telegramId.length >= 8 ? data.telegramId : null}, ${data.name}, ${data.phone}, ${"Ташкент"}, ${data.district}, ${data.lat}, ${data.lng})
      returning id
    `;
  } else if (data.telegramId) {
    await sql`update as_clients set telegram_id = ${data.telegramId}, phone = ${data.phone} where id = ${client[0].id}`;
  }
  const clientId = client[0]!.id;
  const blocked = await sql<{ blocked: boolean }>`select blocked from as_clients where id = ${clientId} and user_id = ${uid}`;
  if (blocked[0]?.blocked) {
    throw new Error("CLIENT_BLOCKED");
  }
  const no = await sql<{ n: number }>`select coalesce(max(public_no), 12000) + 1 as n from as_orders where user_id = ${uid}`;
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
  await addNote(sql, uid, "admin", `Новая заявка №${publicNo}`, data.description, id, null);
  await addAudit(sql, uid, "create_order", "order", String(id), null, "waiting_admin");
  try {
    const cl = await sql<{ referred_by: string | null }>`select referred_by from as_clients where id = ${clientId}`;
    const code = cl[0]?.referred_by;
    if (code?.startsWith("c")) {
      await sql`update as_ref_links set orders = orders + 1 where user_id = ${uid} and code = ${code}`;
    }
  } catch { /* ignore */ }
  return { id, publicNo, status: "waiting_admin" as const, price };
}
