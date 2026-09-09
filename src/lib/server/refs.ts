import type { Sql } from "./workspace";

export async function trackRefEvent(
  sql: Sql,
  uid: string,
  code: string,
  kind: string,
  telegramId?: string | null,
) {
  try {
    await sql`
      insert into as_ref_events (user_id, code, kind, telegram_id)
      values (${uid}, ${code || ""}, ${kind}, ${telegramId ?? null})
    `;
  } catch { /* table until migrate */ }
}

export function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 10000) / 100;
}

export function cpa(spend: number, n: number) {
  if (!n) return null;
  return Math.round((Number(spend) / n) * 100) / 100;
}
