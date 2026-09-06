import { getSql } from "@/lib/db";
import { DISTRICTS, districtById, serviceById } from "@/lib/catalog";
import { clientLabel, STATUS_LABEL, type OrderStatus } from "@/lib/domain";
import { emptyDraft, reduceBot, statusReply, clientMenu, liveMenu, masterMenu, labelToTapId, type BotEvent } from "@/lib/bot";
import type { ChatStep, Draft, KeyboardButton } from "@/lib/types";
import { insertOrder } from "./orders";
import type { Sql, StaffWho } from "./workspace";

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
  forward_from_chat?: { id: number; type?: string; title?: string; username?: string };
  forward_origin?: { type?: string; chat?: { id: number; type?: string; title?: string; username?: string } };
};
type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: { id: string; from: TgUser; data?: string; message?: TgMessage };
  channel_post?: { message_id?: number; chat: { id: number; type?: string; title?: string; username?: string }; text?: string };
  my_chat_member?: {
    chat: { id: number; type?: string; title?: string; username?: string };
    new_chat_member?: { status?: string };
  };
};

const TG_UPDATES = ["message", "callback_query", "my_chat_member", "channel_post"];

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

function inline(rows: { text: string; data: string }[][]) {
  return { inline_keyboard: rows.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data.slice(0, 64) }))) };
}

function jobButtons(orderId: number, status: string) {
  if (status === "assigned") {
    return inline([
      [
        { text: "✅ Принять", data: `j:a:${orderId}` },
        { text: "❌ Отклонить", data: `j:r:${orderId}` },
      ],
    ]);
  }
  if (status === "master_accepted") {
    return inline([[{ text: "🚗 Выехал", data: `j:e:${orderId}` }]]);
  }
  if (status === "enroute") {
    return inline([[{ text: "📍 Приехал", data: `j:h:${orderId}` }]]);
  }
  if (status === "arrived" || status === "in_progress") {
    return inline([[{ text: "✅ Завершить", data: `j:d:${orderId}` }]]);
  }
  return undefined;
}

function mapsLink(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return "";
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function escHtml(s: string) {
  const amp = String.fromCharCode(38);
  return s.replaceAll("&", `${amp}amp;`).replaceAll("<", `${amp}lt;`).replaceAll(">", `${amp}gt;`);
}

const EVENT_HEAD: Record<string, string> = {
  created: "🆕 Новая заявка",
  assigned: "📌 Мастер назначен",
  master_accepted: "✅ Мастер принял заказ",
  master_rejected: "❌ Мастер отказался — назначьте другого",
  enroute: "🚗 Мастер выехал к клиенту",
  arrived: "📍 Мастер на месте",
  in_progress: "🔧 Работа начата",
  completed: "✅ Заявка выполнена",
  cancelled: "🚫 Заявка отменена",
};

const ORDER_CARD_SQL = `
  select o.id, o.public_no, o.status, o.category_slug, o.description, o.phone, o.district, o.address,
         o.lat, o.lng, o.comment, o.price, o.master_payout, o.created_at, o.master_id,
         c.name as client_name, c.telegram_id as client_tg,
         m.telegram_id as master_tg, m.first_name, m.last_name, m.phone as master_phone,
         m.rating, m.specialization
  from as_orders o
  join as_clients c on c.id = o.client_id
  left join as_masters m on m.id = o.master_id
  where o.user_id = $1 and o.id = $2
`;

function formatOrderCard(o: Record<string, unknown>, eventType: string, role: "channel" | "master" = "channel", who?: StaffWho): string {
  const svc = serviceById(String(o.category_slug ?? ""));
  const distRaw = String(o.district ?? "");
  const dist = districtById(distRaw)?.title || distRaw || "—";
  const lat = o.lat == null ? null : Number(o.lat);
  const lng = o.lng == null ? null : Number(o.lng);
  const masterName = [o.first_name, o.last_name].filter(Boolean).join(" ").trim();
  const head = role === "master" ? "🆕 Вам назначен заказ" : (EVENT_HEAD[eventType] || "📋 Заявка");
  const st = String(o.status ?? eventType);
  const when = o.created_at
    ? new Date(String(o.created_at)).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" })
    : "";
  const geoOk = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const lines = [
    `<b>${escHtml(head)} №${escHtml(String(o.public_no))}</b>`,
    `Статус: ${escHtml(STATUS_LABEL[st as OrderStatus] ?? st)}`,
    when ? `🕐 ${escHtml(when)}` : "",
    "",
    `👤 Клиент: <b>${escHtml(String(o.client_name ?? "—"))}</b>`,
    o.client_tg ? `📱 Telegram: <code>${escHtml(String(o.client_tg))}</code>` : "",
    `📞 Телефон: <code>${escHtml(String(o.phone ?? "—"))}</code>`,
    `🏙 Район: ${escHtml(dist)}`,
    o.address && String(o.address) && String(o.address) !== distRaw ? `🏠 Адрес: ${escHtml(String(o.address))}` : "",
    geoOk ? `🗺 Гео: <code>${lat!.toFixed(5)}, ${lng!.toFixed(5)}</code>` : "🗺 Гео: не указано",
    geoOk ? mapsLink(lat, lng) : "",
    "",
    `🛠 Услуга: <b>${escHtml(svc?.title ?? String(o.category_slug ?? "—"))}</b>`,
    `📝 Проблема: ${escHtml(String(o.description ?? "—"))}`,
    o.comment ? `💬 Комментарий: ${escHtml(String(o.comment))}` : "",
    `💰 Сумма: ${Number(o.price ?? 0).toLocaleString("ru-RU")} сум`,
  ];
  if (who && role === "channel") {
    const roleRu = who.role === "owner" ? "владелец" : "сотрудник";
    lines.push(
      "",
      `👤 Сотрудник: <b>${escHtml(who.name || "—")}</b> · ${roleRu}`,
      who.email ? `✉️ <code>${escHtml(who.email)}</code>` : "",
    );
  }
  if (masterName) {
    lines.push(
      "",
      `👷 Мастер: <b>${escHtml(masterName)}</b>`,
      o.master_phone ? `📞 Мастер: <code>${escHtml(String(o.master_phone))}</code>` : "",
      o.rating != null ? `⭐ Рейтинг: ${Number(o.rating).toFixed(1)}` : "",
    );
  } else if (eventType === "created") {
    lines.push("", "⏳ Мастер ещё не назначен — откройте заявку в админке.");
  }
  return lines.filter((line, i, arr) => line !== "" || arr[i - 1] !== "").join("\n");
}

async function loadOrderCard(sql: Sql, uid: string, orderId: number) {
  const rows = await sql.query<Record<string, unknown>>(ORDER_CARD_SQL, [uid, orderId]);
  return rows[0] ?? null;
}

async function notifyMasterOfJob(sql: Sql, uid: string, token: string, orderId: number) {
  const o = await loadOrderCard(sql, uid, orderId);
  if (!o) return;
  const masterTg = o.master_tg ? String(o.master_tg) : "";
  if (!masterTg || !/^\d+$/.test(masterTg)) return;
  const lat = o.lat == null ? null : Number(o.lat);
  const lng = o.lng == null ? null : Number(o.lng);
  const text = formatOrderCard(o, "assigned", "master");
  const kb = jobButtons(Number(o.id), String(o.status));
  const sent = await tg(token, "sendMessage", {
    chat_id: Number(masterTg),
    text,
    parse_mode: "HTML",
    reply_markup: kb ?? markup(masterMenu("ru", true)),
  });
  if (!sent.ok) {
    await tg(token, "sendMessage", {
      chat_id: Number(masterTg),
      text: text.replace(/<[^>]+>/g, ""),
      reply_markup: kb ?? markup(masterMenu("ru", true)),
    });
  }
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    await tg(token, "sendLocation", { chat_id: Number(masterTg), latitude: lat, longitude: lng });
  }
}

