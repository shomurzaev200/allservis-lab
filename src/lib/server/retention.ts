import type { Sql } from "./workspace";

/** Stale drafts and start-only people. Orders, payments, reviews, and masters stay. */
const DAYS = 30;

export async function sweepRetention(sql: Sql): Promise<void> {
  const days = DAYS;
  const sessions = await sql<{ id: number }>`
    delete from as_tg_sessions s
    where s.updated_at < now() - (${days} * interval '1 day')
      and (
        s.live_order_id is null
        or not exists (
          select 1 from as_orders o
          where o.id = s.live_order_id
            and o.status in ('waiting_admin','assigned','master_accepted','enroute','arrived','in_progress')
        )
      )
    returning 1 as id
  `;
  const threads = await sql<{ id: number }>`
    delete from as_alert_threads
    where created_at < now() - (${days} * interval '1 day')
    returning 1 as id
  `;
  const notes = await sql<{ id: number }>`
    delete from as_notifications
    where created_at < now() - (${days} * interval '1 day')
    returning 1 as id
  `;
  const audit = await sql<{ id: number }>`
    delete from as_audit
    where created_at < now() - (${days} * interval '1 day')
    returning 1 as id
  `;
  // Pressed /start and never left a phone, order, payment, or review.
  const people = await sql<{ id: number }>`
    delete from as_clients c
    where c.created_at < now() - (${days} * interval '1 day')
      and coalesce(c.phone, '') = ''
      and c.blocked = false
      and c.archived_at is null
      and coalesce(c.role, 'client') <> 'master'
      and not exists (select 1 from as_orders o where o.client_id = c.id)
      and not exists (
        select 1 from as_payments p
        where p.client_id = c.id
           or (c.telegram_id is not null and p.telegram_id = c.telegram_id)
      )
      and not exists (select 1 from as_reviews r where r.client_id = c.id)
      and not exists (
        select 1 from as_masters m
        where m.user_id = c.user_id and m.telegram_id = c.telegram_id and c.telegram_id is not null
      )
      and not exists (
        select 1 from as_clients friend
        where c.ref_code is not null and c.ref_code <> '' and friend.referred_by = c.ref_code
      )
      and not exists (
        select 1 from as_tg_sessions s
        where s.user_id = c.user_id and s.chat_id = c.telegram_id
          and s.updated_at >= now() - (${days} * interval '1 day')
      )
    returning 1 as id
  `;
  const orphans = await sql<{ id: number }>`
    delete from as_tg_sessions s
    where s.updated_at < now() - (${days} * interval '1 day')
      and not exists (
        select 1 from as_clients c
        where c.user_id = s.user_id and c.telegram_id = s.chat_id
      )
      and not exists (
        select 1 from as_masters m
        where m.user_id = s.user_id and m.telegram_id = s.chat_id
      )
    returning 1 as id
  `;
  const n = sessions.length + orphans.length;
  if (n || threads.length || notes.length || audit.length || people.length) {
    console.log(
      `[allservis] retention ${days}d: sessions=${n} threads=${threads.length} notes=${notes.length} audit=${audit.length} idle=${people.length}`,
    );
  }
}

const boot = globalThis as typeof globalThis & { __retentionStarted?: boolean };

export function startRetention(sql: Sql) {
  if (boot.__retentionStarted) return;
  boot.__retentionStarted = true;
  const run = () => {
    void sweepRetention(sql).catch((err) => console.error("[allservis] retention failed:", err));
  };
  run();
  const timer = setInterval(run, 24 * 60 * 60 * 1000);
  timer.unref?.();
}
