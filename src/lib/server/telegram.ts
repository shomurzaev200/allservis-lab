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
type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: { id: string; from: TgUser; data?: string; message?: TgMessage };
  my_chat_member?: {
    chat: { id: number; type?: string; title?: string };
    new_chat_member?: { status?: string };
  };
};

async function tg(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: Record<string, unknown> | unknown[] };
  return json;
}

function markup(buttons?: KeyboardButton[][]) {
  if (!buttons?.length) return { remove_keyboard: true };
  return {
    keyboard: buttons.map((row) =>
      row.map((b) => ({
        text: b.label,
        ...(b.requestContact ? { request_contact: true as const } : {}),
        ...(b.requestLocation ? { request_location: true as const } : {}),
      })),
    ),
    resize_keyboard: true,
  };
}

function secretFrom(token: string) {
  let h = 0;
  for (let i = 0; i < token.length; i++) h = (h * 33 + token.charCodeAt(i)) >>> 0;
  return `as${h.toString(16)}${token.slice(-6)}`.replace(/[^a-zA-Z0-9_-]/g, "x").slice(0, 64);
}

function nSafe(v: unknown) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

const pollers = new Map<string, { stop: () => void }>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function stopPoller(token: string) {
  pollers.get(token)?.stop();
  pollers.delete(token);
}

export function startPoller(token: string, webhookId: string, secret: string) {
  if (pollers.has(token)) return;
  let alive = true;
  pollers.set(token, { stop: () => { alive = false; } });
  void (async () => {
    try { await tg(token, "deleteWebhook", { drop_pending_updates: false }); } catch { /* ignore */ }
    let offset = 0;
    while (alive) {
      try {
        const json = await tg(token, "getUpdates", {
          offset,
          timeout: 25,
          allowed_updates: ["message", "callback_query", "my_chat_member"],
        });
        if (!json.ok || !Array.isArray(json.result)) {
          await sleep(2500);
          continue;
        }
        for (const upd of json.result as TgUpdate[]) {
          offset = (upd.update_id ?? 0) + 1;
          try {
            await handleTelegramWebhook(webhookId, secret, upd);
          } catch {
            /* keep polling */
          }
        }
      } catch {
        await sleep(3000);
      }
    }
  })();
}

export async function resumeBots(sql: Sql, userId: string) {
  try {
    const ws = await sql<{ bot_token: string | null; webhook_id: string | null; bot_secret: string | null; poll_mode: boolean }>`
      select bot_token, webhook_id, bot_secret, poll_mode from as_workspace where user_id = ${userId}
    `;
    const w = ws[0];
    if (w?.poll_mode && w.bot_token && w.webhook_id && w.bot_secret) {
      startPoller(w.bot_token, w.webhook_id, w.bot_secret);
    }
    const extras = await sql<{ bot_token: string | null; webhook_id: string | null; bot_secret: string | null }>`
      select bot_token, webhook_id, bot_secret from as_bots
      where user_id = ${userId} and bot_token is not null and webhook_id is not null
    `;
    if (w?.poll_mode) {
      for (const b of extras) {
        if (b.bot_token && b.webhook_id && b.bot_secret) startPoller(b.bot_token, b.webhook_id, b.bot_secret);
      }
    }
  } catch {
    /* columns may not exist until migration */
  }
}

