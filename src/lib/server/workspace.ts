import { SERVICES } from "@/lib/catalog";

export type Sql = Awaited<ReturnType<typeof import("@/lib/db").getSql>>;

const purgedGhosts = new Set<string>();

export async function ensureWorkspace(sql: Sql, userId: string) {
  const existing = await sql<{ user_id: string }>`
    select user_id from as_workspace where user_id = ${userId}
  `;
  if (!existing[0]) {
    await seed(sql, userId);
    purgedGhosts.add(userId);
    return;
  }
  if (!purgedGhosts.has(userId)) {
    purgedGhosts.add(userId);
    await purgeGhosts(sql, userId);
  }
}

/** Only rows explicitly marked demo. A missing Telegram id is not a test record. */
async function purgeGhosts(sql: Sql, userId: string) {
  try {
    const ghosts = await sql<{ id: number }>`
      select id from as_clients
      where user_id = ${userId} and is_demo = true
    `;
    for (const g of ghosts) {
      await sql`update as_clients set archived_at = now(), name = ${"Архив демо"} where user_id = ${userId} and id = ${g.id} and archived_at is null`;
    }
  } catch {
    /* column arrives with migration 0014 */
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
    insert into as_audit (user_id, action, object_type, object_id, old_value, new_value, actor_name, actor_email)
    values (${userId}, ${action}, ${objectType}, ${objectId}, ${oldValue}, ${newValue}, ${who?.name ?? null}, ${who?.email ?? null})
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

/** Hold the master's share until the client (or operator) confirms the job. */
export async function parkPayout(sql: Sql, userId: string, masterId: number, orderId: number, amount: number) {
  try {
    const exists = await sql<{ id: number }>`
      select id from as_payouts where user_id = ${userId} and order_id = ${orderId} limit 1
    `;
    if (exists[0]) return;
    await sql`
      insert into as_payouts (user_id, master_id, order_id, amount, status, note)
      values (${userId}, ${masterId}, ${orderId}, ${amount}, ${"pending"}, ${"ждёт подтверждения клиента"})
    `;
  } catch {
    /* table arrives with migration 0014 */
  }
}

/** Move one pending payout to accrued and add it to earnings exactly once. */
export async function accruePayout(sql: Sql, userId: string, masterId: number, orderId: number, amount: number) {
  try {
    const flipped = await sql<{ id: number }>`
      update as_payouts set status = 'accrued'
      where user_id = ${userId} and order_id = ${orderId} and status = 'pending'
      returning id
    `;
    if (!flipped[0]) {
      const exists = await sql<{ id: number }>`
        select id from as_payouts where user_id = ${userId} and order_id = ${orderId} limit 1
      `;
      if (exists[0]) return false;
      await sql`
        insert into as_payouts (user_id, master_id, order_id, amount, status, note)
        values (${userId}, ${masterId}, ${orderId}, ${amount}, ${"accrued"}, ${"подтверждение"})
      `;
    }
    await sql`
      update as_masters set earnings = earnings + ${amount}, last_seen = now()
      where user_id = ${userId} and id = ${masterId}
    `;
    return true;
  } catch {
    return false;
  }
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
