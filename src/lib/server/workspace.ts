import { SERVICES } from "@/lib/catalog";

export type Sql = Awaited<ReturnType<typeof import("@/lib/db").getSql>>;

const shiftStarted = new Set<string>();
const purgedGhosts = new Set<string>();

export async function ensureWorkspace(sql: Sql, userId: string) {
  const existing = await sql<{ user_id: string }>`
    select user_id from as_workspace where user_id = ${userId}
  `;
  if (!existing[0]) {
    await seed(sql, userId);
    shiftStarted.add(userId);
    purgedGhosts.add(userId);
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
  if (!purgedGhosts.has(userId)) {
    purgedGhosts.add(userId);
    await purgeGhosts(sql, userId);
  }
}

/** Demo/seed rows and anonymized «Удалён» must never show in any admin tab. */
async function purgeGhosts(sql: Sql, userId: string) {
  try {
    const ghosts = await sql<{ id: number }>`
      select id from as_clients
      where user_id = ${userId}
        and (
          name = ${"Удалён"}
          or telegram_id is null
          or telegram_id = ${"bot"}
          or length(coalesce(telegram_id, '')) < 8
        )
    `;
    for (const g of ghosts) {
      await sql`delete from as_order_events where user_id = ${userId} and order_id in (select id from as_orders where client_id = ${g.id})`;
      await sql`delete from as_notifications where user_id = ${userId} and order_id in (select id from as_orders where client_id = ${g.id})`;
      try { await sql`delete from as_reviews where user_id = ${userId} and client_id = ${g.id}`; } catch { /* ignore */ }
      try { await sql`delete from as_payments where user_id = ${userId} and client_id = ${g.id}`; } catch { /* ignore */ }
      await sql`delete from as_orders where user_id = ${userId} and client_id = ${g.id}`;
      await sql`delete from as_clients where user_id = ${userId} and id = ${g.id}`;
    }
  } catch { /* ignore */ }
  try {
    const fake = await sql<{ id: number }>`
      select id from as_masters
      where user_id = ${userId}
        and (telegram_id is null or length(coalesce(telegram_id, '')) < 8)
    `;
    for (const m of fake) {
      await sql`update as_orders set master_id = null, status = case
        when status in ('assigned','master_accepted','enroute','arrived','in_progress') then 'waiting_admin'
        else status end, updated_at = now()
        where user_id = ${userId} and master_id = ${m.id}`;
      try { await sql`delete from as_reviews where user_id = ${userId} and master_id = ${m.id}`; } catch { /* ignore */ }
      await sql`delete from as_notifications where user_id = ${userId} and master_id = ${m.id}`;
      await sql`delete from as_masters where user_id = ${userId} and id = ${m.id}`;
    }
  } catch { /* ignore */ }
}

async function seed(sql: Sql, userId: string) {
  await sql`insert into as_workspace (user_id, seeded) values (${userId}, true)`;
  for (const s of SERVICES) {
    await sql`
      insert into as_categories (user_id, slug, title, hint, price_from, diag_fee)
      values (${userId}, ${s.id}, ${s.title}, ${s.hint}, ${s.from}, ${s.diag})
    `;
  }
}


export type StaffWho = { name: string; email: string; role: string };

export async function addEvent(
  sql: Sql,
  userId: string,
  orderId: number,
  eventType: string,
  actor: string,
  metadata: Record<string, string | number | boolean | null>,
  who?: StaffWho,
) {
  await sql`
    insert into as_order_events (user_id, order_id, event_type, actor, metadata)
    values (${userId}, ${orderId}, ${eventType}, ${actor}, ${JSON.stringify(metadata)})
  `;
  void pushOrderAlert(sql, userId, orderId, eventType, who);
}

const SKIP_AUDIT_ALERT = new Set(["assign_master", "create_order"]);

export async function addAudit(
  sql: Sql,
  userId: string,
  action: string,
  objectType: string,
  objectId: string,
  oldValue: string | null,
  newValue: string | null,
  who?: StaffWho,
) {
  await sql`
    insert into as_audit (user_id, action, object_type, object_id, old_value, new_value)
    values (${userId}, ${action}, ${objectType}, ${objectId}, ${oldValue}, ${newValue})
  `;
  if (who && !SKIP_AUDIT_ALERT.has(action)) {
    void pushStaffAlert(sql, userId, action, objectType, objectId, oldValue, newValue, who);
  }
}

export async function addNote(sql: Sql, userId: string, kind: string, title: string, body: string, orderId: number | null, masterId: number | null) {
  await sql`
    insert into as_notifications (user_id, kind, title, body, order_id, master_id)
    values (${userId}, ${kind}, ${title}, ${body}, ${orderId}, ${masterId})
  `;
}

async function pushOrderAlert(sql: Sql, userId: string, orderId: number, eventType: string, who?: StaffWho) {
  try {
    const { pushOrderChannelAlert } = await import("./telegram");
    await pushOrderChannelAlert(sql, userId, orderId, eventType, who);
  } catch {
    /* alerts optional */
  }
}

async function pushStaffAlert(
  sql: Sql,
  userId: string,
  action: string,
  objectType: string,
  objectId: string,
  oldValue: string | null,
  newValue: string | null,
  who: StaffWho,
) {
  try {
    const { pushStaffActionAlert } = await import("./telegram");
    await pushStaffActionAlert(sql, userId, { action, objectType, objectId, oldValue, newValue, who });
  } catch {
    /* alerts optional */
  }
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
        where o.user_id = ${userId} and o.master_id = as_masters.id
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
        where o.user_id = ${userId} and o.master_id = m.id
          and o.status in ('assigned','master_accepted','enroute','arrived','in_progress')
      )
  `;
}
