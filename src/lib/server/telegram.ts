import { getSql } from "@/lib/db";
import { districtById, serviceById } from "@/lib/catalog";
import { clientLabel, type OrderStatus } from "@/lib/domain";
import { emptyDraft, reduceBot, statusReply, type BotEvent } from "@/lib/bot";
import type { ChatStep, Draft, KeyboardButton } from "@/lib/types";
import { insertOrder } from "./orders";
import type { Sql } from "./workspace";

type TgUser = { id: number; first_name?: string; last_name?: string; username?: string };
type TgChat = { id: number };
type TgMessage = {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
  caption?: string;
  photo?: { file_id: string; file_size?: number }[];
  location?: { latitude: number; longitude: number };
  contact?: { phone_number: string; first_name?: string };
};
type TgUpdate = { update_id: number; message?: TgMessage; callback_query?: { id: string; from: TgUser; data?: string; message?: TgMessage } };

async function tg(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: Record<string, unknown> };
  return json;
}

function markup(buttons?: KeyboardButton[][]) {
  if (!buttons?.length) return { remove_keyboard: true };
  return {
    keyboard: buttons.map((row) => row.map((b) => ({ text: b.label }))),
    resize_keyboard: true,
  };
}

function secretFrom(token: string) {
  let h = 0;
  for (let i = 0; i < token.length; i++) h = (h * 33 + token.charCodeAt(i)) >>> 0;
  return `as${h.toString(16)}${token.slice(-6)}`.replace(/[^a-zA-Z0-9_-]/g, "x").slice(0, 64);
}