async function notifyClientOfMaster(sql: Sql, uid: string, token: string, orderId: number, status: OrderStatus) {
  const rows = await sql.query<Record<string, unknown>>(
    `select o.id, o.public_no, o.status, o.lat, o.lng, o.district, c.telegram_id as client_tg, c.lang,
            m.first_name, m.last_name, m.phone as master_phone, m.rating, m.specialization, m.avg_minutes
     from as_orders o
     join as_clients c on c.id = o.client_id
     left join as_masters m on m.id = o.master_id
     where o.user_id = $1 and o.id = $2`,
    [uid, orderId],
  );
  const o = rows[0];
  if (!o) return;
  const chat = o.client_tg ? String(o.client_tg) : "";
  if (!chat || !/^\d+$/.test(chat)) return;
  const lang = o.lang === "uz" ? "uz" : "ru";
  const masterName = [o.first_name, o.last_name].filter(Boolean).join(" ") || "мастер";
  const svc = serviceById(String(o.specialization ?? ""));
  const eta = nSafe(o.avg_minutes) || svc?.etaMin || 30;
  const stars = "★".repeat(Math.round(nSafe(o.rating) || 5));
  const head = clientLabel(status);
  let extra = "";
  if (o.first_name && status !== "cancelled" && status !== "master_rejected" && status !== "waiting_admin") {
    extra = [
      "",
      `Мастер: ${masterName}`,
      o.master_phone ? `Телефон: ${o.master_phone}` : "",
      `Рейтинг: ${stars} ${Number(o.rating ?? 5).toFixed(1)}`,
      svc ? `Профиль: ${svc.title}` : "",
      status === "assigned" || status === "master_accepted" || status === "enroute" ? `Ориентир: ~${eta} мин` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  const rateKb =
    status === "completed"
      ? inline([
          [
            { text: "⭐⭐⭐⭐⭐", data: `rate:5:${orderId}` },
            { text: "⭐⭐⭐⭐", data: `rate:4:${orderId}` },
          ],
          [
            { text: "⭐⭐⭐", data: `rate:3:${orderId}` },
            { text: "⭐⭐", data: `rate:2:${orderId}` },
            { text: "⭐", data: `rate:1:${orderId}` },
          ],
        ])
      : undefined;
  const menu = status === "completed" || status === "cancelled" || status === "master_rejected" ? markup(clientMenu(lang)) : undefined;
  await tg(token, "sendMessage", {
    chat_id: Number(chat),
    text: `${head}\nЗаявка №${o.public_no}${extra}`,
    reply_markup: rateKb ?? menu ?? undefined,
  });
}

async function applyJob(sql: Sql, uid: string, token: string, masterTg: string, data: string) {
  const parts = data.split(":");
  const code = parts[1];
  const orderId = Number(parts[2]);
  if (!orderId || !code) return;
  const master = await sql<{ id: number; first_name: string; last_name: string }>`
    select id, first_name, last_name from as_masters where user_id = ${uid} and telegram_id = ${masterTg} limit 1
  `;
  if (!master[0]) {
    await tg(token, "sendMessage", { chat_id: Number(masterTg), text: "Профиль мастера не найден. /start → Я мастер." });
    return;
  }
  const mid = master[0].id;
  const o = await sql<{ id: number; status: string; public_no: number; master_id: number | null; master_payout: number }>`
    select id, status, public_no, master_id, master_payout from as_orders where user_id = ${uid} and id = ${orderId}
  `;
  if (!o[0] || Number(o[0].master_id) !== mid) {
    await tg(token, "sendMessage", { chat_id: Number(masterTg), text: "Эта заявка вам не назначена." });
    return;
  }
  const st = String(o[0].status);
  const { addEvent, addNote } = await import("./workspace");
  if (code === "a" && st === "assigned") {
    await sql`update as_orders set status = 'master_accepted', accepted_at = now(), updated_at = now() where id = ${orderId}`;
    await sql`update as_masters set accepted_orders = accepted_orders + 1, online_status = 'busy', last_seen = now() where id = ${mid}`;
    await addEvent(sql, uid, orderId, "master_accepted", "master", {});
    await tg(token, "sendMessage", {
      chat_id: Number(masterTg),
      text: `Приняли №${o[0].public_no}. Когда выедете — нажмите кнопку.`,
      reply_markup: jobButtons(orderId, "master_accepted"),
    });
    await notifyClientOfMaster(sql, uid, token, orderId, "master_accepted");
  } else if (code === "r" && st === "assigned") {
    await sql`update as_orders set status = 'master_rejected', updated_at = now() where id = ${orderId}`;
    await sql`update as_masters set rejected_orders = rejected_orders + 1, last_seen = now() where id = ${mid}`;
    await addEvent(sql, uid, orderId, "master_rejected", "master", { masterId: mid });
    await addNote(sql, uid, "admin", `Мастер отказался от заявки №${o[0].public_no}`, "Назначьте другого", orderId, null);
    await tg(token, "sendMessage", { chat_id: Number(masterTg), text: "Отказ принят. Ждите следующую заявку.", reply_markup: markup(masterMenu("ru", true)) });
    await notifyClientOfMaster(sql, uid, token, orderId, "master_rejected");
  } else if (code === "e" && st === "master_accepted") {
    await sql`update as_orders set status = 'enroute', updated_at = now() where id = ${orderId}`;
    await addEvent(sql, uid, orderId, "enroute", "master", {});
    await tg(token, "sendMessage", { chat_id: Number(masterTg), text: "Клиент видит, что вы выехали.", reply_markup: jobButtons(orderId, "enroute") });
    await notifyClientOfMaster(sql, uid, token, orderId, "enroute");
  } else if (code === "h" && st === "enroute") {
    await sql`update as_orders set status = 'arrived', arrived_at = now(), updated_at = now() where id = ${orderId}`;
    await addEvent(sql, uid, orderId, "arrived", "master", {});
    await tg(token, "sendMessage", { chat_id: Number(masterTg), text: "На месте. После работы — «Завершить».", reply_markup: jobButtons(orderId, "arrived") });
    await notifyClientOfMaster(sql, uid, token, orderId, "arrived");
  } else if (code === "d" && (st === "arrived" || st === "in_progress")) {
    await sql`update as_orders set status = 'completed', completed_at = now(), updated_at = now() where id = ${orderId}`;
    await sql`update as_masters set completed_orders = completed_orders + 1, earnings = earnings + ${nSafe(o[0].master_payout)}, online_status = 'online', last_seen = now() where id = ${mid}`;
    await addEvent(sql, uid, orderId, "completed", "master", {});
    await tg(token, "sendMessage", { chat_id: Number(masterTg), text: `Заявка №${o[0].public_no} завершена. Клиенту ушла оценка.`, reply_markup: markup(masterMenu("ru", true)) });
    await notifyClientOfMaster(sql, uid, token, orderId, "completed");
  } else {
    await tg(token, "sendMessage", { chat_id: Number(masterTg), text: "Эта кнопка уже не действует — статус заявки изменился." });
  }
}

async function saveStars(sql: Sql, uid: string, token: string, chatId: string, data: string) {
  const parts = data.split(":");
  const stars = Number(parts[1]);
  const orderId = Number(parts[2]);
  if (!stars || stars < 1 || stars > 5) return;
  const o = await sql<{ id: number; client_id: number; master_id: number | null; public_no: number }>`
    select id, client_id, master_id, public_no from as_orders where user_id = ${uid} and id = ${orderId}
  `;
  if (!o[0]?.master_id) return;
  await sql`
    insert into as_reviews (user_id, order_id, client_id, master_id, rating, comment)
    values (${uid}, ${orderId}, ${o[0].client_id}, ${o[0].master_id}, ${stars}, ${""})
  `;
  await sql`
    update as_masters set rating = (
      select round(avg(rating)::numeric, 2) from as_reviews where master_id = ${o[0].master_id}
    ) where id = ${o[0].master_id}
  `;
  await tg(token, "sendMessage", {
    chat_id: Number(chatId),
    text: `Спасибо, ${stars} ★. Можете написать отзыв текстом или нажать меню.`,
    reply_markup: markup(clientMenu("ru")),
  });
}

async function handleMasterMenu(sql: Sql, uid: string, token: string, chatId: string, tapId: string, loc?: { lat: number; lng: number }) {
  const m = await sql<{
    id: number; first_name: string; last_name: string; phone: string; rating: number;
    earnings: number; completed_orders: number; online_status: string; district: string;
  }>`
    select id, first_name, last_name, phone, rating, earnings, completed_orders, online_status, district
    from as_masters where user_id = ${uid} and telegram_id = ${chatId} limit 1
  `;
  if (!m[0]) return false;
  const online = m[0].online_status === "online" || m[0].online_status === "busy";
  if (tapId === "cmd:loc" && !loc) {
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: "Отправьте геолокацию кнопкой.",
      reply_markup: markup([[{ id: "geo:share", label: "📍 Отправить геолокацию", requestLocation: true }]]),
    });
    return true;
  }
  if (loc) {
    await sql`update as_masters set lat = ${loc.lat}, lng = ${loc.lng}, last_seen = now() where id = ${m[0].id}`;
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: "Локация обновлена. Вы на карте админки.",
      reply_markup: markup(masterMenu("ru", online)),
    });
    return true;
  }
  if (tapId === "online:on" || tapId === "online:off") {
    const on = tapId === "online:on";
    await sql`update as_masters set online_status = ${on ? "online" : "offline"}, last_seen = now() where id = ${m[0].id} and online_status <> 'blocked'`;
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: on ? "Вы на линии." : "Офлайн. Новые заказы не в приоритете.",
      reply_markup: markup(masterMenu("ru", on)),
    });
    return true;
  }
  if (tapId === "cmd:stats" || tapId === "cmd:profile") {
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: `${m[0].first_name} ${m[0].last_name}\nТел: ${m[0].phone}\nРайон: ${m[0].district || "—"}\nРейтинг: ${Number(m[0].rating).toFixed(2)}\nЗавершено: ${m[0].completed_orders}\nБаланс: ${Number(m[0].earnings).toLocaleString("ru-RU")} сум\nСтатус: ${m[0].online_status}`,
      reply_markup: markup(masterMenu("ru", online)),
    });
    return true;
  }
  if (tapId === "cmd:help") {
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: "Меню мастера:\n⚡ Заказы — назначенные вам\n🟢 На линии / офлайн\n📍 Локация — точка на карте\n📦 Активные — в работе\n👤 Профиль / 📊 статистика\n👥 Друзья — ваша ссылка\n❌ Отмена — сброс",
      reply_markup: markup(masterMenu("ru", online)),
    });
    return true;
  }
  if (tapId === "cmd:jobs" || tapId === "cmd:active") {
    const jobs = await sql<{ id: number; public_no: number; status: string; district: string; description: string }>`
      select id, public_no, status, district, description from as_orders
      where user_id = ${uid} and master_id = ${m[0].id}
        and status in ('assigned','master_accepted','enroute','arrived','in_progress')
      order by created_at desc limit 10
    `;
    if (!jobs.length) {
      await tg(token, "sendMessage", {
        chat_id: Number(chatId),
        text: "Нет активных заявок. Админ назначит вручную.",
        reply_markup: markup(masterMenu("ru", online)),
      });
      return true;
    }
    for (const j of jobs) {
      await tg(token, "sendMessage", {
        chat_id: Number(chatId),
        text: `№${j.public_no} · ${j.district}\n${j.description}\nСтатус: ${j.status}`,
        reply_markup: jobButtons(j.id, j.status),
      });
    }
    return true;
  }
  return false;
}

