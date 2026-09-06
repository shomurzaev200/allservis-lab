import { getSql } from "@/lib/db";
import { ensureWorkspace, tickPresence, type Sql } from "./workspace";

export type StaffRole = "owner" | "admin";

export type Actor = {
  workspaceId: string;
  actorId: string;
  role: StaffRole;
  email: string;
  name: string;
  blocked: boolean;
};

async function emailOf(sql: Sql, userId: string): Promise<{ email: string; name: string }> {
  try {
    const rows = await sql.query<{ email: string; name: string }>(
      `select email, name from "user" where id = $1`,
      [userId],
    );
    if (rows[0]?.email) {
      return { email: rows[0].email.trim().toLowerCase(), name: rows[0].name || "" };
    }
  } catch {
    /* preview / no auth row */
  }
  return { email: `${userId}@local`, name: "Оператор" };
}

export async function resolveActor(sql: Sql, userId: string): Promise<Actor> {
  const { email, name } = await emailOf(sql, userId);

  const byUser = await sql<{
    workspace_id: string; role: string; blocked: boolean; email: string; name: string;
  }>`
    select workspace_id, role, blocked, email, name from as_staff where user_id = ${userId} limit 1
  `;
  if (byUser[0]) {
    if (byUser[0].blocked) throw new Error("BLOCKED");
    await ensureWorkspace(sql, byUser[0].workspace_id);
    return {
      workspaceId: byUser[0].workspace_id,
      actorId: userId,
      role: byUser[0].role === "owner" ? "owner" : "admin",
      email: byUser[0].email,
      name: byUser[0].name || name,
      blocked: false,
    };
  }

  const invite = await sql<{
    id: number; workspace_id: string; role: string; blocked: boolean;
  }>`
    select id, workspace_id, role, blocked from as_staff
    where email = ${email} and user_id is null
    limit 1
  `;
  if (invite[0]) {
    if (invite[0].blocked) throw new Error("BLOCKED");
    await sql`update as_staff set user_id = ${userId}, name = ${name} where id = ${invite[0].id}`;
    await ensureWorkspace(sql, invite[0].workspace_id);
    return {
      workspaceId: invite[0].workspace_id,
      actorId: userId,
      role: invite[0].role === "owner" ? "owner" : "admin",
      email,
      name,
      blocked: false,
    };
  }

  await ensureWorkspace(sql, userId);
  await sql`
    insert into as_staff (workspace_id, user_id, email, name, role, blocked)
    values (${userId}, ${userId}, ${email}, ${name}, ${"owner"}, ${false})
    on conflict (workspace_id, email) do update set user_id = excluded.user_id, name = excluded.name
  `;
  return { workspaceId: userId, actorId: userId, role: "owner", email, name, blocked: false };
}

export async function actorCtx(userId: string) {
  const sql = await getSql();
  const actor = await resolveActor(sql, userId);
  await tickPresence(sql, actor.workspaceId);
  return { sql, uid: actor.workspaceId, actor };
}

export function requireOwner(actor: Actor) {
  if (actor.role !== "owner") throw new Error("OWNER_ONLY");
}

export function requireAdmin(actor: Actor) {
  if (actor.role !== "owner" && actor.role !== "admin") throw new Error("ADMIN_ONLY");
}