async function persistMainBot(
  sql: Sql,
  userId: string,
  token: string,
  username: string,
  secret: string,
  webhookId: string,
  origin: string,
  poll: boolean,
) {
  await sql`
    update as_workspace
    set bot_token = ${token}, bot_username = ${username}, bot_secret = ${secret},
        webhook_id = ${webhookId}, bot_connected_at = now(),
        public_origin = ${origin}, poll_mode = ${poll}
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
}

export async function connectTelegramBot(sql: Sql, userId: string, token: string, origin: string) {
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
    return { ok: false as const, error: "Неверный формат токена. Скопируйте его из @BotFather.", username: null as string | null, mode: null as string | null };
  }
  const me = await tg(token, "getMe", {});
  if (!me.ok || !me.result || Array.isArray(me.result)) {
    return { ok: false as const, error: me.description ?? "Telegram не принял токен. Проверьте, что бот создан в @BotFather.", username: null, mode: null };
  }
  const username = String((me.result as Record<string, unknown>).username ?? "");
  const webhookId = crypto.randomUUID();
  const secret = secretFrom(token);
  const https = origin.startsWith("https://");
  if (https) {
    const hookUrl = `${origin}/api/telegram/${webhookId}`;
    const set = await tg(token, "setWebhook", {
      url: hookUrl,
      secret_token: secret,
      allowed_updates: ["message", "callback_query", "my_chat_member"],
      drop_pending_updates: false,
    });
    if (!set.ok) {
      return { ok: false as const, error: set.description ?? "Не удалось поставить webhook. Нужен https-домен.", username: null, mode: null };
    }
    stopPoller(token);
    await persistMainBot(sql, userId, token, username, secret, webhookId, origin, false);
    return { ok: true as const, error: null, username, webhookUrl: hookUrl, mode: "webhook" };
  }
  await persistMainBot(sql, userId, token, username, secret, webhookId, origin, true);
  startPoller(token, webhookId, secret);
  return {
    ok: true as const,
    error: null,
    username,
    webhookUrl: null as string | null,
    mode: "polling",
  };
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
    return { ok: false as const, error: "Неверный формат токена. Скопируйте его из @BotFather.", username: null as string | null, mode: null as string | null };
  }
  const me = await tg(token, "getMe", {});
  if (!me.ok || !me.result || Array.isArray(me.result)) {
    return { ok: false as const, error: me.description ?? "Telegram не принял токен.", username: null, mode: null };
  }
  const username = String((me.result as Record<string, unknown>).username ?? "");
  const webhookId = crypto.randomUUID();
  const secret = secretFrom(token);
  const https = origin.startsWith("https://");
  if (https) {
    const hookUrl = `${origin}/api/telegram/${webhookId}`;
    const set = await tg(token, "setWebhook", {
      url: hookUrl,
      secret_token: secret,
      allowed_updates: ["message", "callback_query", "my_chat_member"],
      drop_pending_updates: false,
    });
    if (!set.ok) {
      return { ok: false as const, error: set.description ?? "Не удалось поставить webhook. Нужен https.", username: null, mode: null };
    }
    stopPoller(token);
  } else {
    startPoller(token, webhookId, secret);
    await sql`update as_workspace set poll_mode = ${true} where user_id = ${userId}`;
  }
  if (kind === "logs") {
    const prev = await sql<{ id: number; bot_token: string | null }>`
      select id, bot_token from as_bots where user_id = ${userId} and kind = ${"logs"} limit 1
    `;
    if (prev[0]?.bot_token && prev[0].bot_token !== token) {
      try { await tg(prev[0].bot_token, "deleteWebhook", {}); } catch { /* ignore */ }
      stopPoller(prev[0].bot_token);
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
  return { ok: true as const, error: null, username, webhookUrl: https ? `${origin}/api/telegram/${webhookId}` : null, mode: https ? "webhook" : "polling" };
}

export async function disconnectBotById(sql: Sql, userId: string, botId: number) {
  const row = await sql<{ bot_token: string | null; kind: string }>`
    select bot_token, kind from as_bots where user_id = ${userId} and id = ${botId}
  `;
  if (!row[0]) return;
  if (row[0].bot_token) {
    try { await tg(row[0].bot_token, "deleteWebhook", {}); } catch { /* ignore */ }
    stopPoller(row[0].bot_token);
  }
  await sql`delete from as_bots where user_id = ${userId} and id = ${botId}`;
  if (row[0].kind === "client") {
    const rest = await sql<{ n: number }>`select count(*)::int as n from as_bots where user_id = ${userId} and kind = ${"client"}`;
    if (!nSafe(rest[0]?.n)) {
      await sql`
        update as_workspace
        set bot_token = null, bot_username = null, bot_secret = null, webhook_id = null, bot_connected_at = null, poll_mode = ${false}
        where user_id = ${userId}
      `;
    }
  }
}

export async function pushWorkspaceLog(sql: Sql, userId: string, text: string) {
  const targets = new Set<string>();
  const bots = await sql<{ bot_token: string | null; log_chat_id: string | null }>`
    select bot_token, log_chat_id from as_bots
    where user_id = ${userId} and kind = ${"logs"} and bot_token is not null
  `;
  let token: string | null = null;
  for (const b of bots) {
    if (b.bot_token) token = b.bot_token;
    if (b.log_chat_id) targets.add(b.log_chat_id);
  }
  try {
    const ws = await sql<{ alerts_channel_id: string | null }>`
      select alerts_channel_id from as_workspace where user_id = ${userId}
    `;
    if (ws[0]?.alerts_channel_id) targets.add(ws[0].alerts_channel_id);
  } catch { /* ignore */ }
  if (!token) return;
  for (const chat of targets) {
    try {
      await tg(token, "sendMessage", { chat_id: Number(chat), text: text.slice(0, 3500) });
    } catch { /* ignore */ }
  }
}

export async function disconnectTelegramBot(sql: Sql, userId: string) {
  const row = await sql<{ bot_token: string | null }>`select bot_token from as_workspace where user_id = ${userId}`;
  const token = row[0]?.bot_token;
  if (token) {
    try { await tg(token, "deleteWebhook", { drop_pending_updates: false }); } catch { /* ignore */ }
    stopPoller(token);
  }
  await sql`
    update as_workspace
    set bot_token = null, bot_username = null, bot_secret = null, webhook_id = null, bot_connected_at = null, poll_mode = ${false}
    where user_id = ${userId}
  `;
  const extras = await sql<{ id: number; bot_token: string | null }>`
    select id, bot_token from as_bots where user_id = ${userId} and kind = ${"client"} and label = ${"Основной"}
  `;
  for (const b of extras) {
    await sql`delete from as_bots where id = ${b.id}`;
  }
}

function payText(card: string, bank: string, holder: string, amount: number) {
  const lines = [
    "Чтобы пользоваться ботом, оплатите доступ и пришлите скрин перевода.",
    "",
    bank ? `Банк: ${bank}` : null,
    card ? `Карта: ${card}` : null,
    holder ? `Получатель: ${holder}` : null,
    amount > 0 ? `Сумма: ${amount.toLocaleString("ru-RU")} сум` : null,
    "",
    "После перевода отправьте сюда скриншот чека. Администратор подтвердит — и бот откроется.",
  ];
  return lines.filter(Boolean).join("\n");
}

async function gated(
  sql: Sql,
  uid: string,
  token: string,
  chatId: string,
  from: TgUser,
  msg: TgMessage | undefined,
  cb: TgUpdate["callback_query"],
): Promise<boolean> {
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || "Клиент Telegram";
  let settings: { channel_username: string | null; pay_card: string | null; pay_bank: string | null; pay_holder: string | null; pay_amount: number } | undefined;
  try {
    settings = (await sql<{
      channel_username: string | null; pay_card: string | null; pay_bank: string | null; pay_holder: string | null; pay_amount: number;
    }>`
      select channel_username, pay_card, pay_bank, pay_holder, pay_amount from as_workspace where user_id = ${uid}
    `)[0];
  } catch {
    return false;
  }
  const channel = (settings?.channel_username ?? "").replace(/^@/, "").trim();
  if (channel) {
    const member = await tg(token, "getChatMember", { chat_id: `@${channel}`, user_id: from.id });
    const st = member.ok && member.result && !Array.isArray(member.result)
      ? String((member.result as Record<string, unknown>).status ?? "")
      : "";
    const ok = st === "member" || st === "administrator" || st === "creator";
    if (!ok) {
      if (cb?.id) await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Подписка не найдена" });
      await tg(token, "sendMessage", {
        chat_id: Number(chatId),
        text: `Сначала подпишитесь на канал @${channel}, затем нажмите «Я подписался».`,
        reply_markup: {
          inline_keyboard: [
            [{ text: `Открыть @${channel}`, url: `https://t.me/${channel}` }],
            [{ text: "Я подписался", callback_data: "sub:ok" }],
          ],
        },
      });
      return true;
    }
  }

  const amount = nSafe(settings?.pay_amount);
  if (amount <= 0 && !(settings?.pay_card ?? "").trim()) return false;

  let client = await sql<{ id: number; paid: boolean; blocked: boolean }>`
    select id, paid, blocked from as_clients where user_id = ${uid} and telegram_id = ${chatId} limit 1
  `;
  if (!client[0]) {
    await sql`
      insert into as_clients (user_id, telegram_id, name, phone, city, district, rating)
      values (${uid}, ${chatId}, ${name}, ${""}, ${"Ташкент"}, ${""}, ${5})
    `;
    client = await sql<{ id: number; paid: boolean; blocked: boolean }>`
      select id, paid, blocked from as_clients where user_id = ${uid} and telegram_id = ${chatId} limit 1
    `;
  }
  if (client[0]?.blocked) {
    await tg(token, "sendMessage", { chat_id: Number(chatId), text: "Профиль заблокирован администратором." });
    return true;
  }
  if (client[0]?.paid) return false;

  const pending = await sql<{ id: number; status: string }>`
    select id, status from as_payments where user_id = ${uid} and telegram_id = ${chatId} order by id desc limit 1
  `;
  if (pending[0]?.status === "approved") {
    await sql`update as_clients set paid = true, paid_at = now() where user_id = ${uid} and telegram_id = ${chatId}`;
    return false;
  }
  if (msg?.photo?.length) {
    const fileId = msg.photo[msg.photo.length - 1]!.file_id;
    const dataUrl = await downloadPhoto(token, fileId);
    if (pending[0]?.status === "pending") {
      await sql`update as_payments set screenshot = ${dataUrl ?? fileId} where id = ${pending[0].id}`;
    } else {
      await sql`
        insert into as_payments (user_id, client_id, telegram_id, client_name, amount, screenshot, status)
        values (${uid}, ${client[0]?.id ?? null}, ${chatId}, ${name}, ${amount}, ${dataUrl ?? fileId}, ${"pending"})
      `;
    }
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: "Скрин получил. Администратор проверит оплату. Как подтвердит — бот откроется.",
    });
    try {
      await pushWorkspaceLog(sql, uid, `💳 Скрин оплаты от ${name} (${chatId}). Сумма ${amount.toLocaleString("ru-RU")} сум.`);
    } catch { /* ignore */ }
    return true;
  }
  if (pending[0]?.status === "pending") {
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: "Ваш скрин уже на проверке. Подождите подтверждения администратора.",
    });
    return true;
  }
  await tg(token, "sendMessage", {
    chat_id: Number(chatId),
    text: payText(settings?.pay_card ?? "", settings?.pay_bank ?? "", settings?.pay_holder ?? "", amount),
  });
  return true;
}