async function setBotCommands(token: string) {
  await tg(token, "setMyCommands", {
    commands: [
      { command: "start", description: "Меню / til / роль" },
      { command: "lang", description: "Русский / O‘zbekcha" },
      { command: "ref", description: "Реферальная ссылка" },
      { command: "cancel", description: "Отмена заявки" },
      { command: "help", description: "Помощь" },
    ],
  });
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
          allowed_updates: TG_UPDATES,
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
    const ws = await sql<{ bot_token: string | null; webhook_id: string | null; bot_secret: string | null; poll_mode: boolean; public_origin: string | null }>`
      select bot_token, webhook_id, bot_secret, poll_mode, public_origin from as_workspace where user_id = ${userId}
    `;
    const w = ws[0];
    const https = Boolean(w?.public_origin?.startsWith("https://"));
    const shouldPoll = Boolean(w?.poll_mode) || !https;
    if (shouldPoll && w?.bot_token && w.webhook_id && w.bot_secret) {
      startPoller(w.bot_token, w.webhook_id, w.bot_secret);
    }
    const extras = await sql<{ bot_token: string | null; webhook_id: string | null; bot_secret: string | null }>`
      select bot_token, webhook_id, bot_secret from as_bots
      where user_id = ${userId} and bot_token is not null and webhook_id is not null
    `;
    if (shouldPoll) {
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
  try { await setBotCommands(token); } catch { /* ignore */ }
  const webhookId = crypto.randomUUID();
  const secret = secretFrom(token);
  const https = origin.startsWith("https://");
  if (https) {
    const hookUrl = `${origin}/api/telegram/${webhookId}`;
    const set = await tg(token, "setWebhook", {
      url: hookUrl,
      secret_token: secret,
      allowed_updates: TG_UPDATES,
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
  try { await setBotCommands(token); } catch { /* ignore */ }
  const webhookId = crypto.randomUUID();
  const secret = secretFrom(token);
  const https = origin.startsWith("https://");
  if (https) {
    const hookUrl = `${origin}/api/telegram/${webhookId}`;
    const set = await tg(token, "setWebhook", {
      url: hookUrl,
      secret_token: secret,
      allowed_updates: TG_UPDATES,
      drop_pending_updates: false,
    });
    if (!set.ok) {
      return { ok: false as const, error: set.description ?? "Не удалось поставить webhook. Нужен https.", username: null, mode: null };
    }
    stopPoller(token);
  } else {
    const main = await sql<{ bot_token: string | null }>`select bot_token from as_workspace where user_id = ${userId}`;
    if (main[0]?.bot_token !== token) startPoller(token, webhookId, secret);
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
    try {
      const chRow = await sql<{ alerts_channel_id: string | null }>`select alerts_channel_id from as_workspace where user_id = ${userId}`;
      const ch = chRow[0]?.alerts_channel_id;
      if (ch) await sendWorkspaceAlertTest(sql, userId, ch);
    } catch { /* ignore */ }
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

function chatTarget(raw: string): string | number {
  return normalizeChatId(raw);
}

/** All plausible Telegram chat ids for a pasted value (t.me/c/XXXX, −100…, @name). */
export function chatIdVariants(raw: string): string[] {
  const out: string[] = [];
  const add = (x: string) => {
    const v = x.trim();
    if (v && !out.includes(v)) out.push(v);
  };
  const s = (raw ?? "").trim().replace(/[\u2212\u2010\u2011\u2012\u2013\u2014\uFE58\uFE63\uFF0D]/g, "-");
  const cPath = s.match(/t\.me\/c\/(\d{6,16})/i);
  if (cPath) add(`-100${cPath[1]}`);
  const uname = s.match(/(?:https?:\/\/)?(?:t\.me\/|@)([A-Za-z][A-Za-z0-9_]{3,32})/);
  if (uname && uname[1].toLowerCase() !== "c") add(`@${uname[1]}`);
  const compact = s.replace(/[\u00A0\u202F\s]/g, "").replace(/[«»“”"'`]/g, "");
  const m100 = compact.match(/-?100\d{8,14}/);
  if (m100) add(m100[0].startsWith("-") ? m100[0] : `-${m100[0]}`);
  const mNeg = compact.match(/-\d{8,14}/);
  if (mNeg) add(mNeg[0]);
  if (compact.startsWith("@") && compact.length > 2) add(compact);
  if (/^[A-Za-z][A-Za-z0-9_]{3,32}$/.test(s.trim())) add(`@${s.trim()}`);
  const digits = compact.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 16) {
    if (digits.startsWith("100")) add(`-${digits}`);
    else {
      add(`-100${digits}`);
      add(`-${digits}`);
    }
  }
  return out.length ? out : (s.trim() ? [s.trim()] : []);
}

export function normalizeChatId(raw: string): string {
  return chatIdVariants(raw)[0] ?? (raw ?? "").trim();
}

function isChannelish(raw: string): boolean {
  return chatIdVariants(raw).some((s) => s.startsWith("-100") || s.startsWith("@") || s.startsWith("-"));
}

function explainAlertError(desc: string): string {
  const d = desc || "Telegram отклонил сообщение";
  const low = d.toLowerCase();
  if (low.includes("chat not found")) {
    return `${d}. У бота нет такого чата: в поле не ID канала, или в админы добавлен другой бот.`;
  }
  if (low.includes("not a member") || low.includes("kicked") || low.includes("bot is not a member")) {
    return `${d}. Бот не состоит в канале. Добавьте его администратором.`;
  }
  if (low.includes("not enough rights") || low.includes("write_forbidden") || low.includes("can't send") || low.includes("need administrator") || low.includes("have no rights")) {
    return `${d}. У бота нет права писать. Канал → администраторы → бот → «Публикация сообщений».`;
  }
  if (low.includes("unauthorized")) return `${d}. Токен неверный — вставьте токен заново из @BotFather.`;
  if (low.includes("blocked")) return `${d}. Бот заблокирован.`;
  return d;
}

async function botLabel(token: string) {
  const me = await tg(token, "getMe", {});
  if (me.ok && me.result && !Array.isArray(me.result)) {
    const u = String((me.result as { username?: string }).username ?? "");
    if (u) return `@${u}`;
  }
  return "бот";
}

async function collectAlertRoutes(sql: Sql, userId: string) {
  const tokenList: string[] = [];
  const seen = new Set<string>();
  const channelTargets = new Set<string>();
  const dmTargets = new Set<string>();
  let subscribeRaw = "";
  function addToken(t: string | null | undefined, first = false) {
    const token = (t ?? "").trim();
    if (!token || seen.has(token)) return;
    seen.add(token);
    if (first) tokenList.unshift(token);
    else tokenList.push(token);
  }
  try {
    const bots = await sql<{ bot_token: string | null; log_chat_id: string | null; kind: string }>`
      select bot_token, log_chat_id, kind from as_bots
      where user_id = ${userId} and bot_token is not null
    `;
    for (const b of bots) {
      addToken(b.bot_token, b.kind === "logs");
      if (b.log_chat_id) {
        const variants = chatIdVariants(b.log_chat_id);
        for (const id of variants) {
          if (id.startsWith("-") || id.startsWith("@")) channelTargets.add(id);
          else dmTargets.add(id);
        }
      }
    }
  } catch { /* ignore */ }
  try {
    const ws = await sql<{ alerts_channel_id: string | null; bot_token: string | null; channel_username: string | null }>`
      select alerts_channel_id, bot_token, channel_username from as_workspace where user_id = ${userId}
    `;
    addToken(ws[0]?.bot_token);
    subscribeRaw = (ws[0]?.channel_username ?? "").trim();
    if (ws[0]?.alerts_channel_id) {
      for (const id of chatIdVariants(ws[0].alerts_channel_id)) {
        if (id.startsWith("-") || id.startsWith("@")) channelTargets.add(id);
        else dmTargets.add(id);
      }
    }
  } catch { /* ignore */ }
  if (subscribeRaw) {
    const subKeys = channelKeys(subscribeRaw);
    for (const token of tokenList) {
      for (const ref of chatIdVariants(subscribeRaw)) {
        const looked = await tg(token, "getChat", { chat_id: ref });
        if (looked.ok && looked.result && !Array.isArray(looked.result)) {
          const r = looked.result as { id?: number; username?: string };
          if (r.id != null) subKeys.add(String(r.id));
          if (r.username) subKeys.add(`@${String(r.username).toLowerCase()}`);
        }
      }
      if ([...subKeys].some((k) => k.startsWith("-"))) break;
    }
    const hit = (id: string) => {
      for (const k of channelKeys(id)) if (subKeys.has(k)) return true;
      return false;
    };
    for (const id of [...channelTargets]) if (hit(id)) channelTargets.delete(id);
    for (const id of [...dmTargets]) if (hit(id)) dmTargets.delete(id);
  }
  const hasNumeric = [...channelTargets].some((id) => id.startsWith("-"));
  if (hasNumeric) {
    for (const id of [...channelTargets]) {
      if (id.startsWith("@")) channelTargets.delete(id);
    }
  }
  return { tokens: tokenList, channelTargets, dmTargets, subscribeRaw };
}

async function sendToAlerts(token: string, chat: string, text: string, extra: Record<string, unknown> = {}): Promise<{ ok: boolean; description?: string; used?: string }> {
  const variants = chatIdVariants(chat);
  let last: { ok: boolean; description?: string; used?: string } = { ok: false, description: "не отправлено" };
  const payload = { text: text.slice(0, 3900), ...extra };
  const plain = extra.parse_mode ? { text: text.replace(/<[^>]+>/g, "").slice(0, 3900) } : null;
  for (const id of variants) {
    const r = await tg(token, "sendMessage", { chat_id: id, ...payload });
    if (r.ok) return { ok: true, used: id };
    if (plain) {
      const rp = await tg(token, "sendMessage", { chat_id: id, ...plain });
      if (rp.ok) return { ok: true, used: id };
    }
    last = { ok: false, description: r.description, used: id };
    const looked = await tg(token, "getChat", { chat_id: id });
    if (looked.ok && looked.result && !Array.isArray(looked.result)) {
      const resolved = String((looked.result as { id?: number }).id ?? id);
      const r2 = await tg(token, "sendMessage", { chat_id: resolved, ...payload });
      if (r2.ok) return { ok: true, used: resolved };
      if (plain) {
        const r2p = await tg(token, "sendMessage", { chat_id: resolved, ...plain });
        if (r2p.ok) return { ok: true, used: resolved };
      }
      last = { ok: false, description: r2.description ?? looked.description, used: resolved };
    }
  }
  return last;
}

async function bindAlertChannel(sql: Sql, uid: string, chatId: string, token: string, title?: string) {
  try {
    const sub = await sql<{ channel_username: string | null }>`select channel_username from as_workspace where user_id = ${uid}`;
    const raw = (sub[0]?.channel_username ?? "").trim();
    if (raw && (channelOverlap(raw, chatId) || (title ? channelOverlap(raw, title) : false))) {
      return { ok: true as const, used: chatId, skipped: true as const };
    }
  } catch { /* ignore */ }
  const id = String(chatId);
  try {
    await sql`update as_workspace set alerts_channel_id = ${id}, last_alert_error = ${null} where user_id = ${uid}`;
  } catch {
    try { await sql`update as_workspace set alerts_channel_id = ${id} where user_id = ${uid}`; } catch { /* ignore */ }
  }
  try {
    await sql`update as_bots set log_chat_id = ${id} where user_id = ${uid} and kind = ${"logs"}`;
  } catch { /* ignore */ }
  const body = `All Servis: алерты подключены${title ? ` к «${title}»` : ""}. Сюда пойдут заявки, оплаты, назначения.`;
  const r = await sendToAlerts(token, id, body);
  if (!r.ok) {
    const hint = explainAlertError(r.description ?? "");
    try { await sql`update as_workspace set last_alert_error = ${hint} where user_id = ${uid}`; } catch { /* ignore */ }
  } else if (r.used && r.used !== id) {
    try { await sql`update as_workspace set alerts_channel_id = ${r.used} where user_id = ${uid}`; } catch { /* ignore */ }
  }
  return r;
}

export async function pushWorkspaceLog(
  sql: Sql,
  userId: string,
  text: string,
  opts?: { parseMode?: "HTML"; lat?: number | null; lng?: number | null },
) {
  const { tokens, channelTargets, dmTargets } = await collectAlertRoutes(sql, userId);
  if (!tokens.length) {
    try {
      await sql`update as_workspace set last_alert_error = ${"Нет токена бота. Настройки → подключите основной бот."} where user_id = ${userId}`;
    } catch { /* ignore */ }
    return;
  }
  const channelList = [...channelTargets];
  const dmList = [...dmTargets];
  if (!channelList.length && !dmList.length) {
    try {
      await sql`update as_workspace set last_alert_error = ${"Нет ID канала. Настройки: вставьте −100… ИЛИ перешлите боту пост из канала ИЛИ добавьте основного бота админом канала."} where user_id = ${userId}`;
    } catch { /* ignore */ }
    return;
  }
  const extra = opts?.parseMode ? { parse_mode: opts.parseMode } : {};
  const geo = opts?.lat != null && opts?.lng != null && Number.isFinite(opts.lat) && Number.isFinite(opts.lng)
    ? { lat: opts.lat, lng: opts.lng }
    : null;

  async function fanout(chats: string[]): Promise<{ ok: boolean; lastErr: string }> {
    let ok = false;
    let lastErr = "не отправлено";
    for (const chat of chats) {
      for (const token of tokens) {
        try {
          const r = await sendToAlerts(token, chat, text, extra);
          if (r.ok) {
            ok = true;
            if (geo) {
              await tg(token, "sendLocation", { chat_id: r.used ?? chat, latitude: geo.lat, longitude: geo.lng });
            }
            return { ok: true, lastErr };
          }
          lastErr = r.description ?? lastErr;
        } catch (e) {
          lastErr = e instanceof Error ? e.message : lastErr;
        }
      }
    }
    return { ok, lastErr };
  }

  let lastErr = "не отправлено";
  const channel = await fanout(channelList);
  if (channel.ok) {
    try { await sql`update as_workspace set last_alert_error = ${null} where user_id = ${userId}`; } catch { /* ignore */ }
    return;
  }
  lastErr = channel.lastErr;
  const dm = await fanout(dmList);
  if (dm.ok) lastErr = dm.lastErr;
  const hint = channelList.length
    ? explainAlertError(lastErr)
    : (dm.ok
      ? "Алерт ушёл в личку бота, не в канал. Перешлите боту пост из канала или вставьте ID −100… и сделайте бота админом канала."
      : explainAlertError(dm.lastErr || lastErr));
  try { await sql`update as_workspace set last_alert_error = ${hint} where user_id = ${userId}`; } catch { /* ignore */ }
}

export async function pushOrderChannelAlert(sql: Sql, userId: string, orderId: number, eventType: string, who?: StaffWho) {
  const o = await loadOrderCard(sql, userId, orderId);
  if (!o) return;
  const lat = o.lat == null ? null : Number(o.lat);
  const lng = o.lng == null ? null : Number(o.lng);
  const withGeo = eventType === "created" || eventType === "assigned";
  await pushWorkspaceLog(sql, userId, formatOrderCard(o, eventType, "channel", who), {
    parseMode: "HTML",
    lat: withGeo ? lat : null,
    lng: withGeo ? lng : null,
  });
}

const ACTION_RU: Record<string, string> = {
  invite_staff: "Добавил сотрудника в команду",
  block_staff: "Заблокировал сотрудника",
  unblock_staff: "Разблокировал сотрудника",
  delete_staff: "Удалил сотрудника",
  block_client: "Заблокировал клиента",
  unblock_client: "Разблокировал клиента",
  delete_client: "Удалил клиента",
  block_master: "Заблокировал мастера",
  unblock_master: "Разблокировал мастера",
  delete_master: "Удалил мастера",
  connect_bot: "Подключил бота",
  remove_bot: "Отключил бота",
  save_requisites: "Изменил настройки / реквизиты / канал",
  approve_pay: "Подтвердил оплату",
  reject_pay: "Отклонил оплату",
  add_pay: "Добавил пополнение счёта",
  revoke_pay: "Отменил пополнение счёта",
  set_perms: "Изменил права сотрудника",
  cancelled: "Отменил заявку",
};

export async function pushStaffActionAlert(
  sql: Sql,
  userId: string,
  payload: {
    action: string; objectType: string; objectId: string;
    oldValue: string | null; newValue: string | null; who: StaffWho;
  },
) {
  const when = new Date().toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" });
  const title = ACTION_RU[payload.action] || payload.action;
  const roleRu = payload.who.role === "owner" ? "владелец" : "сотрудник";
  const text = [
    `<b>🛡 ${escHtml(title)}</b>`,
    `👤 <b>${escHtml(payload.who.name || "—")}</b> · ${roleRu}`,
    payload.who.email ? `✉️ <code>${escHtml(payload.who.email)}</code>` : "",
    `🕐 ${escHtml(when)}`,
    payload.objectType ? `Объект: ${escHtml(payload.objectType)} #${escHtml(payload.objectId)}` : "",
    payload.oldValue ? `Было: ${escHtml(payload.oldValue)}` : "",
    payload.newValue ? `Стало: ${escHtml(payload.newValue)}` : "",
  ].filter(Boolean).join("\n");
  await pushWorkspaceLog(sql, userId, text, { parseMode: "HTML" });
}

export async function sendWorkspaceAlertTest(sql: Sql, userId: string, chatOverride?: string) {
  await resumeBots(sql, userId);
  let subRaw = "";
  try {
    const row = await sql<{ channel_username: string | null }>`select channel_username from as_workspace where user_id = ${userId}`;
    subRaw = (row[0]?.channel_username ?? "").trim();
  } catch { /* ignore */ }
  if (chatOverride?.trim() && subRaw && channelOverlap(subRaw, chatOverride)) {
    return { ok: false as const, error: "Это канал подписки клиентов. Алерты туда не идут. Укажите ДРУГОЙ канал для отчётов (закрытый −100…), а @username оставьте в блоке «Обязательная подписка»." };
  }
  if (chatOverride?.trim()) {
    for (const id of chatIdVariants(chatOverride)) {
      if (id.startsWith("-") || id.startsWith("@")) {
        try { await sql`update as_workspace set alerts_channel_id = ${id} where user_id = ${userId}`; } catch { /* ignore */ }
        break;
      }
    }
    try {
      const first = chatIdVariants(chatOverride)[0];
      if (first) await sql`update as_bots set log_chat_id = ${first} where user_id = ${userId} and kind = ${"logs"}`;
    } catch { /* ignore */ }
  }
  const { tokens, channelTargets } = await collectAlertRoutes(sql, userId);
  if (chatOverride?.trim()) {
    for (const id of chatIdVariants(chatOverride)) {
      if ((id.startsWith("-") || id.startsWith("@")) && !(subRaw && channelOverlap(subRaw, id))) channelTargets.add(id);
    }
  }
  if (!tokens.length) return { ok: false as const, error: "Нет токена: подключите основной бот и добавьте ИМЕННО ЕГО админом канала." };
  const channels = [...channelTargets];
  if (!channels.length) {
    const hint = "Нет канала алертов. Не используйте публичный канал подписки. Вставьте ID закрытого канала −100… в «Алерты» ИЛИ перешлите боту пост из канала отчётов.";
    try { await sql`update as_workspace set last_alert_error = ${hint} where user_id = ${userId}`; } catch { /* ignore */ }
    return { ok: false as const, error: hint };
  }
  const text = "All Servis: тест алерта. Если видите это в КАНАЛЕ — подключение работает.";
  const attempts: string[] = [];
  let lastErr = "Telegram отклонил сообщение";
  for (const token of tokens) {
    const who = await botLabel(token);
    for (const chat of channels) {
      const r = await sendToAlerts(token, chat, text);
      attempts.push(`${who} → ${r.used ?? chat}: ${r.ok ? "ok" : (r.description ?? "fail")}`);
      if (r.ok) {
        const saved = r.used ?? chat;
        try { await sql`update as_workspace set last_alert_error = ${null}, alerts_channel_id = ${saved} where user_id = ${userId}`; } catch { /* ignore */ }
        return { ok: true as const, error: null as string | null };
      }
      lastErr = r.description ?? lastErr;
    }
  }
  const hint = [
    explainAlertError(lastErr),
    `Пробовали: ${attempts.join("; ")}`,
    "Сделайте так: 1) в списке админов канала должен быть тот же @бот, что в Настройках (основной). 2) Снимите бота с админов и добавьте снова. 3) Напишите любой пост в канал. 4) Или перешлите пост из канала этому боту. Не вставляйте свой личный id.",
  ].join(" ");
  try { await sql`update as_workspace set last_alert_error = ${hint} where user_id = ${userId}`; } catch { /* ignore */ }
  return { ok: false as const, error: hint };
}

export async function sendAlertTest(token: string, chat: string) {
  const json = await sendToAlerts(token, chat, "All Servis: тест алерта. Если видите это — канал подключён.");
  return { ok: json.ok, error: json.ok ? null : explainAlertError(json.description ?? "Telegram отклонил сообщение") };
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

function parseSubChannel(raw: string): { username: string; chatIds: string[]; url: string } {
  const out = { username: "", chatIds: [] as string[], url: "" };
  let s = (raw ?? "").trim();
  if (!s) return out;
  s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  s = s.replace(/^(?:t\.me|telegram\.me)\//i, "").replace(/^@/, "");
  s = s.split(/[?#]/)[0].replace(/\/$/, "");
  if (s.startsWith("c/")) {
    const id = s.slice(2).split("/")[0] ?? "";
    if (/^\d+$/.test(id)) {
      out.chatIds.push(`-100${id}`);
      out.url = `https://t.me/c/${id}`;
    }
    return out;
  }
  if (/^-?100?\d{8,14}$/.test(s.replace(/\s/g, ""))) {
    out.chatIds.push(...chatIdVariants(s));
    return out;
  }
  if (s.startsWith("+") || s.toLowerCase().startsWith("joinchat/")) {
    out.url = `https://t.me/${s}`;
    return out;
  }
  const user = (s.split("/")[0] ?? "").replace(/[^A-Za-z0-9_]/g, "");
  if (user.length >= 4 && /[A-Za-z]/.test(user)) {
    out.username = user;
    out.chatIds.push(`@${user}`);
    out.url = `https://t.me/${user}`;
  }
  return out;
}

function channelKeys(raw: string): Set<string> {
  const keys = new Set<string>();
  const add = (x: string) => {
    const v = x.trim().toLowerCase();
    if (v) keys.add(v);
  };
  for (const v of chatIdVariants(raw)) add(v);
  const p = parseSubChannel(raw);
  if (p.username) add(`@${p.username}`);
  for (const id of p.chatIds) add(id);
  return keys;
}

export function channelOverlap(a: string, b: string): boolean {
  if (!(a ?? "").trim() || !(b ?? "").trim()) return false;
  const A = channelKeys(a);
  for (const k of channelKeys(b)) if (A.has(k)) return true;
  return false;
}

async function isChannelMember(token: string, chatRef: string, userId: number): Promise<boolean> {
  const refs = chatIdVariants(chatRef);
  if (!refs.includes(chatRef)) refs.unshift(chatRef);
  for (const id of refs) {
    const member = await tg(token, "getChatMember", { chat_id: id, user_id: userId });
    if (!member.ok || !member.result || Array.isArray(member.result)) continue;
    const st = String((member.result as { status?: string }).status ?? "");
    if (st === "member" || st === "administrator" || st === "creator" || st === "restricted") return true;
    if (st === "left" || st === "kicked") return false;
  }
  return false;
}

async function subscribeUrl(token: string, parsed: { username: string; chatIds: string[]; url: string }): Promise<string> {
  if (parsed.url.startsWith("https://t.me/") && !parsed.url.includes("/c/")) return parsed.url;
  for (const id of parsed.chatIds) {
    const inv = await tg(token, "exportChatInviteLink", { chat_id: id });
    if (inv.ok && typeof inv.result === "string" && inv.result.startsWith("http")) return inv.result;
    const created = await tg(token, "createChatInviteLink", { chat_id: id, name: "All Servis" });
    if (created.ok && created.result && !Array.isArray(created.result)) {
      const link = String((created.result as { invite_link?: string }).invite_link ?? "");
      if (link.startsWith("http")) return link;
    }
  }
  return parsed.url;
}

async function clientMustSubscribe(
  sql: Sql,
  uid: string,
  token: string,
  fromId: number,
): Promise<{ block: boolean; url: string; label: string }> {
  let channel = "";
  let requireSub = true;
  try {
    const row = await sql<{ channel_username: string | null; require_subscribe?: boolean }>`
      select channel_username, require_subscribe from as_workspace where user_id = ${uid}
    `;
    channel = (row[0]?.channel_username ?? "").trim();
    requireSub = row[0]?.require_subscribe !== false;
  } catch {
    try {
      const row = await sql<{ channel_username: string | null }>`
        select channel_username from as_workspace where user_id = ${uid}
      `;
      channel = (row[0]?.channel_username ?? "").trim();
    } catch {
      return { block: false, url: "", label: "" };
    }
  }
  if (!requireSub || !channel) return { block: false, url: "", label: "" };
  const parsed = parseSubChannel(channel);
  if (!parsed.chatIds.length && !parsed.url) return { block: false, url: "", label: "" };
  for (const id of parsed.chatIds) {
    if (await isChannelMember(token, id, fromId)) return { block: false, url: "", label: "" };
  }
  const url = await subscribeUrl(token, parsed);
  const label = parsed.username ? `@${parsed.username}` : "канал";
  return { block: true, url: url || `https://t.me/${parsed.username}`, label };
}

async function sendSubscribePrompt(token: string, chatId: string, cbId: string | undefined, url: string, label: string, fromStart = false) {
  if (cbId && !fromStart) {
    await tg(token, "answerCallbackQuery", { callback_query_id: cbId, text: "Сначала подпишитесь на канал", show_alert: true });
  } else if (cbId) {
    await tg(token, "answerCallbackQuery", { callback_query_id: cbId });
  }
  const buttons: { text: string; url?: string; callback_data?: string }[][] = [];
  if (url) buttons.push([{ text: `📢 Открыть ${label}`, url }]);
  buttons.push([{ text: "✅ Я подписался", callback_data: "sub:ok" }]);
  await tg(token, "sendMessage", {
    chat_id: Number(chatId),
    text: [
      "All Servis — вызов мастера на дом в Ташкенте.",
      "",
      `Чтобы начать, подпишитесь на ${label}.`,
      `Boshlash uchun ${label} kanaliga obuna bo‘ling.`,
      "",
      "1) Нажмите «Открыть» и подпишитесь",
      "2) Вернитесь в бота и нажмите «Я подписался»",
    ].join("\n"),
    reply_markup: { inline_keyboard: buttons },
    disable_web_page_preview: true,
  });
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
  const masterRow = await sql<{ id: number }>`
    select id from as_masters where user_id = ${uid} and telegram_id = ${chatId} limit 1
  `;
  if (!masterRow[0]) {
    const sub = await clientMustSubscribe(sql, uid, token, from.id);
    if (sub.block) {
      const fromStart = Boolean(msg?.text?.startsWith("/start") || cb?.data === "sub:ok");
      await sendSubscribePrompt(token, chatId, cb?.id, sub.url, sub.label, fromStart);
      return true;
    }
  }

  let settings: { pay_card: string | null; pay_bank: string | null; pay_holder: string | null; pay_amount: number } | undefined;
  try {
    settings = (await sql<{
      pay_card: string | null; pay_bank: string | null; pay_holder: string | null; pay_amount: number;
    }>`
      select pay_card, pay_bank, pay_holder, pay_amount from as_workspace where user_id = ${uid}
    `)[0];
  } catch {
    return false;
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
      await pushWorkspaceLog(
        sql,
        uid,
        [
          "<b>💳 Скрин оплаты</b>",
          `👤 Клиент: <b>${escHtml(name)}</b>`,
          `📱 Telegram: <code>${escHtml(chatId)}</code>`,
          `💰 Сумма: ${amount.toLocaleString("ru-RU")} сум`,
          "Откройте админку → Пополнения.",
        ].join("\n"),
        { parseMode: "HTML" },
      );
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

async function ensureRefCode(sql: Sql, uid: string, chatId: string): Promise<string> {
  try {
    const row = await sql<{ id: number; ref_code: string | null }>`
      select id, ref_code from as_clients where user_id = ${uid} and telegram_id = ${chatId} limit 1
    `;
    if (!row[0]) return "";
    if (row[0].ref_code) return row[0].ref_code;
    for (let i = 0; i < 6; i++) {
      const code = `r_${Math.random().toString(36).slice(2, 8)}`;
      const clash = await sql<{ id: number }>`select id from as_clients where user_id = ${uid} and ref_code = ${code} limit 1`;
      if (clash[0]) continue;
      await sql`update as_clients set ref_code = ${code} where id = ${row[0].id} and ref_code is null`;
      return code;
    }
  } catch { /* col may miss */ }
  return "";
}

async function applyStartPayload(sql: Sql, uid: string, chatId: string, payload: string) {
  const p = payload.trim();
  if (!p) return;
  try {
    if (p.startsWith("r")) {
      const inv = await sql<{ telegram_id: string | null }>`
        select telegram_id from as_clients where user_id = ${uid} and ref_code = ${p} limit 1
      `;
      if (inv[0]?.telegram_id && inv[0].telegram_id !== chatId) {
        await sql`
          update as_clients set referred_by = coalesce(nullif(referred_by, ''), ${p}),
            ref_source = coalesce(nullif(ref_source, ''), ${"user"})
          where user_id = ${uid} and telegram_id = ${chatId}
            and (referred_by is null or referred_by = '')
        `;
      }
    } else if (p.startsWith("c")) {
      await sql`update as_ref_links set clicks = clicks + 1 where user_id = ${uid} and code = ${p}`;
      const src = await sql<{ source: string }>`select source from as_ref_links where user_id = ${uid} and code = ${p} limit 1`;
      if (src[0]) {
        const joined = await sql<{ id: number }>`
          update as_clients
          set referred_by = ${p},
              ref_source = coalesce(nullif(ref_source, ''), ${src[0].source})
          where user_id = ${uid} and telegram_id = ${chatId}
            and (referred_by is null or referred_by = '')
          returning id
        `;
        if (joined[0]) {
          await sql`update as_ref_links set joins = joins + 1 where user_id = ${uid} and code = ${p}`;
        }
      }
    }
  } catch { /* ignore */ }
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
    await ensureRefCode(sql, uid, chatId);
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

function kbClient(lang: string | undefined, live: boolean) {
  return live ? liveMenu(lang === "uz" ? "uz" : "ru") : clientMenu(lang === "uz" ? "uz" : "ru");
}

async function pushSupportAlert(sql: Sql, uid: string, name: string, chatId: string, text: string) {
  try {
    await pushWorkspaceLog(
      sql,
      uid,
      [
        "<b>💬 Сообщение клиента</b>",
        `👤 <b>${escHtml(name)}</b>`,
        `📱 Telegram: <code>${escHtml(chatId)}</code>`,
        text ? `💬 ${escHtml(text)}` : "Просит оператора",
      ].filter(Boolean).join("\n"),
      { parseMode: "HTML" },
    );
  } catch { /* ignore */ }
}

async function sendClientOrders(sql: Sql, uid: string, token: string, chatId: string, lang: string, live: boolean) {
  const mine = await sql<{ public_no: number; status: string; district: string; master_name: string | null }>`
    select o.public_no, o.status, o.district,
      nullif(trim(concat_ws(' ', m.first_name, m.last_name)), '') as master_name
    from as_orders o
    join as_clients c on c.id = o.client_id
    left join as_masters m on m.id = o.master_id
    where o.user_id = ${uid} and c.telegram_id = ${chatId}
    order by o.created_at desc limit 8
  `;
  const lines = mine.length
    ? mine.map((x) => {
        const st = STATUS_LABEL[x.status as OrderStatus] ?? x.status;
        const who = x.master_name ? ` · ${x.master_name}` : "";
        return `№${x.public_no} · ${st}\n${x.district || "—"}${who}`;
      }).join("\n\n")
    : (lang === "uz" ? "Ariza yo‘q." : "Заявок пока нет.");
  const head = lang === "uz" ? "📋 Arizalarim" : "📋 Мои заявки";
  await tg(token, "sendMessage", { chat_id: Number(chatId), text: `${head}\n\n${lines}`, reply_markup: markup(kbClient(lang, live)) });
}

async function sendClientRef(sql: Sql, uid: string, token: string, chatId: string, name: string, lang: string, live: boolean) {
  await persistProfile(sql, uid, chatId, name, emptyDraft());
  const code = await ensureRefCode(sql, uid, chatId);
  const botRow = await sql<{ bot_username: string | null }>`select bot_username from as_workspace where user_id = ${uid}`;
  const uname = (botRow[0]?.bot_username ?? "").replace(/^@/, "");
  const link = uname && code ? `https://t.me/${uname}?start=${code}` : (code ? `Код: ${code}` : "");
  const invited = code
    ? await sql<{ n: number }>`select count(*)::int as n from as_clients where user_id = ${uid} and referred_by = ${code}`
    : [{ n: 0 }];
  const text = lang === "uz"
    ? `Sizning shaxsiy havolangiz (faqat sizniki):\n${link || "Avval /start"}\n\nTaklif qilingan: ${invited[0]?.n ?? 0}`
    : `Ваша уникальная ссылка (только для этого аккаунта):\n${link || "Напишите /start ещё раз"}\n\nПриглашено друзей: ${invited[0]?.n ?? 0}\nДруг открывает ссылку — вы в статистике «Рефералы».`;
  await tg(token, "sendMessage", { chat_id: Number(chatId), text, reply_markup: markup(kbClient(lang, live)) });
}

async function sendClientProfile(sql: Sql, uid: string, token: string, chatId: string, lang: string, live: boolean) {
  const c = await sql<{
    name: string; phone: string; district: string; lat: number | null; lng: number | null;
    orders_count: number; completed_count: number; last_master: string | null; last_no: number | null; last_status: string | null;
  }>`
    select cl.name, cl.phone, cl.district, cl.lat, cl.lng,
      (select count(*)::int from as_orders o where o.client_id = cl.id) as orders_count,
      (select count(*)::int from as_orders o where o.client_id = cl.id and o.status = 'completed') as completed_count,
      (select nullif(trim(concat_ws(' ', m.first_name, m.last_name)), '') from as_orders o
        left join as_masters m on m.id = o.master_id
        where o.client_id = cl.id and o.master_id is not null
        order by coalesce(o.completed_at, o.updated_at) desc limit 1) as last_master,
      (select o.public_no from as_orders o where o.client_id = cl.id order by o.created_at desc limit 1) as last_no,
      (select o.status from as_orders o where o.client_id = cl.id order by o.created_at desc limit 1) as last_status
    from as_clients cl
    where cl.user_id = ${uid} and cl.telegram_id = ${chatId}
    limit 1
  `;
  const row = c[0];
  const geo = row?.lat != null && row?.lng != null ? `${Number(row.lat).toFixed(5)}, ${Number(row.lng).toFixed(5)}` : "—";
  const lastSt = row?.last_status ? (STATUS_LABEL[row.last_status as OrderStatus] ?? row.last_status) : "—";
  const text = [
    lang === "uz" ? "👤 Profil" : "👤 Профиль",
    "",
    `${lang === "uz" ? "Ism" : "Имя"}: ${row?.name || "—"}`,
    `${lang === "uz" ? "Tel" : "Телефон"}: ${row?.phone || "—"}`,
    `${lang === "uz" ? "Tuman" : "Район"}: ${row?.district || "—"}`,
    `${lang === "uz" ? "Oxirgi geo" : "Последняя геолокация"}: ${geo}`,
    `${lang === "uz" ? "Arizalar" : "Заявок"}: ${row?.orders_count ?? 0} (${lang === "uz" ? "tugagan" : "завершено"} ${row?.completed_count ?? 0})`,
    row?.last_no ? `${lang === "uz" ? "Oxirgi ariza" : "Последняя заявка"}: №${row.last_no} · ${lastSt}` : "",
    `${lang === "uz" ? "Oxirgi usta" : "Последний мастер"}: ${row?.last_master || "—"}`,
    "",
    lang === "uz" ? "Til: tugma Русский / O‘zbekcha. Usta: «Мастер»." : "Язык — кнопки ниже. Стать мастером: напишите «Мастер».",
  ].filter(Boolean).join("\n");
  await tg(token, "sendMessage", {
    chat_id: Number(chatId),
    text,
    reply_markup: markup(kbClient(lang, live)),
  });
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
    await pushWorkspaceLog(
      sql,
      uid,
      [
        "<b>🛠 Новый мастер в боте</b>",
        `👤 <b>${escHtml(name)}</b>`,
        `🛠 ${escHtml(serviceById(spec)?.title ?? spec)}`,
        phone ? `📞 <code>${escHtml(phone)}</code>` : "",
        dist ? `🏙 ${escHtml(dist)}` : "",
      ].filter(Boolean).join("\n"),
      { parseMode: "HTML" },
    );
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

  if (update.channel_post?.chat) {
    if (kind !== "logs") return { ok: true };
    const ch = update.channel_post.chat;
    const cid = String(ch.id);
    try {
      const cur = await sql<{ alerts_channel_id: string | null }>`select alerts_channel_id from as_workspace where user_id = ${uid}`;
      if (cur[0]?.alerts_channel_id === cid) return { ok: true };
    } catch { /* ignore */ }
    await bindAlertChannel(sql, uid, cid, token, ch.title ?? ch.username);
    return { ok: true };
  }

  if (update.my_chat_member) {
    const ch = update.my_chat_member.chat;
    const st = update.my_chat_member.new_chat_member?.status ?? "";
    if (kind === "logs" && (ch.type === "channel" || ch.type === "supergroup") && (st === "administrator" || st === "creator" || st === "member")) {
      await bindAlertChannel(sql, uid, String(ch.id), token, ch.title ?? ch.username);
    }
    if (kind === "logs") return { ok: true };
  }

  const from = msg?.from ?? cb?.from;
  const chatId = String(msg?.chat.id ?? cb?.message?.chat.id ?? from?.id ?? "");
  if (!chatId || !from) return { ok: true };

  const fwd = msg?.forward_from_chat ?? (msg?.forward_origin?.chat ?? null);
  if (fwd && (fwd.type === "channel" || fwd.type === "supergroup")) {
    if (fwd.username && kind !== "logs") {
      await tg(token, "sendMessage", {
        chat_id: Number(chatId),
        text: `Публичный канал @${fwd.username} — для подписки клиентов, алерты туда не пишем. Перешлите пост из ЗАКРЫТОГО канала отчётов (без @username).`,
      });
      return { ok: true };
    }
    const bound = await bindAlertChannel(sql, uid, String(fwd.id), token, fwd.title ?? fwd.username);
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: "skipped" in bound && bound.skipped
        ? "Это канал подписки клиентов — алерты туда не пишем. Перешлите пост из ДРУГОГО (закрытого) канала для отчётов."
        : `Канал алертов сохранён (${fwd.title ?? fwd.id}). Проверьте канал — туда ушёл тест. Если пусто: сделайте ЭТОГО бота админом с правом «Публикация сообщений».`,
    });
    return { ok: true };
  }

  if (kind === "logs") {
    if (msg?.text === "/start" || msg?.text === "/log") {
      const cur = extra[0] ? await sql<{ log_chat_id: string | null }>`select log_chat_id from as_bots where id = ${extra[0].id}` : [];
      const existing = cur[0]?.log_chat_id ?? "";
      if (!existing || !isChannelish(existing)) {
        await sql`update as_bots set log_chat_id = ${chatId} where id = ${extra[0]!.id}`;
      }
      await tg(token, "sendMessage", {
        chat_id: Number(chatId),
        text: existing && isChannelish(existing)
          ? `Канал уже привязан: ${existing}. Алерты идут туда. Чтобы сменить — перешлите сюда пост из нового канала.`
          : "Это личка логов. Чтобы алерты шли в КАНАЛ:\n1) Добавьте этого бота админом канала (право «Публикация сообщений»)\n2) Перешлите сюда любой пост из канала — ID сохранится сам\n3) Либо вставьте ID -100… в Настройках админки.",
      });
    }
    return { ok: true };
  }

  const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || "Клиент Telegram";

  if (await gated(sql, uid, token, chatId, from, msg, cb)) return { ok: true };

  if (cb?.data?.startsWith("j:")) {
    await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
    await applyJob(sql, uid, token, chatId, cb.data);
    return { ok: true };
  }
  if (cb?.data?.startsWith("rate:")) {
    await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
    await saveStars(sql, uid, token, chatId, cb.data);
    return { ok: true };
  }

  const tapGuess = cb?.data ?? (msg?.text ? labelToTapId(msg.text) : null);
  const masterExists = await sql<{ id: number }>`
    select id from as_masters where user_id = ${uid} and telegram_id = ${chatId} limit 1
  `;
  if (masterExists[0] && (tapGuess === "cmd:jobs" || tapGuess === "cmd:active" || tapGuess === "cmd:stats" || tapGuess === "cmd:loc" || tapGuess === "online:on" || tapGuess === "online:off")) {
    if (cb?.data) await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
    await handleMasterMenu(sql, uid, token, chatId, tapGuess);
    return { ok: true };
  }
  if (masterExists[0] && msg?.location && (tapGuess === "cmd:loc" || !msg.text)) {
    const handled = await handleMasterMenu(sql, uid, token, chatId, "cmd:loc", {
      lat: msg.location.latitude,
      lng: msg.location.longitude,
    });
    if (handled) return { ok: true };
  }

  const sess = await sql<{ step: string; draft: string; live_order_id: number | null; last_status: string | null }>`
    select step, draft, live_order_id, last_status from as_tg_sessions where user_id = ${uid} and chat_id = ${chatId}
  `;
  let step = (sess[0]?.step ?? "lang") as ChatStep;
  let draft: Draft = sess[0]?.draft ? (JSON.parse(sess[0].draft) as Draft) : emptyDraft();
  draft = { ...emptyDraft(), ...draft, name };
  const live = Boolean(sess[0]?.live_order_id) || step === "live";
  const lang = draft.lang === "uz" ? "uz" : "ru";

  if (tapGuess === "cmd:myorders") {
    if (cb?.data) await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
    await sendClientOrders(sql, uid, token, chatId, lang, live);
    return { ok: true };
  }
  if (tapGuess === "cmd:ref") {
    if (cb?.data) await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
    await sendClientRef(sql, uid, token, chatId, name, lang, live);
    return { ok: true };
  }
  if (tapGuess === "cmd:profile") {
    if (cb?.data) await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
    if (masterExists[0] && draft.role === "master") {
      await handleMasterMenu(sql, uid, token, chatId, "cmd:profile");
      return { ok: true };
    }
    await persistProfile(sql, uid, chatId, name, draft);
    await sendClientProfile(sql, uid, token, chatId, lang, live);
    return { ok: true };
  }
  if (tapGuess === "cmd:help") {
    if (cb?.data) await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: lang === "uz"
        ? "🛠 Usta chaqirish — ariza\n📋 Arizalarim — status\n👤 Profil — ma’lumot\n👥 Do‘stlar — havola\n💬 Yordam — dispatcher"
        : "🛠 Вызвать мастера — заявка\n📋 Мои заявки — статус\n👤 Профиль — данные\n👥 Друзья — ваша ссылка\n💬 Поддержка — диспетчер увидит алерт",
      reply_markup: markup(kbClient(lang, live)),
    });
    return { ok: true };
  }
  if (tapGuess === "cmd:support") {
    if (cb?.data) await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
    await pushSupportAlert(sql, uid, name, chatId, "Просит оператора");
    await sql`
      insert into as_tg_sessions (user_id, chat_id, step, draft, live_order_id, last_status, tg_name, updated_at)
      values (${uid}, ${chatId}, ${"support"}, ${JSON.stringify(draft)}, ${sess[0]?.live_order_id ?? null}, ${sess[0]?.last_status ?? null}, ${name}, now())
      on conflict (user_id, chat_id) do update set step = ${"support"}, draft = ${JSON.stringify(draft)}, tg_name = ${name}, updated_at = now()
    `;
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: lang === "uz"
        ? "Savolingizni bitta xabarda yozing — dispatcher ko‘radi."
        : "Напишите вопрос одним сообщением — диспетчер увидит в алертах.",
      reply_markup: markup(kbClient(lang, live)),
    });
    return { ok: true };
  }
  try {
    const saved = await sql<{
      name: string; phone: string; lat: number | null; lng: number | null; district: string; lang: string; role: string;
    }>`
      select name, phone, lat, lng, district, lang, role from as_clients
      where user_id = ${uid} and telegram_id = ${chatId} limit 1
    `;
    const s = saved[0];
    if (s) {
      const distId = DISTRICTS.find((d) => d.title === s.district)?.id ?? draft.districtId;
      draft = {
        ...draft,
        name: s.name || draft.name,
        phone: s.phone || draft.phone,
        lat: s.lat ?? draft.lat,
        lng: s.lng ?? draft.lng,
        districtId: distId,
        lang: (s.lang === "uz" ? "uz" : "ru") as Draft["lang"],
        role: s.role === "master" ? "master" : "client",
      };
    }
  } catch { /* ignore */ }

  let event: BotEvent | null = null;
  if (cb?.data === "sub:ok") {
    event = { type: "text", text: "/start" };
    await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Подписка есть — можно вызывать мастера" });
  } else if (cb?.data) {
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
    if (msg.text.startsWith("/start")) {
      const payload = msg.text.slice(6).trim();
      if (payload) {
        await persistProfile(sql, uid, chatId, name, draft);
        await applyStartPayload(sql, uid, chatId, payload);
      }
      event = { type: "text", text: "/start" };
    }
  }
  if (!event) return { ok: true };

  const result = reduceBot(step, draft, event);
  step = result.step;
  draft = result.draft;

  await persistProfile(sql, uid, chatId, name, draft);

  if (result.registerMaster) {
    await upsertMasterFromBot(sql, uid, chatId, name, draft);
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: "Меню мастера. Заявки приходят сюда, когда администратор назначит вас.",
      reply_markup: markup(masterMenu(draft.lang, true)),
    });
  }
  if (result.setOnline !== undefined) {
    await sql`
      update as_masters set online_status = ${result.setOnline ? "online" : "offline"}, last_seen = now()
      where user_id = ${uid} and telegram_id = ${chatId} and online_status <> 'blocked'
    `;
    try {
      await pushWorkspaceLog(
        sql,
        uid,
        `${result.setOnline ? "🟢" : "⚪️"} Мастер <b>${escHtml(name)}</b> ${result.setOnline ? "на линии" : "офлайн"}`,
        { parseMode: "HTML" },
      );
    } catch { /* ignore */ }
  }

  if (result.cancelLive && sess[0]?.live_order_id) {
    const oid = sess[0].live_order_id;
    await sql`update as_orders set status = 'cancelled', cancelled_at = now(), updated_at = now() where user_id = ${uid} and id = ${oid} and status not in ('completed','cancelled')`;
    await sql`
      insert into as_tg_sessions (user_id, chat_id, step, draft, live_order_id, last_status, tg_name, updated_at)
      values (${uid}, ${chatId}, ${"category"}, ${JSON.stringify({ ...emptyDraft(), name, lang: draft.lang, phone: draft.phone, lat: draft.lat, lng: draft.lng, districtId: draft.districtId })}, ${null}, ${"cancelled"}, ${name}, now())
      on conflict (user_id, chat_id) do update set step = ${"category"}, draft = ${JSON.stringify({ ...emptyDraft(), name, lang: draft.lang, phone: draft.phone, lat: draft.lat, lng: draft.lng, districtId: draft.districtId })}, live_order_id = ${null}, last_status = ${"cancelled"}, tg_name = ${name}, updated_at = now()
    `;
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: lang === "uz" ? "Ariza bekor qilindi." : "Заявка отменена.",
      reply_markup: markup(clientMenu(draft.lang)),
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
      const sub = await clientMustSubscribe(sql, uid, token, from.id);
      if (sub.block) {
        await sendSubscribePrompt(token, chatId, undefined, sub.url, sub.label);
        return { ok: true };
      }
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
          text: `${reply.text}\n\nЗаявка №${created.publicNo}\nВыезд от ${svc.from.toLocaleString("ru-RU")} сум\nОтмена: /cancel`,
          reply_markup: markup(liveMenu(draft.lang)),
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

  if (result.supportText) {
    await pushSupportAlert(sql, uid, name, chatId, result.supportText);
    if (sess[0]?.live_order_id) step = "live";
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
  await notifyClientOfMaster(sql, userId, token, orderId, status);
  if (status === "assigned") {
    await notifyMasterOfJob(sql, userId, token, orderId);
  }
  try {
    await sql`update as_tg_sessions set last_status = ${status}, updated_at = now() where user_id = ${userId} and live_order_id = ${orderId}`;
  } catch { /* ignore */ }
}

export { clientLabel };