export async function connectTelegramBot(sql: Sql, userId: string, token: string, origin: string) {
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
    return { ok: false as const, error: "Неверный формат токена. Скопируйте его из @BotFather." };
  }
  const me = await tg(token, "getMe", {});
  if (!me.ok || !me.result) {
    return { ok: false as const, error: me.description ?? "Telegram не принял токен. Проверьте, что бот создан в @BotFather." };
  }
  const username = String(me.result.username ?? "");
  const webhookId = crypto.randomUUID();
  const secret = secretFrom(token);
  const hookUrl = `${origin}/api/telegram/${webhookId}`;
  const set = await tg(token, "setWebhook", {
    url: hookUrl,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
  if (!set.ok) {
    return { ok: false as const, error: set.description ?? "Не удалось поставить webhook. Сайт должен быть опубликован с https." };
  }
  await sql`
    update as_workspace
    set bot_token = ${token}, bot_username = ${username}, bot_secret = ${secret},
        webhook_id = ${webhookId}, bot_connected_at = now()
    where user_id = ${userId}
  `;
  const existing = await sql<{ id: number }>`
    select id from as_bots where user_id = ${userId} and kind = ${"client"} and label = ${"Основной"} limit 1
  `;
  if (existing[0]) {
    await sql`
      update as_bots set bot_token = ${token}, bot_username = ${username}, bot_secret = ${secret},
        webhook_id = ${webhookId}, connected_at = now()
      where id = ${existing[0].id}
    `;
  } else {
    await sql`
      insert into as_bots (user_id, kind, label, bot_token, bot_username, bot_secret, webhook_id, connected_at)
      values (${userId}, ${"client"}, ${"Основной"}, ${token}, ${username}, ${secret}, ${webhookId}, now())
    `;
  }
  return { ok: true as const, error: null, username, webhookUrl: hookUrl };
}

export async function connectExtraBot(
  sql: Sql,
  userId: string,
  token: string,
  origin: string,
  kind: "client" | "logs",
  label: string,
) {
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
    return { ok: false as const, error: "Неверный формат токена. Скопируйте его из @BotFather." };
  }
  const me = await tg(token, "getMe", {});
  if (!me.ok || !me.result) {
    return { ok: false as const, error: me.description ?? "Telegram не принял токен." };
  }
  const username = String(me.result.username ?? "");
  const webhookId = crypto.randomUUID();
  const secret = secretFrom(token);
  const hookUrl = `${origin}/api/telegram/${webhookId}`;
  const set = await tg(token, "setWebhook", {
    url: hookUrl,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
  if (!set.ok) {
    return { ok: false as const, error: set.description ?? "Не удалось поставить webhook. Нужен https." };
  }
  if (kind === "logs") {
    const prev = await sql<{ id: number; bot_token: string | null }>`
      select id, bot_token from as_bots where user_id = ${userId} and kind = ${"logs"} limit 1
    `;
    if (prev[0]?.bot_token && prev[0].bot_token !== token) {
      try { await tg(prev[0].bot_token, "deleteWebhook", {}); } catch { /* ignore */ }
    }
    if (prev[0]) {
      await sql`
        update as_bots set bot_token = ${token}, bot_username = ${username}, bot_secret = ${secret},
          webhook_id = ${webhookId}, label = ${label || "Логи"}, connected_at = now()
        where id = ${prev[0].id}
      `;
    } else {
      await sql`
        insert into as_bots (user_id, kind, label, bot_token, bot_username, bot_secret, webhook_id, connected_at)
        values (${userId}, ${"logs"}, ${label || "Логи"}, ${token}, ${username}, ${secret}, ${webhookId}, now())
      `;
    }
  } else {
    await sql`
      insert into as_bots (user_id, kind, label, bot_token, bot_username, bot_secret, webhook_id, connected_at)
      values (${userId}, ${"client"}, ${label || "Клиентский бот"}, ${token}, ${username}, ${secret}, ${webhookId}, now())
    `;
  }
  return { ok: true as const, error: null, username, webhookUrl: hookUrl };
}

export async function disconnectBotById(sql: Sql, userId: string, botId: number) {
  const row = await sql<{ bot_token: string | null; kind: string }>`
    select bot_token, kind from as_bots where user_id = ${userId} and id = ${botId}
  `;
  if (!row[0]) return;
  if (row[0].bot_token) {
    try { await tg(row[0].bot_token, "deleteWebhook", {}); } catch { /* ignore */ }
  }
  await sql`delete from as_bots where user_id = ${userId} and id = ${botId}`;
  if (row[0].kind === "client") {
    const rest = await sql<{ n: number }>`select count(*)::int as n from as_bots where user_id = ${userId} and kind = ${"client"}`;
    if (!nSafe(rest[0]?.n)) {
      await sql`
        update as_workspace
        set bot_token = null, bot_username = null, bot_secret = null, webhook_id = null, bot_connected_at = null
        where user_id = ${userId}
      `;
    }
  }
}

function nSafe(v: unknown) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

export async function pushWorkspaceLog(sql: Sql, userId: string, text: string) {
  const bots = await sql<{ bot_token: string | null; log_chat_id: string | null }>`
    select bot_token, log_chat_id from as_bots
    where user_id = ${userId} and kind = ${"logs"} and bot_token is not null and log_chat_id is not null
  `;
  for (const b of bots) {
    if (!b.bot_token || !b.log_chat_id) continue;
    try {
      await tg(b.bot_token, "sendMessage", { chat_id: Number(b.log_chat_id), text: text.slice(0, 3500) });
    } catch {
      /* ignore */
    }
  }
}

export async function disconnectTelegramBot(sql: Sql, userId: string) {
  const row = await sql<{ bot_token: string | null }>`select bot_token from as_workspace where user_id = ${userId}`;
  const token = row[0]?.bot_token;
  if (token) {
    try { await tg(token, "deleteWebhook", { drop_pending_updates: false }); } catch { /* ignore */ }
  }
  await sql`
    update as_workspace
    set bot_token = null, bot_username = null, bot_secret = null, webhook_id = null, bot_connected_at = null
    where user_id = ${userId}
  `;
  const extras = await sql<{ id: number; bot_token: string | null }>`
    select id, bot_token from as_bots where user_id = ${userId} and kind = ${"client"} and label = ${"Основной"}
  `;
  for (const b of extras) {
    await sql`delete from as_bots where id = ${b.id}`;
  }
}

export async function handleTelegramWebhook(hookId: string, secretHeader: string | null, update: TgUpdate) {
  const sql = await getSql();
  const extra = await sql<{
    id: number; user_id: string; kind: string; bot_token: string; bot_secret: string; log_chat_id: string | null;
  }>`
    select id, user_id, kind, bot_token, bot_secret, log_chat_id from as_bots where webhook_id = ${hookId}
  `;
  const ws = extra[0]
    ? extra[0]
    : (await sql<{ user_id: string; bot_token: string; bot_secret: string }>`
        select user_id, bot_token, bot_secret from as_workspace where webhook_id = ${hookId}
      `)[0];
  if (!ws?.bot_token) return { ok: false, error: "unknown bot" };
  const botSecret = "bot_secret" in ws ? ws.bot_secret : null;
  if (!botSecret || secretHeader !== botSecret) return { ok: false, error: "bad secret" };

  const msg = update.message;
  const cb = update.callback_query;
  const from = msg?.from ?? cb?.from;
  const chatId = String(msg?.chat.id ?? cb?.message?.chat.id ?? from?.id ?? "");
  if (!chatId || !from) return { ok: true };

  const kind = extra[0]?.kind ?? "client";
  const token = ws.bot_token;
  const uid = ws.user_id;

  if (kind === "logs") {
    if (msg?.text === "/start" || msg?.text === "/log") {
      await sql`update as_bots set log_chat_id = ${chatId} where id = ${extra[0]!.id}`;
      await tg(token, "sendMessage", {
        chat_id: Number(chatId),
        text: "Лог-бот All Servis подключён. Сюда будут приходить заявки, назначения, блокировки и действия администраторов.",
      });
    }
    return { ok: true };
  }

  const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || "Клиент Telegram";

  const sess = await sql<{ step: string; draft: string; live_order_id: number | null; last_status: string | null }>`
    select step, draft, live_order_id, last_status from as_tg_sessions where user_id = ${uid} and chat_id = ${chatId}
  `;
  let step = (sess[0]?.step ?? "category") as ChatStep;
  let draft: Draft = sess[0]?.draft ? (JSON.parse(sess[0].draft) as Draft) : emptyDraft();
  draft = { ...emptyDraft(), ...draft, name };

  let event: BotEvent | null = null;
  if (cb?.data) {
    event = { type: "tap", id: cb.data, label: cb.data };
    await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
  } else if (msg?.location) {
    event = { type: "location", lat: msg.location.latitude, lng: msg.location.longitude };
  } else if (msg?.contact?.phone_number) {
    event = { type: "text", text: msg.contact.phone_number };
  } else if (msg?.photo?.length) {
    const fileId = msg.photo[msg.photo.length - 1]!.file_id;
    const dataUrl = await downloadPhoto(token, fileId);
    event = dataUrl ? { type: "photo", dataUrl } : { type: "text", text: msg.caption || "фото" };
  } else if (msg?.text) {
    event = { type: "text", text: msg.text };
  }
  if (!event) return { ok: true };

  const result = reduceBot(step, draft, event);
  step = result.step;
  draft = result.draft;

  if (result.submit) {
    const dist = result.submit.districtId ? districtById(result.submit.districtId) : undefined;
    const svc = result.submit.serviceId ? serviceById(result.submit.serviceId) : undefined;
    if (dist && svc && result.submit.problem && result.submit.phone) {
      try {
        const created = await insertOrder(sql, uid, {
          name,
          phone: result.submit.phone,
          category: svc.id,
          description: result.submit.problem,
          district: dist.title,
          lat: result.submit.lat ?? dist.lat,
          lng: result.submit.lng ?? dist.lng,
          comment: result.submit.comment,
          photos: result.submit.photos,
          telegramId: chatId,
        });
        await sql`
          insert into as_tg_sessions (user_id, chat_id, step, draft, live_order_id, last_status, tg_name, updated_at)
          values (${uid}, ${chatId}, ${"live"}, ${JSON.stringify(draft)}, ${created.id}, ${"waiting_admin"}, ${name}, now())
          on conflict (user_id, chat_id) do update set step = ${"live"}, draft = ${JSON.stringify(draft)}, live_order_id = ${created.id}, last_status = ${"waiting_admin"}, tg_name = ${name}, updated_at = now()
        `;
        const reply = statusReply("waiting_admin");
        await tg(token, "sendMessage", {
          chat_id: Number(chatId),
          text: `${reply.text}\n\nЗаявка №${created.publicNo}\nВыезд от ${svc.from.toLocaleString("ru-RU")} сум`,
          reply_markup: markup(reply.buttons),
        });
      } catch (err) {
        const msgText = err instanceof Error && err.message === "CLIENT_BLOCKED"
          ? "Ваш профиль заблокирован администратором. Новую заявку создать нельзя."
          : "Не удалось создать заявку. Попробуйте ещё раз.";
        await tg(token, "sendMessage", { chat_id: Number(chatId), text: msgText });
      }
      return { ok: true };
    }
  }

  await sql`
    insert into as_tg_sessions (user_id, chat_id, step, draft, live_order_id, last_status, tg_name, updated_at)
    values (${uid}, ${chatId}, ${step}, ${JSON.stringify(draft)}, ${sess[0]?.live_order_id ?? null}, ${sess[0]?.last_status ?? null}, ${name}, now())
    on conflict (user_id, chat_id) do update set step = ${step}, draft = ${JSON.stringify(draft)}, tg_name = ${name}, updated_at = now()
  `;

  for (const r of result.replies) {
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: r.text,
      reply_markup: markup(r.buttons),
    });
  }
  return { ok: true };
}