async function persistProfile(sql: Sql, uid: string, chatId: string, name: string, draft: Draft) {
  const lang = draft.lang ?? "ru";
  const role = draft.role ?? "client";
  const phone = draft.phone ?? "";
  const district = draft.districtId ? (districtById(draft.districtId)?.title ?? "") : "";
  const lat = draft.lat ?? null;
  const lng = draft.lng ?? null;
  try {
    const existing = await sql<{ id: number }>`
      select id from as_clients where user_id = ${uid} and telegram_id = ${chatId} limit 1
    `;
    if (existing[0]) {
      await sql`
        update as_clients set
          name = ${name},
          phone = coalesce(nullif(${phone}, ''), phone),
          district = coalesce(nullif(${district}, ''), district),
          lat = coalesce(${lat}, lat),
          lng = coalesce(${lng}, lng),
          lang = ${lang},
          role = ${role}
        where id = ${existing[0].id}
      `;
    } else {
      await sql`
        insert into as_clients (user_id, telegram_id, name, phone, city, district, lat, lng, rating, lang, role)
        values (${uid}, ${chatId}, ${name}, ${phone}, ${"Ташкент"}, ${district}, ${lat}, ${lng}, ${5}, ${lang}, ${role})
      `;
    }
  } catch {
    /* lang/role columns until migrate */
    try {
      await sql`
        update as_clients set name = ${name},
          phone = coalesce(nullif(${phone}, ''), phone),
          district = coalesce(nullif(${district}, ''), district),
          lat = coalesce(${lat}, lat),
          lng = coalesce(${lng}, lng)
        where user_id = ${uid} and telegram_id = ${chatId}
      `;
    } catch { /* ignore */ }
  }
}

