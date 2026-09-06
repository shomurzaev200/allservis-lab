import { getSql } from "@/lib/db";
import { ensureWorkspace, tickPresence, type Sql } from "./workspace";
import { resumeBots } from "./telegram";

export type StaffRole = "owner" | "admin";

export type Perms = {
  invite: boolean;
  delete: boolean;
  assign: boolean;
  finance: boolean;
  bots: boolean;
};

export type Actor = {
  workspaceId: string;
  actorId: string;
  role: StaffRole;
  email: string;
  name: string;
  blocked: boolean;
  perms: Perms;
};

function flag(v: unknown): boolean {
  return v === true || v === "t" || v === "true" || v === 1 || v === "1";
}

function ownerPerms(): Perms {
  return { invite: true, delete: true, assign: true, finance: true, bots: true };
}

function staffPerms(row: { can_invite?: unknown; can_delete?: unknown; can_assign?: unknown; can_finance?: unknown; can_bots?: unknown }): Perms {
  return {
    invite: flag(row.can_invite),
    delete: flag(row.can_delete),
    assign: flag(row.can_assign),
    finance: flag(row.can_finance),
    bots: flag(row.can_bots),
  };
}

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

  let byUser: {
    workspace_id: string; role: string; blocked: boolean; email: string; name: string;
    can_invite?: boolean; can_delete?: boolean; can_assign?: boolean; can_finance?: boolean; can_bots?: boolean;
  }[] = [];
  try {
    byUser = await sql`
      select workspace_id, role, blocked, email, name,
        coalesce(can_invite, false) as can_invite,
        coalesce(can_delete, false) as can_delete,
        coalesce(can_assign, false) as can_assign,
        coalesce(can_finance, false) as can_finance,
        coalesce(can_bots, false) as can_bots
      from as_staff where user_id = ${userId} limit 1
    `;
  } catch {
    byUser = await sql`select workspace_id, role, blocked, email, name from as_staff where user_id = ${userId} limit 1`;
  }
  if (byUser[0]) {
    if (byUser[0].blocked) throw new Error("BLOCKED");
    await ensureWorkspace(sql, byUser[0].workspace_id);
    const role = byUser[0].role === "owner" ? "owner" as const : "admin" as const;
    return {
      workspaceId: byUser[0].workspace_id,
      actorId: userId,
      role,
      email: byUser[0].email,
      name: byUser[0].name || name,
      blocked: false,
      perms: role === "owner" ? ownerPerms() : staffPerms(byUser[0]),
    };
  }

  const invite = await sql<{
    id: number; workspace_id: string; role: string; blocked: boolean;
    can_invite?: boolean; can_delete?: boolean; can_assign?: boolean; can_finance?: boolean; can_bots?: boolean;
  }>`
    select id, workspace_id, role, blocked,
      coalesce(can_invite, false) as can_invite,
      coalesce(can_delete, false) as can_delete,
      coalesce(can_assign, false) as can_assign,
      coalesce(can_finance, false) as can_finance,
      coalesce(can_bots, false) as can_bots
    from as_staff
    where email = ${email} and user_id is null
    limit 1
  `.catch(async () =>
    sql<{ id: number; workspace_id: string; role: string; blocked: boolean }>`
      select id, workspace_id, role, blocked from as_staff
      where email = ${email} and user_id is null
      limit 1
    `,
  );
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
      perms: invite[0].role === "owner" ? ownerPerms() : staffPerms(invite[0]),
    };
  }

  const existingOwner = await sql<{ n: number }>`select 1 as n from as_staff where role = ${"owner"} limit 1`;
  if (existingOwner[0]) {
    throw new Error("NOT_INVITED");
  }

  await ensureWorkspace(sql, userId);
  await sql`
    insert into as_staff (workspace_id, user_id, email, name, role, blocked)
    values (${userId}, ${userId}, ${email}, ${name}, ${"owner"}, ${false})
    on conflict (workspace_id, email) do update set user_id = excluded.user_id, name = excluded.name
  `;
  return { workspaceId: userId, actorId: userId, role: "owner", email, name, blocked: false, perms: ownerPerms() };
}

export async function actorCtx(userId: string) {
  const sql = await getSql();
  const actor = await resolveActor(sql, userId);
  await tickPresence(sql, actor.workspaceId);
  void resumeBots(sql, actor.workspaceId);
  return { sql, uid: actor.workspaceId, actor };
}

export function requireOwner(actor: Actor) {
  if (actor.role !== "owner") throw new Error("OWNER_ONLY");
}

export function requireAdmin(actor: Actor) {
  if (actor.role !== "owner" && actor.role !== "admin") throw new Error("ADMIN_ONLY");
}

export function can(actor: Actor, perm: keyof Perms) {
  return actor.role === "owner" || Boolean(actor.perms?.[perm]);
}