async function downloadPhoto(token: string, fileId: string): Promise<string | null> {
  try {
    const info = await tg(token, "getFile", { file_id: fileId });
    const path = info.result && typeof info.result.file_path === "string" ? info.result.file_path : null;
    if (!path) return null;
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${path}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 1_200_000) return null;
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function pushOrderStatus(sql: Sql, userId: string, orderId: number, status: OrderStatus, masterName: string | null) {
  const ws = await sql<{ bot_token: string | null }>`select bot_token from as_workspace where user_id = ${userId}`;
  const token = ws[0]?.bot_token;
  if (!token) return;
  const sess = await sql<{ chat_id: string }>`
    select chat_id from as_tg_sessions where user_id = ${userId} and live_order_id = ${orderId}
  `;
  if (!sess[0]) {
    const cl = await sql<{ telegram_id: string | null }>`
      select c.telegram_id from as_orders o join as_clients c on c.id = o.client_id
      where o.user_id = ${userId} and o.id = ${orderId}
    `;
    const tgId = cl[0]?.telegram_id;
    if (!tgId || !/^\d+$/.test(tgId)) return;
    const msg = statusReply(status, masterName);
    await tg(token, "sendMessage", { chat_id: Number(tgId), text: msg.text, reply_markup: markup(msg.buttons) });
    return;
  }
  await sql`update as_tg_sessions set last_status = ${status}, updated_at = now() where user_id = ${userId} and live_order_id = ${orderId}`;
  const msg = statusReply(status, masterName);
  await tg(token, "sendMessage", {
    chat_id: Number(sess[0].chat_id),
    text: `${msg.text}${masterName ? "" : ""}`,
    reply_markup: markup(msg.buttons),
  });
}

export { clientLabel };