async function upsertMasterFromBot(sql: Sql, uid: string, chatId: string, name: string, draft: Draft) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] || "Мастер";
  const last = parts.slice(1).join(" ") || "Telegram";
  const spec = draft.serviceId ?? "other";
  const phone = draft.phone ?? "";
  const dist = draft.districtId ? districtById(draft.districtId)?.title ?? "" : "";
  const lat = draft.lat ?? null;
  const lng = draft.lng ?? null;
  const found = await sql<{ id: number }>`
    select id from as_masters where user_id = ${uid} and telegram_id = ${chatId} limit 1
  `;
  if (found[0]) {
    await sql`
      update as_masters set first_name = ${first}, last_name = ${last}, phone = ${phone},
        district = ${dist}, specialization = ${spec}, lat = ${lat}, lng = ${lng},
        online_status = 'online', last_seen = now()
      where id = ${found[0].id}
    `;
  } else {
    await sql`
      insert into as_masters (
        user_id, first_name, last_name, telegram_id, phone, city, district,
        specialization, online_status, last_seen, lat, lng
      ) values (
        ${uid}, ${first}, ${last}, ${chatId}, ${phone}, ${"Ташкент"}, ${dist},
        ${spec}, ${"online"}, now(), ${lat}, ${lng}
      )
    `;
  }
  try {
    await pushWorkspaceLog(sql, uid, `🛠 Новый мастер из бота: ${name} · ${spec} · ${phone} · ${dist}`);
  } catch { /* ignore */ }
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

  const kind = extra[0]?.kind ?? "client";
  const token = ws.bot_token;
  const uid = ws.user_id;

  if (update.my_chat_member && (kind === "logs" || extra[0]?.kind === "logs")) {
    const ch = update.my_chat_member.chat;
    const st = update.my_chat_member.new_chat_member?.status ?? "";
    if ((ch.type === "channel" || ch.type === "supergroup") && (st === "administrator" || st === "creator")) {
      const cid = String(ch.id);
      if (extra[0]) await sql`update as_bots set log_chat_id = ${cid} where id = ${extra[0].id}`;
      try {
        await sql`update as_workspace set alerts_channel_id = ${cid} where user_id = ${uid}`;
      } catch { /* col may miss until migrate */ }
      await tg(token, "sendMessage", {
        chat_id: ch.id,
        text: `Алерты All Servis подключены к каналу «${ch.title ?? cid}». Сюда пойдут заявки, оплаты, назначения.`,
      });
    }
    return { ok: true };
  }

  const from = msg?.from ?? cb?.from;
  const chatId = String(msg?.chat.id ?? cb?.message?.chat.id ?? from?.id ?? "");
  if (!chatId || !from) return { ok: true };

  if (kind === "logs") {
    if (msg?.text === "/start" || msg?.text === "/log") {
      await sql`update as_bots set log_chat_id = ${chatId} where id = ${extra[0]!.id}`;
      await tg(token, "sendMessage", {
        chat_id: Number(chatId),
        text: "Личный чат логов привязан. Чтобы слать алерты в закрытый канал: добавьте этого бота админом канала — ID сохранится сам. Либо вставьте ID канала (−100…) в Настройках.",
      });
    }
    return { ok: true };
  }

  const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || "Клиент Telegram";

  if (await gated(sql, uid, token, chatId, from, msg, cb)) return { ok: true };

  const sess = await sql<{ step: string; draft: string; live_order_id: number | null; last_status: string | null }>`
    select step, draft, live_order_id, last_status from as_tg_sessions where user_id = ${uid} and chat_id = ${chatId}
  `;
  let step = (sess[0]?.step ?? "lang") as ChatStep;
  let draft: Draft = sess[0]?.draft ? (JSON.parse(sess[0].draft) as Draft) : emptyDraft();
  draft = { ...emptyDraft(), ...draft, name };

  let event: BotEvent | null = null;
  if (cb?.data) {
    event = { type: "tap", id: cb.data, label: cb.data };
    await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
  } else if (msg?.location) {
    event = { type: "location", lat: msg.location.latitude, lng: msg.location.longitude };
  } else if (msg?.contact?.phone_number) {
    event = { type: "contact", phone: msg.contact.phone_number };
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

  await persistProfile(sql, uid, chatId, name, draft);

  if (result.registerMaster) {
    await upsertMasterFromBot(sql, uid, chatId, name, draft);
  }
  if (result.setOnline !== undefined) {
    await sql`
      update as_masters set online_status = ${result.setOnline ? "online" : "offline"}, last_seen = now()
      where user_id = ${uid} and telegram_id = ${chatId} and online_status <> 'blocked'
    `;
    try {
      await pushWorkspaceLog(sql, uid, `${result.setOnline ? "🟢" : "⚪️"} Мастер ${name} ${result.setOnline ? "онлайн" : "офлайн"}`);
    } catch { /* ignore */ }
  }

  if (result.cancelLive && sess[0]?.live_order_id) {
    const oid = sess[0].live_order_id;
    await sql`update as_orders set status = 'cancelled', cancelled_at = now(), updated_at = now() where user_id = ${uid} and id = ${oid} and status not in ('completed','cancelled')`;
    await sql`
      insert into as_tg_sessions (user_id, chat_id, step, draft, live_order_id, last_status, tg_name, updated_at)
      values (${uid}, ${chatId}, ${"category"}, ${JSON.stringify(emptyDraft())}, ${null}, ${"cancelled"}, ${name}, now())
      on conflict (user_id, chat_id) do update set step = ${"category"}, draft = ${JSON.stringify(emptyDraft())}, live_order_id = ${null}, last_status = ${"cancelled"}, tg_name = ${name}, updated_at = now()
    `;
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: "Заявка отменена. /start — новая.",
    });
    try {
      const { addEvent } = await import("./workspace");
      await addEvent(sql, uid, oid, "cancelled", "client", {});
    } catch { /* ignore */ }
    return { ok: true };
  }

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
          text: `${reply.text}\n\nЗаявка №${created.publicNo}\nВыезд от ${svc.from.toLocaleString("ru-RU")} сум\n\nОтмена: /cancel`,
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
    const path = info.result && !Array.isArray(info.result) && typeof info.result.file_path === "string" ? info.result.file_path : null;
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
  const msg = statusReply(status, masterName);
  const extra = status === "waiting_admin" || status === "assigned" ? "\nОтмена: /cancel" : "";
  if (!sess[0]) {
    const cl = await sql<{ telegram_id: string | null }>`
      select c.telegram_id from as_orders o join as_clients c on c.id = o.client_id
      where o.user_id = ${userId} and o.id = ${orderId}
    `;
    const tgId = cl[0]?.telegram_id;
    if (!tgId || !/^\d+$/.test(tgId)) return;
    await tg(token, "sendMessage", { chat_id: Number(tgId), text: msg.text + extra, reply_markup: markup(msg.buttons) });
    return;
  }
  await sql`update as_tg_sessions set last_status = ${status}, updated_at = now() where user_id = ${userId} and live_order_id = ${orderId}`;
  await tg(token, "sendMessage", {
    chat_id: Number(sess[0].chat_id),
    text: msg.text + extra,
    reply_markup: markup(msg.buttons),
  });
}

export { clientLabel };
