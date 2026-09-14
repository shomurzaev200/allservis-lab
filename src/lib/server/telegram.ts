import { getSql } from "@/lib/db";
import { DISTRICTS, districtById, serviceById } from "@/lib/catalog";
import { clientLabel, formatSum, STATUS_LABEL, type OrderStatus } from "@/lib/domain";
import { emptyDraft, reduceBot, statusReply, clientMenu, liveMenu, masterMenu, labelToTapId, type BotEvent } from "@/lib/bot";
import type { ChatStep, Draft, KeyboardButton } from "@/lib/types";
import { insertOrder } from "./orders";
import type { Sql, StaffWho } from "./workspace";
import { trackRefEvent } from "./refs";
import { formatGeoCard, isInsideServiceArea, isTashkentDistrictName, OUTSIDE_SERVICE_AREA, resolveLocation, SERVICE_CITY } from "@/lib/geo";
import { displayArea, formatClientHome, formatHowTo, formatOpError, HR, statusLine, svcTitle } from "@/lib/tg-ui";

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
  select o.id, o.public_no, o.status, o.category_slug, o.description, o.phone, o.district, o.address, o.city,
         o.lat, o.lng, o.comment, o.price, o.master_payout, o.created_at, o.master_id,
         c.name as client_name, c.telegram_id as client_tg, c.referred_by, c.ref_source,
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
  const dist = distRaw || "не определён";
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
    `🏙 Город: ${escHtml(String(o.city || SERVICE_CITY))}`,
    o.ref_source || o.referred_by
      ? `🎯 Источник: ${escHtml(String(o.ref_source || "ссылка"))}${o.referred_by ? ` · <code>${escHtml(String(o.referred_by))}</code>` : ""}`
      : "",
    `📍 Район/махалля: ${escHtml(dist)}`,
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
      HR,
      "",
      `👨‍🔧 Мастер: ${masterName}`,
      o.master_phone ? `📞 ${o.master_phone}` : "",
      `⭐️ ${Number(o.rating ?? 5).toFixed(1)}`,
      svc ? `🔧 ${svc.title}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  const titleMap: Partial<Record<OrderStatus, string>> = {
    assigned: "🔵 МАСТЕР НАЗНАЧЕН",
    master_accepted: "🟢 МАСТЕР ПРИНЯЛ ЗАЯВКУ",
    enroute: "🚗 МАСТЕР ЕДЕТ К ВАМ",
    arrived: "📍 МАСТЕР ПРИБЫЛ",
    in_progress: "🔧 РАБОТА ВЫПОЛНЯЕТСЯ",
    completed: "✅ ЗАЯВКА ЗАВЕРШЕНА",
    cancelled: "❌ ЗАЯВКА ОТМЕНЕНА",
    master_rejected: "❌ МАСТЕР ОТКАЗАЛСЯ",
  };
  const title = titleMap[status] ?? head;
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
    text: `${title}\n\n📦 Заявка №${o.public_no}${extra}${status === "completed" ? "\n\nОцените мастера звёздами." : ""}`,
    reply_markup: rateKb ?? menu ?? undefined,
  });
  if (status === "completed" || status === "cancelled" || status === "master_rejected") {
    try {
      await sql`
        update as_tg_sessions
        set step = ${status === "completed" ? "rate" : "category"},
            last_status = ${status},
            live_order_id = ${status === "completed" ? orderId : null},
            updated_at = now()
        where user_id = ${uid} and chat_id = ${chat}
      `;
    } catch { /* ignore */ }
  }
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
  try {
    await sql`
      update as_tg_sessions
      set step = ${"rate"}, live_order_id = ${orderId}, last_status = ${"completed"}, updated_at = now()
      where user_id = ${uid} and chat_id = ${chatId}
    `;
  } catch { /* ignore */ }
}

async function saveReviewComment(sql: Sql, uid: string, chatId: string, text: string, orderId?: number | null) {
  const comment = text.slice(0, 500);
  const oid = orderId
    ? [{ id: orderId }]
    : await sql<{ id: number }>`
        select o.id from as_orders o
        join as_clients c on c.id = o.client_id
        where o.user_id = ${uid} and c.telegram_id = ${chatId} and o.status = 'completed'
        order by o.completed_at desc nulls last, o.updated_at desc
        limit 1
      `;
  const id = oid[0]?.id;
  if (!id) return;
  const existing = await sql<{ id: number }>`
    select id from as_reviews where user_id = ${uid} and order_id = ${id} order by created_at desc limit 1
  `;
  if (existing[0]) {
    await sql`update as_reviews set comment = ${comment} where id = ${existing[0].id}`;
  } else {
    const o = await sql<{ client_id: number; master_id: number | null }>`
      select client_id, master_id from as_orders where user_id = ${uid} and id = ${id}
    `;
    if (o[0]) {
      await sql`
        insert into as_reviews (user_id, order_id, client_id, master_id, rating, comment)
        values (${uid}, ${id}, ${o[0].client_id}, ${o[0].master_id}, ${5}, ${comment})
      `;
    }
  }
  const card = await sql<{ public_no: number; rating: number; master_name: string | null }>`
    select o.public_no, coalesce(r.rating, 5) as rating,
      nullif(trim(concat_ws(' ', m.first_name, m.last_name)), '') as master_name
    from as_orders o
    left join as_reviews r on r.order_id = o.id
    left join as_masters m on m.id = o.master_id
    where o.user_id = ${uid} and o.id = ${id}
    order by r.created_at desc nulls last
    limit 1
  `;
  const row = card[0];
  const stars = "★".repeat(Math.max(1, Math.min(5, Math.round(Number(row?.rating) || 5))));
  await pushWorkspaceLog(sql, uid, [
    "<b>⭐ Отзыв клиента</b>",
    row ? `📋 Заявка №${row.public_no}` : "",
    row?.master_name ? `👷 ${escHtml(row.master_name)}` : "",
    `${stars}`,
    `💬 ${escHtml(comment)}`,
  ].filter(Boolean).join("\n"), { parseMode: "HTML" });
}

async function handleMasterMenu(sql: Sql, uid: string, token: string, chatId: string, tapId: string, loc?: { lat: number; lng: number }) {
  const m = await sql<{
    id: number; first_name: string; last_name: string; phone: string; rating: number;
    earnings: number; completed_orders: number; online_status: string; district: string; specialization: string;
  }>`
    select id, first_name, last_name, phone, rating, earnings, completed_orders, online_status, district, specialization
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
    const geo = await resolveLocation(loc.lat, loc.lng);
    if (!geo.inside) {
      await sql`update as_masters set lat = ${loc.lat}, lng = ${loc.lng}, city = ${"вне зоны"}, last_seen = now(), online_status = case when online_status = 'blocked' then online_status else 'offline' end where id = ${m[0].id}`;
      await tg(token, "sendMessage", {
        chat_id: Number(chatId),
        text: `${formatGeoCard(geo, "ru")}\n\n⚠️ Вы находитесь за пределами рабочей зоны ALL SERVIS.\nРабочая зона: 📍 Бекабад`,
        reply_markup: markup(masterMenu("ru", false)),
      });
      return true;
    }
    await sql`update as_masters set lat = ${loc.lat}, lng = ${loc.lng}, city = ${SERVICE_CITY}, district = ${geo.neighborhood || geo.district || SERVICE_CITY}, last_seen = now() where id = ${m[0].id}`;
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: `${formatGeoCard(geo, "ru")}\n\nЛокация обновлена. Вы на карте админки.`,
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
  if (tapId === "cmd:stats" || tapId === "cmd:profile" || tapId === "cmd:mbalance") {
    const extra = await sql<{ accepted_orders: number; rejected_orders: number; city: string }>`
      select accepted_orders, rejected_orders, city from as_masters where id = ${m[0].id}
    `;
    const acc = Number(extra[0]?.accepted_orders ?? 0);
    const rej = Number(extra[0]?.rejected_orders ?? 0);
    const tot = acc + rej;
    const pct = tot ? Math.round((acc / tot) * 100) : 0;
    const area = displayArea(m[0].district, null, null);
    const st = m[0].online_status === "online" ? "🟢 Онлайн" : m[0].online_status === "busy" ? "🟡 Занят" : "🔴 Офлайн";
    const today = await sql<{ n: number }>`
      select coalesce(sum(master_payout),0)::int as n from as_orders
      where master_id = ${m[0].id} and status = 'completed' and completed_at::date = current_date
    `.catch(() => [{ n: 0 }]);
    const week = await sql<{ n: number }>`
      select coalesce(sum(master_payout),0)::int as n from as_orders
      where master_id = ${m[0].id} and status = 'completed' and completed_at >= date_trunc('week', now())
    `.catch(() => [{ n: 0 }]);
    const month = await sql<{ n: number }>`
      select coalesce(sum(master_payout),0)::int as n from as_orders
      where master_id = ${m[0].id} and status = 'completed' and completed_at >= date_trunc('month', now())
    `.catch(() => [{ n: 0 }]);
    if (tapId === "cmd:mbalance") {
      await tg(token, "sendMessage", {
        chat_id: Number(chatId),
        text: [
          "💰 МОЙ БАЛАНС",
          "",
          "Доступно:",
          "",
          formatSum(Number(m[0].earnings)),
          "",
          HR,
          "",
          `📈 Заработано сегодня: ${formatSum(Number(today[0]?.n ?? 0))}`,
          `📅 За неделю: ${formatSum(Number(week[0]?.n ?? 0))}`,
          `📆 За месяц: ${formatSum(Number(month[0]?.n ?? 0))}`,
        ].join("\n"),
        reply_markup: markup(masterMenu("ru", online)),
      });
      return true;
    }
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: [
        "👨‍🔧 ПРОФИЛЬ МАСТЕРА",
        "",
        HR,
        "",
        `👤 ${m[0].first_name} ${m[0].last_name}`,
        "",
        `🔧 ${svcTitle(m[0].specialization)}`,
        `⭐️ ${Number(m[0].rating).toFixed(2)}`,
        "",
        `📦 Выполнено: ${m[0].completed_orders}`,
        `✅ Принято: ${pct}%`,
        `❌ Отказов: ${tot ? 100 - pct : 0}%`,
        "",
        HR,
        "",
        `💰 Баланс: ${formatSum(Number(m[0].earnings))}`,
        `📍 ${isTashkentDistrictName(area) ? SERVICE_CITY : area || SERVICE_CITY}`,
        "",
        st,
      ].join("\n"),
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
        text: [
          `📦 №${j.public_no}`,
          statusLine(j.status),
          `📍 ${displayArea(j.district)}`,
          j.description,
        ].filter(Boolean).join("\n"),
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
    try {
      await tg(token, "setMyCommands", {
        commands: [
          { command: "start", description: "Главное меню" },
          { command: "cancel", description: "Отменить заявку" },
        ],
      });
    } catch { /* ignore */ }
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
    const subKeys = await expandIdentity(tokenList, subscribeRaw);
    let stripped = false;
    for (const id of [...channelTargets]) {
      let hit = identityHit(id, subKeys);
      if (!hit) {
        for (const token of tokenList) {
          if (await destinationIsSubscribe(token, id, subscribeRaw)) { hit = true; break; }
        }
      }
      if (hit) {
        channelTargets.delete(id);
        stripped = true;
      }
    }
    for (const id of [...dmTargets]) {
      if (identityHit(id, subKeys)) dmTargets.delete(id);
    }
    if (stripped) {
      const keep = [...channelTargets];
      const kept = (raw: string) => keep.some((id) => id === raw || channelOverlap(id, raw));
      try {
        const wsRow = await sql<{ alerts_channel_id: string | null }>`select alerts_channel_id from as_workspace where user_id = ${userId}`;
        if (wsRow[0]?.alerts_channel_id && !kept(wsRow[0].alerts_channel_id)) {
          await sql`update as_workspace set alerts_channel_id = ${null}, last_alert_error = ${SUBSCRIBE_ALERT_HINT} where user_id = ${userId}`;
        }
      } catch { /* ignore */ }
      try {
        const bots2 = await sql<{ id: number; log_chat_id: string | null }>`
          select id, log_chat_id from as_bots where user_id = ${userId} and log_chat_id is not null
        `;
        for (const b of bots2) {
          if (b.log_chat_id && !kept(b.log_chat_id)) {
            await sql`update as_bots set log_chat_id = ${null} where id = ${b.id}`;
          }
        }
      } catch { /* ignore */ }
    }
  }
  const hasNumeric = [...channelTargets].some((id) => id.startsWith("-"));
  if (hasNumeric) {
    for (const id of [...channelTargets]) {
      if (id.startsWith("@")) channelTargets.delete(id);
    }
  }
  return { tokens: tokenList, channelTargets, dmTargets, subscribeRaw };
}

export async function sanitizeAlertRouting(sql: Sql, userId: string) {
  await collectAlertRoutes(sql, userId);
}

export type TgHealthCheck = { key: string; ok: boolean; detail: string };

export async function probeTelegramHealth(sql: Sql, userId: string): Promise<{
  checks: TgHealthCheck[];
  openMembers: number | null;
  botUsername: string;
}> {
  const checks: TgHealthCheck[] = [];
  const ws = await sql<{
    bot_token: string | null; bot_username: string | null;
    channel_username: string | null; alerts_channel_id: string | null;
  }>`
    select bot_token, bot_username, channel_username, alerts_channel_id from as_workspace where user_id = ${userId}
  `;
  const token = (ws[0]?.bot_token ?? "").trim();
  let botUsername = ws[0]?.bot_username ?? "";
  let botId = 0;
  if (!token) {
    checks.push({ key: "bot", ok: false, detail: "Нет токена основного бота" });
    return { checks, openMembers: null, botUsername };
  }
  const me = await tg(token, "getMe", {});
  if (!me.ok || !me.result || Array.isArray(me.result)) {
    checks.push({ key: "bot", ok: false, detail: me.description ?? "Telegram не принял токен" });
    return { checks, openMembers: null, botUsername };
  }
  const r = me.result as { id?: number; username?: string };
  botId = Number(r.id ?? 0);
  botUsername = r.username ? `@${r.username}` : botUsername;
  checks.push({ key: "bot", ok: true, detail: `${botUsername} · API ок` });

  const openRaw = (ws[0]?.channel_username ?? "").trim();
  let openMembers: number | null = null;
  if (!openRaw) {
    checks.push({ key: "open", ok: false, detail: "Открытый канал подписки не указан" });
  } else {
    let openOk = false;
    let openDetail = "канал не найден — добавьте бота админом открытого канала";
    for (const ref of chatIdVariants(openRaw).concat([openRaw.startsWith("@") ? openRaw : `@${openRaw}`])) {
      const chat = await tg(token, "getChat", { chat_id: ref });
      if (!chat.ok || !chat.result || Array.isArray(chat.result)) {
        openDetail = chat.description ?? openDetail;
        continue;
      }
      const info = chat.result as { id?: number; username?: string; title?: string };
      const member = await tg(token, "getChatMember", { chat_id: info.id ?? ref, user_id: botId });
      const st = member.ok && member.result && !Array.isArray(member.result)
        ? String((member.result as { status?: string }).status ?? "")
        : "";
      const canCheck = st === "administrator" || st === "creator";
      const cnt = await tg(token, "getChatMemberCount", { chat_id: info.id ?? ref });
      if (cnt.ok && typeof cnt.result === "number") openMembers = cnt.result;
      openOk = canCheck;
      openDetail = canCheck
        ? `${info.title || info.username || ref} · бот админ${openMembers != null ? ` · ${openMembers} подписчиков` : ""}`
        : `${info.title || ref}: бот не админ (нужно для проверки подписки)`;
      break;
    }
    checks.push({ key: "open", ok: openOk, detail: openDetail });
  }

  const closedRaw = (ws[0]?.alerts_channel_id ?? "").trim();
  if (!closedRaw) {
    checks.push({ key: "closed", ok: false, detail: "Закрытый канал отчётов не привязан. Перешлите боту пост из него." });
  } else {
    let closedOk = false;
    let closedDetail = "chat not found — бот не состоит в канале";
    for (const ref of chatIdVariants(closedRaw)) {
      const chat = await tg(token, "getChat", { chat_id: ref });
      if (!chat.ok || !chat.result || Array.isArray(chat.result)) {
        closedDetail = chat.description ?? closedDetail;
        continue;
      }
      const info = chat.result as { id?: number; title?: string; username?: string };
      if (info.username) {
        closedOk = false;
        closedDetail = `Это публичный @${info.username} — алерты сюда не пишем. Нужен закрытый канал без @username.`;
        break;
      }
      const member = await tg(token, "getChatMember", { chat_id: info.id ?? ref, user_id: botId });
      const st = member.ok && member.result && !Array.isArray(member.result)
        ? String((member.result as { status?: string }).status ?? "")
        : "";
      const canPost = st === "administrator" || st === "creator";
      closedOk = canPost;
      closedDetail = canPost
        ? `${info.title || info.id} · бот может писать отчёты`
        : `${info.title || info.id}: бот в канале, но без права публикации`;
      break;
    }
    checks.push({ key: "closed", ok: closedOk, detail: closedDetail });
  }
  return { checks, openMembers, botUsername };
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
    if (raw && await destinationIsSubscribe(token, chatId, raw, title)) {
      return { ok: true as const, used: chatId, skipped: true as const };
    }
  } catch { /* ignore */ }
  try {
    const looked = await tg(token, "getChat", { chat_id: chatId });
    if (looked.ok && looked.result && !Array.isArray(looked.result)) {
      const uname = (looked.result as { username?: string }).username;
      if (uname) {
        return { ok: true as const, used: chatId, skipped: true as const };
      }
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
  const { tokens, channelTargets, dmTargets, subscribeRaw } = await collectAlertRoutes(sql, userId);
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
      await sql`update as_workspace set last_alert_error = ${subscribeRaw ? SUBSCRIBE_ALERT_HINT : "Нет ID канала отчётов. В Настройках вставьте −100… закрытого канала ИЛИ перешлите боту пост из него. Публичный канал подписки сюда не подходит."} where user_id = ${userId}`;
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
          if (subscribeRaw && await destinationIsSubscribe(token, chat, subscribeRaw)) {
            lastErr = SUBSCRIBE_ALERT_HINT;
            continue;
          }
          const r = await sendToAlerts(token, chat, text, extra);
          if (r.ok) {
            if (subscribeRaw && r.used && await destinationIsSubscribe(token, r.used, subscribeRaw)) {
              lastErr = SUBSCRIBE_ALERT_HINT;
              continue;
            }
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
  const tokenProbe = await sql<{ bot_token: string | null }>`
    select bot_token from as_bots where user_id = ${userId} and bot_token is not null
    union all
    select bot_token from as_workspace where user_id = ${userId} and bot_token is not null
  `;
  const probeTokens = tokenProbe.map((r) => (r.bot_token ?? "").trim()).filter(Boolean);
  if (chatOverride?.trim() && subRaw && await destinationIsSubscribe(probeTokens[0] ?? "", chatOverride, subRaw)) {
    return { ok: false as const, error: SUBSCRIBE_ALERT_HINT };
  }
  const { tokens, channelTargets } = await collectAlertRoutes(sql, userId);
  if (chatOverride?.trim() && tokens[0]) {
    const subKeys = subRaw ? await expandIdentity(tokens, subRaw) : new Set<string>();
    for (const id of chatIdVariants(chatOverride)) {
      if ((id.startsWith("-") || id.startsWith("@")) && !identityHit(id, subKeys)) channelTargets.add(id);
    }
  }
  if (!tokens.length) return { ok: false as const, error: "Нет токена: подключите основной бот и добавьте ИМЕННО ЕГО админом закрытого канала отчётов." };
  const channels = [...channelTargets];
  if (!channels.length) {
    const hint = SUBSCRIBE_ALERT_HINT;
    try { await sql`update as_workspace set last_alert_error = ${hint} where user_id = ${userId}`; } catch { /* ignore */ }
    return { ok: false as const, error: hint };
  }
  const text = "All Servis: тест алерта. Если видите это в ЗАКРЫТОМ канале отчётов — подключение работает.";
  const attempts: string[] = [];
  let lastErr = "Telegram отклонил сообщение";
  for (const token of tokens) {
    const who = await botLabel(token);
    for (const chat of channels) {
      if (subRaw && await destinationIsSubscribe(token, chat, subRaw)) {
        attempts.push(`${who} → ${chat}: пропуск (канал подписки)`);
        continue;
      }
      const r = await sendToAlerts(token, chat, text);
      attempts.push(`${who} → ${r.used ?? chat}: ${r.ok ? "ok" : (r.description ?? "fail")}`);
      if (r.ok) {
        const saved = r.used ?? chat;
        if (await destinationIsSubscribe(token, saved, subRaw)) {
          attempts.push(`${who} → ${saved}: отмена (это канал подписки)`);
          continue;
        }
        try { await sql`update as_workspace set last_alert_error = ${null}, alerts_channel_id = ${saved} where user_id = ${userId}`; } catch { /* ignore */ }
        try { await sql`update as_bots set log_chat_id = ${saved} where user_id = ${userId} and kind = ${"logs"}`; } catch { /* ignore */ }
        return { ok: true as const, error: null as string | null };
      }
      lastErr = r.description ?? lastErr;
    }
  }
  const hint = lastErr.toLowerCase().includes("chat not found")
    ? [
        "Бот не видит этот канал (chat not found).",
        "ID в поле можно вставить, но Telegram пускает только если бот УЖЕ админ канала.",
        "1) Откройте ЗАКРЫТЫЙ канал отчётов → Администраторы → Добавить → найдите @" + "allservic24_bot (это бот, не человек).",
        "2) Включите «Публикация сообщений».",
        "3) Напишите любой пост в этот канал ИЛИ перешлите пост из канала в личку боту.",
        "После этого ID подставится сам. Вставлять −100… вручную не нужно, если бот не в канале.",
        attempts.length ? `Пробовали: ${attempts.join("; ")}` : "",
      ].filter(Boolean).join(" ")
    : [
        explainAlertError(lastErr),
        `Пробовали: ${attempts.join("; ")}`,
        "Закрытый канал: добавьте @allservic24_bot админом с правом «Публикация сообщений», затем перешлите ему пост из ЭТОГО канала.",
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

function identityHit(id: string, keys: Set<string>): boolean {
  if (!id.trim() || !keys.size) return false;
  for (const k of channelKeys(id)) {
    if (keys.has(k) || keys.has(k.toLowerCase())) return true;
  }
  return false;
}

/** Resolve @username / −100 / title into a comparable set via getChat. */
async function expandIdentity(tokens: string[], raw: string): Promise<Set<string>> {
  const keys = channelKeys(raw);
  const s = (raw ?? "").trim();
  if (!s) return keys;
  const refs: string[] = [...chatIdVariants(s)];
  const p = parseSubChannel(s);
  if (p.username) refs.push(`@${p.username}`);
  for (const token of tokens) {
    if (!token) continue;
    for (const ref of refs) {
      try {
        const looked = await tg(token, "getChat", { chat_id: ref });
        if (!looked.ok || !looked.result || Array.isArray(looked.result)) continue;
        const r = looked.result as { id?: number; username?: string };
        if (r.id != null) {
          keys.add(String(r.id));
          for (const v of chatIdVariants(String(r.id))) keys.add(v.toLowerCase());
        }
        if (r.username) keys.add(`@${String(r.username).toLowerCase()}`);
      } catch { /* ignore */ }
    }
    if ([...keys].some((k) => k.startsWith("-"))) break;
  }
  return keys;
}

async function destinationIsSubscribe(token: string, used: string, subscribeRaw: string, extraTitle?: string): Promise<boolean> {
  const sub = (subscribeRaw ?? "").trim();
  if (!sub) return false;
  if (channelOverlap(sub, used) || (extraTitle && channelOverlap(sub, extraTitle))) return true;
  const keys = await expandIdentity([token], sub);
  if (identityHit(used, keys) || (extraTitle && identityHit(extraTitle, keys))) return true;
  try {
    const looked = await tg(token, "getChat", { chat_id: used });
    if (looked.ok && looked.result && !Array.isArray(looked.result)) {
      const r = looked.result as { id?: number; username?: string };
      if (r.username && identityHit(`@${r.username}`, keys)) return true;
      if (r.id != null && identityHit(String(r.id), keys)) return true;
    }
  } catch { /* ignore */ }
  return false;
}

const SUBSCRIBE_ALERT_HINT = "Канал отчётов совпал с каналом подписки клиентов. Алерты туда больше не пишем. Создайте ДРУГОЙ закрытый канал, добавьте бота админом и перешлите ему пост из этого закрытого канала.";

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

async function sendSubscribePrompt(token: string, chatId: string, cbId: string | undefined, url: string, label: string, fromStart = false, custom?: string) {
  if (cbId && !fromStart) {
    await tg(token, "answerCallbackQuery", { callback_query_id: cbId, text: "Сначала подпишитесь на канал", show_alert: true });
  } else if (cbId) {
    await tg(token, "answerCallbackQuery", { callback_query_id: cbId });
  }
  const buttons: { text: string; url?: string; callback_data?: string }[][] = [];
  if (url) buttons.push([{ text: `📢 Подписаться на ${label}`, url }]);
  buttons.push([{ text: "✅ Я подписался", callback_data: "sub:ok" }]);
  const fallback = [
    "🔒 Доступ закрыт",
    "",
    `Чтобы продолжить, подпишитесь на ${label}.`,
    `Davom etish uchun ${label} kanaliga obuna bo‘ling.`,
    "",
    "1) Нажмите «Подписаться»",
    "2) Вернитесь и нажмите «Я подписался»",
  ].join("\n");
  await tg(token, "sendMessage", {
    chat_id: Number(chatId),
    text: (custom ?? "").trim() || fallback,
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
      let prompt = "";
      try {
        const pr = await sql<{ subscribe_prompt: string | null }>`select subscribe_prompt from as_workspace where user_id = ${uid}`;
        prompt = pr[0]?.subscribe_prompt ?? "";
      } catch { /* ignore */ }
      await sendSubscribePrompt(token, chatId, cb?.id, sub.url, sub.label, fromStart, prompt);
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
      values (${uid}, ${chatId}, ${name}, ${""}, ${SERVICE_CITY}, ${""}, ${5})
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
        await trackRefEvent(sql, uid, p, "join", chatId);
      }
    } else if (p.startsWith("c")) {
      await sql`update as_ref_links set clicks = clicks + 1 where user_id = ${uid} and code = ${p}`;
      await trackRefEvent(sql, uid, p, "click", chatId);
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
          await trackRefEvent(sql, uid, p, "join", chatId);
        }
      }
    }
  } catch { /* ignore */ }
}

async function persistProfile(sql: Sql, uid: string, chatId: string, name: string, draft: Draft) {
  const lang = draft.lang ?? "ru";
  const role = draft.role ?? "client";
  const phone = draft.phone ?? "";
  const lat = draft.lat ?? null;
  const lng = draft.lng ?? null;
  const inside = lat != null && lng != null && isInsideServiceArea(Number(lat), Number(lng));
  const city = inside ? SERVICE_CITY : "";
  const districtRaw = inside
    ? (draft.neighborhood || draft.fullAddress || districtById(draft.districtId ?? "")?.title || SERVICE_CITY)
    : (draft.neighborhood || "");
  const district = isTashkentDistrictName(districtRaw) ? (inside ? SERVICE_CITY : "") : districtRaw;
  try {
    const existing = await sql<{ id: number }>`
      select id from as_clients where user_id = ${uid} and telegram_id = ${chatId} limit 1
    `;
    if (existing[0]) {
      await sql`
        update as_clients set
          name = ${name},
          phone = coalesce(nullif(${phone}, ''), phone),
          city = coalesce(nullif(${city}, ''), city),
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
        values (${uid}, ${chatId}, ${name}, ${phone}, ${city || SERVICE_CITY}, ${district}, ${lat}, ${lng}, ${5}, ${lang}, ${role})
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

async function pushSupportAlert(
  sql: Sql,
  uid: string,
  chatId: string,
  opts: { name: string; username?: string | null; text: string; isMaster?: boolean },
) {
  try {
    const c = await sql<{ name: string; phone: string; district: string; lat: number | null; lng: number | null; role: string }>`
    select name, phone, district, lat, lng, coalesce(role, 'client') as role
    from as_clients where user_id = ${uid} and telegram_id = ${chatId} limit 1
  `;
  const last = await sql<{ public_no: number; status: string; description: string; comment: string; district: string }>`
    select o.public_no, o.status, o.description, o.comment, o.district
    from as_orders o join as_clients cl on cl.id = o.client_id
    where o.user_id = ${uid} and cl.telegram_id = ${chatId}
    order by o.created_at desc limit 1
  `;
  const row = c[0];
  const o = last[0];
  const who = opts.isMaster || row?.role === "master" ? "Мастер" : "Клиент";
  const uname = (opts.username ?? "").replace(/^@/, "");
  const geo = row?.lat != null && row?.lng != null ? `${Number(row.lat).toFixed(5)}, ${Number(row.lng).toFixed(5)}` : "";
  const lines = [
    `<b>📞 ${who} просит связаться</b>`,
    `👤 <b>${escHtml(opts.name || row?.name || "—")}</b>`,
    uname ? `🔗 @${escHtml(uname)}` : "",
    `🆔 <code>${escHtml(chatId)}</code>`,
    row?.phone ? `📱 <code>${escHtml(row.phone)}</code>` : "📱 телефон не указан",
    row?.district ? `🏙 ${escHtml(row.district)}` : "",
    geo ? `📍 <code>${escHtml(geo)}</code>` : "",
    o ? `📋 Заявка №${o.public_no} · ${escHtml(STATUS_LABEL[o.status as OrderStatus] ?? o.status)}` : "",
    o?.description ? `🔧 Что случилось: ${escHtml(o.description)}` : "",
    o?.comment ? `📝 Комментарий к заявке: ${escHtml(o.comment)}` : "",
    opts.text ? `💬 Сообщение: ${escHtml(opts.text)}` : "",
  ].filter(Boolean);
  await pushWorkspaceLog(sql, uid, lines.join("\n"), {
    parseMode: "HTML",
    lat: row?.lat != null ? Number(row.lat) : null,
    lng: row?.lng != null ? Number(row.lng) : null,
  });
  } catch {
    await pushWorkspaceLog(sql, uid, [
      `<b>📞 Просит связаться</b>`,
      `👤 <b>${escHtml(opts.name)}</b>`,
      `🆔 <code>${escHtml(chatId)}</code>`,
      opts.text ? `💬 ${escHtml(opts.text)}` : "",
    ].filter(Boolean).join("\n"), { parseMode: "HTML" });
  }
}

function navKb(lang: string | undefined, live: boolean) {
  return kbClient(lang, live);
}

async function clientPaidSum(sql: Sql, uid: string, chatId: string): Promise<number> {
  try {
    const rows = await sql<{ n: number }>`
      select coalesce(sum(amount), 0)::int as n from as_payments
      where user_id = ${uid} and telegram_id = ${chatId} and status = 'approved'
    `;
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

async function sendHome(sql: Sql, uid: string, token: string, chatId: string, name: string, lang: string, live: boolean) {
  const L = lang === "uz" ? "uz" as const : "ru" as const;
  let city = SERVICE_CITY;
  let shown = name;
  let balance = 0;
  try {
    const c = await sql<{ name: string; district: string; lat: number | null; lng: number | null }>`
      select name, district, lat, lng from as_clients where user_id = ${uid} and telegram_id = ${chatId} limit 1
    `;
    const row = c[0];
    shown = row?.name || name;
    city = displayArea(row?.district, row?.lat, row?.lng, L);
    if (city === "не определён" || city === "aniqlanmadi") city = SERVICE_CITY;
    balance = await clientPaidSum(sql, uid, chatId);
  } catch { /* show defaults */ }
  const text = formatClientHome({ name: shown, city, balance, lang: L });
  const sent = await tg(token, "sendMessage", {
    chat_id: Number(chatId),
    text,
    reply_markup: markup(navKb(lang, live)),
  });
  if (!sent.ok) {
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: L === "uz" ? "🔧 ALL SERVIS\nBosh menyu." : "🔧 ALL SERVIS\nГлавное меню.",
      reply_markup: markup(navKb(lang, live)),
    });
  }
}

async function sendClientBalance(sql: Sql, uid: string, token: string, chatId: string, lang: string, live: boolean) {
  const sum = await clientPaidSum(sql, uid, chatId);
  const hist = await sql<{ amount: number; status: string; created_at: string }>`
    select amount, status, created_at::text as created_at from as_payments
    where user_id = ${uid} and telegram_id = ${chatId}
    order by created_at desc limit 8
  `.catch(() => [] as { amount: number; status: string; created_at: string }[]);
  const paid = await sql<{ paid: boolean }>`select coalesce(paid, false) as paid from as_clients where user_id = ${uid} and telegram_id = ${chatId} limit 1`;
  const ws = await sql<{ pay_card: string | null; pay_bank: string | null; pay_holder: string | null; pay_amount: number }>`
    select pay_card, pay_bank, pay_holder, pay_amount from as_workspace where user_id = ${uid}
  `;
  const L = lang === "uz";
  const lines = [
    L ? "💰 MENING BALANSIM" : "💰 МОЙ БАЛАНС",
    "",
    HR,
    "",
    L ? "💵 Mavjud:" : "💵 Доступно:",
    "",
    formatSum(sum),
    "",
    paid[0]?.paid ? (L ? "✅ Kirish ochiq" : "✅ Доступ открыт") : (L ? "⏳ To‘lov kutilmoqda" : "⏳ Ожидает оплату"),
    "",
    HR,
  ];
  if (hist.length) {
    lines.push("", L ? "📊 Operatsiyalar:" : "📊 История операций:", "");
    for (const h of hist) {
      const sign = h.status === "approved" ? "➕" : h.status === "cancelled" ? "❌" : "⏳";
      const label = h.status === "approved" ? (L ? "To‘ldirish" : "Пополнение") : h.status === "cancelled" ? (L ? "Bekor" : "Отмена") : (L ? "Kutilmoqda" : "На проверке");
      lines.push(`${sign} ${label}`, `${h.status === "cancelled" ? "" : "+"}${Number(h.amount).toLocaleString("ru-RU")} сум`, "");
    }
  } else {
    lines.push("", L ? "Hali operatsiya yo‘q." : "Операций пока нет.");
  }
  const btns: KeyboardButton[][] = [
    [{ id: "cmd:pay", label: L ? "➕ To‘ldirish" : "➕ Пополнить баланс" }],
    [{ id: "cmd:menu", label: L ? "◀️ Orqaga" : "◀️ Назад" }],
  ];
  await tg(token, "sendMessage", { chat_id: Number(chatId), text: lines.join("\n"), reply_markup: markup(btns) });
  void ws;
}

async function sendOperator(sql: Sql, uid: string, token: string, chatId: string, lang: string, live: boolean) {
  const ws = await sql<{ pay_holder: string | null; bot_username: string | null }>`
    select pay_holder, bot_username from as_workspace where user_id = ${uid}
  `;
  const L = lang === "uz";
  const holder = (ws[0]?.pay_holder ?? "").trim();
  const text = [
    L ? "📞 OPERATOR BILAN ALOQA" : "📞 СВЯЗЬ С ОПЕРАТОРОМ",
    "",
    L ? "Savol yoki muammo bo‘lsa — dispatcher yordam beradi." : "Если у вас вопрос или проблема,\nнаш оператор поможет вам.",
    "",
    L ? "🕐 Ish vaqti:\n09:00 — 21:00" : "🕐 Время работы:\n09:00 — 21:00",
    holder ? `\n👤 ${holder}` : "",
  ].filter(Boolean).join("\n");
  await tg(token, "sendMessage", {
    chat_id: Number(chatId),
    text,
    reply_markup: markup([
      [{ id: "cmd:writeop", label: L ? "💬 Yozish" : "💬 Написать оператору" }],
      [{ id: "cmd:menu", label: L ? "◀️ Orqaga" : "◀️ Назад" }],
    ]),
  });
}

async function sendReviews(sql: Sql, uid: string, token: string, chatId: string, lang: string, live: boolean, masterId?: number) {
  const rows = masterId
    ? await sql<{ rating: number; comment: string; first_name: string }>`
        select r.rating, r.comment, coalesce(m.first_name, '') as first_name
        from as_reviews r left join as_masters m on m.id = r.master_id
        where r.user_id = ${uid} and r.master_id = ${masterId}
        order by r.created_at desc limit 6
      `
    : await sql<{ rating: number; comment: string; first_name: string }>`
        select r.rating, r.comment, coalesce(m.first_name, 'Usta') as first_name
        from as_reviews r left join as_masters m on m.id = r.master_id
        where r.user_id = ${uid} and coalesce(r.comment, '') <> ''
        order by r.created_at desc limit 6
      `;
  const L = lang === "uz";
  const lines = [L ? "⭐️ IZOHLAR" : "⭐️ ОТЗЫВЫ", "", HR, ""];
  if (!rows.length) lines.push(L ? "Hali izoh yo‘q." : "Пока нет отзывов.");
  for (const r of rows) {
    const stars = "⭐️".repeat(Math.max(1, Math.min(5, Math.round(Number(r.rating) || 5))));
    lines.push(`${stars}  ${r.first_name || "Мастер"}`);
    if (r.comment) lines.push(r.comment);
    lines.push("");
  }
  await tg(token, "sendMessage", {
    chat_id: Number(chatId),
    text: lines.join("\n"),
    reply_markup: markup([[{ id: "cmd:menu", label: L ? "🏠 Bosh menyu" : "🏠 Главное меню" }]]),
  });
}

async function sendClientOrders(sql: Sql, uid: string, token: string, chatId: string, lang: string, live: boolean) {
  const mine = await sql<{
    id: number; public_no: number; status: string; district: string;
    category_slug: string; master_name: string | null; lat: number | null; lng: number | null; created_at: string;
  }>`
    select o.id, o.public_no, o.status, o.district, o.category_slug, o.lat, o.lng,
      o.created_at::text as created_at,
      nullif(trim(concat_ws(' ', m.first_name, m.last_name)), '') as master_name
    from as_orders o
    join as_clients c on c.id = o.client_id
    left join as_masters m on m.id = o.master_id
    where o.user_id = ${uid} and c.telegram_id = ${chatId}
    order by o.created_at desc limit 6
  `;
  const L = lang === "uz";
  if (!mine.length) {
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: L ? "📦 ARIZALARIM\n\nHali ariza yo‘q." : "📦 МОИ ЗАЯВКИ\n\nЗаявок пока нет.",
      reply_markup: markup([
        [{ id: "cmd:order", label: L ? "🔧 Usta chaqirish" : "🔧 Вызвать мастера" }],
        [{ id: "cmd:menu", label: L ? "🏠 Bosh menyu" : "🏠 Главное меню" }],
      ]),
    });
    return;
  }
  const blocks = mine.map((x) => {
    const area = displayArea(x.district, x.lat, x.lng, L ? "uz" : "ru");
    const when = x.created_at ? new Date(x.created_at).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
    return [
      `${statusLine(x.status, L ? "uz" : "ru").slice(0, 2)} Заявка №${x.public_no}`.replace("Заявка", L ? "Ariza" : "Заявка"),
      "",
      svcTitle(x.category_slug, L ? "uz" : "ru"),
      `📍 ${area}`,
      when ? `📅 ${when}` : "",
      "",
      L ? "Status:" : "Статус:",
      statusLine(x.status, L ? "uz" : "ru"),
      x.master_name ? `👨‍🔧 ${x.master_name}` : "",
    ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  });
  const text = [L ? "📦 ARIZALARIM" : "📦 МОИ ЗАЯВКИ", "", HR, "", blocks.join(`\n${HR}\n\n`)].join("\n");
  const btns: KeyboardButton[][] = mine.map((x) => [{ id: `ord:${x.id}`, label: `📦 №${x.public_no}` }]);
  btns.push([{ id: "cmd:menu", label: L ? "🏠 Bosh menyu" : "🏠 Главное меню" }]);
  await tg(token, "sendMessage", { chat_id: Number(chatId), text, reply_markup: markup(btns) });
}

async function sendClientOrderCard(sql: Sql, uid: string, token: string, chatId: string, orderId: number, lang: string, live: boolean) {
  const rows = await sql<{
    id: number; public_no: number; status: string; district: string;
    category_slug: string; description: string; lat: number | null; lng: number | null; created_at: string;
    master_name: string | null; master_phone: string | null; rating: number | null;
  }>`
    select o.id, o.public_no, o.status, o.district, o.category_slug, o.description,
      o.lat, o.lng, o.created_at::text as created_at,
      nullif(trim(concat_ws(' ', m.first_name, m.last_name)), '') as master_name,
      m.phone as master_phone, m.rating
    from as_orders o
    left join as_masters m on m.id = o.master_id
    where o.user_id = ${uid} and o.id = ${orderId}
    limit 1
  `;
  const o = rows[0];
  const L = lang === "uz";
  if (!o) {
    await tg(token, "sendMessage", { chat_id: Number(chatId), text: formatOpError(L ? "uz" : "ru"), reply_markup: markup(navKb(lang, live)) });
    return;
  }
  const area = displayArea(o.district, o.lat, o.lng, L ? "uz" : "ru");
  const when = o.created_at ? new Date(o.created_at).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const text = [
    L ? `📦 ARIZA №${o.public_no}` : `📦 ЗАЯВКА №${o.public_no}`,
    "",
    HR,
    "",
    L ? "🔧 Xizmat:" : "🔧 Услуга:",
    svcTitle(o.category_slug, L ? "uz" : "ru"),
    "",
    L ? "📝 Muammo:" : "📝 Проблема:",
    o.description || "—",
    "",
    L ? "📍 Joy:" : "📍 Местоположение:",
    SERVICE_CITY,
    "",
    L ? "📍 Tuman/mahalla:" : "📍 Район/махалля:",
    area,
    "",
    HR,
    "",
    L ? "👨‍🔧 Usta:" : "👨‍🔧 Мастер:",
    o.master_name || (L ? "Tayinlash kutilmoqda" : "Ожидает назначения"),
    o.rating != null && o.master_name ? `⭐️ ${Number(o.rating).toFixed(1)}` : "",
    "",
    statusLine(o.status, L ? "uz" : "ru"),
    "",
    HR,
    "",
    L ? "🕐 Yaratildi:" : "🕐 Создана:",
    when,
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  const btns: KeyboardButton[][] = [];
  if (o.status === "waiting_admin" || o.status === "assigned" || o.status === "master_rejected") {
    btns.push([{ id: "cmd:myorders", label: L ? "🔄 Yangilash" : "🔄 Обновить статус" }]);
    btns.push([{ id: "cmd:cancel", label: L ? "❌ Bekor qilish" : "❌ Отменить заявку" }]);
  } else if (o.master_name && o.status !== "completed" && o.status !== "cancelled") {
    if (o.master_phone) btns.push([{ id: `callm:${o.id}`, label: L ? "📞 Bog‘lanish" : "📞 Связаться" }]);
    btns.push([{ id: "cmd:myorders", label: L ? "📦 Arizalar" : "📦 Мои заявки" }]);
  } else if (o.status === "completed") {
    btns.push([{ id: "cmd:order", label: L ? "🔄 Qayta chaqirish" : "🔄 Заказать снова" }]);
  }
  btns.push([{ id: "cmd:menu", label: L ? "🏠 Bosh menyu" : "🏠 Главное меню" }]);
  await tg(token, "sendMessage", { chat_id: Number(chatId), text, reply_markup: markup(btns) });
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
  const L = lang === "uz";
  const area = displayArea(row?.district, row?.lat, row?.lng, L ? "uz" : "ru");
  const cityShow = (row?.lat != null && row?.lng != null && isInsideServiceArea(Number(row.lat), Number(row.lng)))
    ? SERVICE_CITY
    : (isTashkentDistrictName(row?.district) ? (L ? "aniqlanmadi" : "не определён") : SERVICE_CITY);
  const active = (row?.orders_count ?? 0) - (row?.completed_count ?? 0);
  const balance = await clientPaidSum(sql, uid, chatId);
  const geoLine = (row?.lat != null && row?.lng != null && isInsideServiceArea(Number(row.lat), Number(row.lng)))
    ? `${SERVICE_CITY}${area && area !== SERVICE_CITY ? ", " + area : ""}`
    : (L ? "lokatsiya yo‘q" : "локация не указана");
  const text = [
    L ? "👤 MENING PROFILIM" : "👤 МОЙ ПРОФИЛЬ",
    "",
    HR,
    "",
    `👤 ${row?.name || "—"}`,
    "",
    `📱 ${row?.phone || "—"}`,
    "",
    `📍 ${cityShow}`,
    `📍 ${L ? "Tuman" : "Район"}: ${area}`,
    "",
    HR,
    "",
    L ? "💰 Balans" : "💰 Баланс",
    formatSum(balance),
    "",
    L ? "📦 Jami arizalar" : "📦 Всего заявок",
    String(row?.orders_count ?? 0),
    "",
    L ? "✅ Yakunlangan" : "✅ Завершено",
    String(row?.completed_count ?? 0),
    "",
    L ? "⏳ Faol" : "⏳ Активных",
    String(Math.max(0, active)),
    "",
    HR,
    "",
    L ? "📍 Oxirgi joylashuv" : "📍 Последняя геолокация",
    geoLine,
  ].join("\n");
  await tg(token, "sendMessage", {
    chat_id: Number(chatId),
    text,
    reply_markup: markup([
      [{ id: "cmd:balance", label: L ? "💰 Balans" : "💰 Баланс" }, { id: "cmd:myorders", label: L ? "📦 Arizalar" : "📦 Мои заявки" }],
      [{ id: "cmd:loc", label: L ? "📍 Lokatsiya" : "📍 Изменить локацию" }, { id: "cmd:become", label: L ? "👨‍🔧 Usta" : "👨‍🔧 Стать мастером" }],
      [{ id: "cmd:menu", label: L ? "🏠 Bosh menyu" : "🏠 Главное меню" }],
    ]),
  });
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

async function upsertMasterFromBot(sql: Sql, uid: string, chatId: string, name: string, draft: Draft) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] || "Мастер";
  const last = parts.slice(1).join(" ") || "Telegram";
  const spec = draft.serviceId ?? "other";
  const phone = draft.phone ?? "";
  const dist = draft.neighborhood || districtById(draft.districtId ?? "")?.title || SERVICE_CITY;
  const lat = draft.lat ?? null;
  const lng = draft.lng ?? null;
  const insideMaster = lat != null && lng != null && isInsideServiceArea(Number(lat), Number(lng));
  const masterCity = insideMaster ? SERVICE_CITY : "";
  const masterDist = insideMaster ? dist : (draft.neighborhood || "");
  const found = await sql<{ id: number }>`
    select id from as_masters where user_id = ${uid} and telegram_id = ${chatId} limit 1
  `;
  if (found[0]) {
    await sql`
      update as_masters set first_name = ${first}, last_name = ${last}, phone = ${phone},
        district = ${masterDist}, specialization = ${spec}, lat = ${lat}, lng = ${lng},
        city = ${insideMaster ? SERVICE_CITY : "вне зоны"},
        online_status = ${insideMaster ? "online" : "offline"}, last_seen = now()
      where id = ${found[0].id}
    `;
  } else {
    await sql`
      insert into as_masters (
        user_id, first_name, last_name, telegram_id, phone, city, district,
        specialization, online_status, last_seen, lat, lng
      ) values (
        ${uid}, ${first}, ${last}, ${chatId}, ${phone}, ${masterCity}, ${masterDist},
        ${spec}, ${insideMaster ? "online" : "offline"}, now(), ${lat}, ${lng}
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
    const ch = update.channel_post.chat;
    if (ch.username) return { ok: true };
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
    const added = (ch.type === "channel" || ch.type === "supergroup")
      && (st === "administrator" || st === "creator")
      && !ch.username;
    if (added) {
      await bindAlertChannel(sql, uid, String(ch.id), token, ch.title ?? ch.username);
      return { ok: true };
    }
    if (kind === "logs") return { ok: true };
  }

  const from = msg?.from ?? cb?.from;
  const chatId = String(msg?.chat.id ?? cb?.message?.chat.id ?? from?.id ?? "");
  if (!chatId || !from) return { ok: true };

  const fwd = msg?.forward_from_chat ?? (msg?.forward_origin?.chat ?? null);
  if (fwd && (fwd.type === "channel" || fwd.type === "supergroup")) {
    if (fwd.username) {
      await tg(token, "sendMessage", {
        chat_id: Number(chatId),
        text: `Это публичный канал @${fwd.username} — для подписки клиентов. Алерты туда не пишем. Перешлите пост из ЗАКРЫТОГО канала отчётов (без @username).`,
      });
      return { ok: true };
    }
    const bound = await bindAlertChannel(sql, uid, String(fwd.id), token, fwd.title ?? fwd.username);
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: "skipped" in bound && bound.skipped
        ? "Это канал подписки клиентов — алерты туда не пишем. Перешлите пост из ДРУГОГО (закрытого) канала для отчётов."
        : `Канал алертов сохранён (${fwd.title ?? fwd.id}). Проверьте ЗАКРЫТЫЙ канал — туда ушёл тест. Публичный канал клиентов больше не получит отчёты.`,
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
  if (cb?.data === "sub:ok") {
    try {
      const cl = await sql<{ referred_by: string | null }>`
        select referred_by from as_clients where user_id = ${uid} and telegram_id = ${chatId} limit 1
      `;
      await trackRefEvent(sql, uid, cl[0]?.referred_by || "", "subscribe", chatId);
    } catch { /* ignore */ }
  }

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
  if (step === "live" && sess[0]?.last_status === "completed") step = "rate";
  let draft: Draft = sess[0]?.draft ? (JSON.parse(sess[0].draft) as Draft) : emptyDraft();
  draft = { ...emptyDraft(), ...draft, name };
  const live = Boolean(sess[0]?.live_order_id) || step === "live";
  const lang = draft.lang === "uz" ? "uz" : "ru";

  if (tapGuess === "cmd:myorders") {
    if (cb?.data) await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
    await sendClientOrders(sql, uid, token, chatId, lang, live);
    return { ok: true };
  }
  if (tapGuess?.startsWith("ord:")) {
    if (cb?.data) await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
    const oid = Number(tapGuess.slice(4));
    if (oid) await sendClientOrderCard(sql, uid, token, chatId, oid, lang, live);
    return { ok: true };
  }
  if (tapGuess === "cmd:balance" || tapGuess === "cmd:mbalance") {
    if (cb?.data) await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
    if (masterExists[0] && (draft.role === "master" || tapGuess === "cmd:mbalance")) {
      await handleMasterMenu(sql, uid, token, chatId, "cmd:mbalance");
      return { ok: true };
    }
    await sendClientBalance(sql, uid, token, chatId, lang, live);
    return { ok: true };
  }
  if (tapGuess === "cmd:reviews") {
    if (cb?.data) await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
    if (masterExists[0] && draft.role === "master") {
      await sendReviews(sql, uid, token, chatId, lang, live, masterExists[0].id);
      return { ok: true };
    }
    await sendReviews(sql, uid, token, chatId, lang, live);
    return { ok: true };
  }
  if (tapGuess === "cmd:support" || tapGuess === "cmd:writeop") {
    if (cb?.data) await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
    if (tapGuess === "cmd:support") {
      await sendOperator(sql, uid, token, chatId, lang, live);
      return { ok: true };
    }
    await sql`
      insert into as_tg_sessions (user_id, chat_id, step, draft, live_order_id, last_status, tg_name, updated_at)
      values (${uid}, ${chatId}, ${"support"}, ${JSON.stringify(draft)}, ${sess[0]?.live_order_id ?? null}, ${sess[0]?.last_status ?? null}, ${name}, now())
      on conflict (user_id, chat_id) do update set step = ${"support"}, draft = ${JSON.stringify(draft)}, tg_name = ${name}, updated_at = now()
    `;
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: lang === "uz"
        ? "Savolingizni yozing — dispatcher siz bilan bog‘lanadi."
        : "Напишите вопрос — диспетчер свяжется с вами.",
      reply_markup: markup(kbClient(lang, live)),
    });
    return { ok: true };
  }
  if (tapGuess === "cmd:pay") {
    if (cb?.data) await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
    const wsPay = await sql<{ pay_card: string | null; pay_bank: string | null; pay_holder: string | null; pay_amount: number }>`
      select pay_card, pay_bank, pay_holder, pay_amount from as_workspace where user_id = ${uid}
    `;
    const p = wsPay[0];
    const amt = Number(p?.pay_amount ?? 0);
    const text = [
      lang === "uz" ? "➕ BALANSNI TO‘LDIRISH" : "➕ ПОПОЛНИТЬ БАЛАНС",
      "",
      amt ? `💵 ${formatSum(amt)}` : "",
      p?.pay_bank ? `🏦 ${p.pay_bank}` : "",
      p?.pay_card ? `💳 ${p.pay_card}` : "",
      p?.pay_holder ? `👤 ${p.pay_holder}` : "",
      "",
      lang === "uz"
        ? "To‘lov chekini rasm qilib yuboring — admin tekshiradi."
        : "Пришлите скрин оплаты фотографией — администратор проверит.",
    ].filter(Boolean).join("\n");
    await tg(token, "sendMessage", {
      chat_id: Number(chatId),
      text: text.trim() || (lang === "uz" ? "To‘lov hozir sozlanmagan." : "Реквизиты пока не настроены в админке."),
      reply_markup: markup([[{ id: "cmd:balance", label: lang === "uz" ? "◀️ Orqaga" : "◀️ Назад" }]]),
    });
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
      text: lang === "uz" ? formatHowTo("uz") : formatHowTo("ru"),
      reply_markup: markup([
        [{ id: "cmd:order", label: lang === "uz" ? "🔧 Usta chaqirish" : "🔧 Вызвать мастера" }],
        [{ id: "cmd:menu", label: lang === "uz" ? "🏠 Bosh menyu" : "🏠 Главное меню" }],
      ]),
    });
    return { ok: true };
  }
  if ((tapGuess === "cmd:menu" || msg?.text === "/start") && !live && draft.role !== "master") {
    if (cb?.data) await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
    try { await persistProfile(sql, uid, chatId, name, draft); } catch { /* ignore */ }
    try {
      await sendHome(sql, uid, token, chatId, name, lang, false);
    } catch {
      await tg(token, "sendMessage", {
        chat_id: Number(chatId),
        text: formatClientHome({ name, city: SERVICE_CITY, balance: 0, lang: lang === "uz" ? "uz" : "ru" }),
        reply_markup: markup(clientMenu(lang === "uz" ? "uz" : "ru")),
      });
    }
    try {
      await sql`
        insert into as_tg_sessions (user_id, chat_id, step, draft, live_order_id, last_status, tg_name, updated_at)
        values (${uid}, ${chatId}, ${"category"}, ${JSON.stringify({ ...draft, photos: [], problem: undefined, serviceId: undefined, comment: undefined })}, ${null}, ${sess[0]?.last_status ?? null}, ${name}, now())
        on conflict (user_id, chat_id) do update set step = ${"category"}, draft = ${JSON.stringify({ ...draft, photos: [], problem: undefined, serviceId: undefined, comment: undefined })}, tg_name = ${name}, updated_at = now()
      `;
    } catch { /* ignore */ }
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
      const distId = DISTRICTS.find((d) => d.title === s.district)?.id
        ?? ((s.lat != null && s.lng != null && isInsideServiceArea(Number(s.lat), Number(s.lng))) ? "bekabad" : draft.districtId);
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
      await trackRefEvent(sql, uid, payload, "start", chatId);
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

  if (msg?.location) {
    const geo = await resolveLocation(msg.location.latitude, msg.location.longitude);
    draft = {
      ...draft,
      lat: geo.lat,
      lng: geo.lng,
      city: geo.inside ? SERVICE_CITY : geo.city,
      neighborhood: geo.inside ? geo.neighborhood : undefined,
      street: geo.inside ? geo.street : undefined,
      fullAddress: geo.inside ? geo.fullAddress : undefined,
      districtId: geo.inside ? "bekabad" : undefined,
    };
    const card = formatGeoCard(geo, lang);
    const geoBtns = geo.inside
      ? [
          [{ id: "geo:ok", label: lang === "uz" ? "✅ Hammasi to‘g‘ri" : "✅ Всё верно" }],
          [{ id: "geo:new", label: lang === "uz" ? "📍 Boshqa lokatsiya" : "📍 Другая локация", requestLocation: true }],
          [{ id: "cmd:menu", label: lang === "uz" ? "◀️ Orqaga" : "◀️ Назад" }],
        ]
      : [
          [{ id: "cmd:menu", label: lang === "uz" ? "🏠 Bosh menyu" : "🏠 Главное меню" }],
        ];
    if (result.replies[0]) result.replies[0] = { ...result.replies[0], text: card, buttons: geoBtns };
    else result.replies.push({ id: "geo-card", from: "bot", text: card, time: "", buttons: geoBtns });
    if (!geo.inside) step = draft.role === "master" ? "master_geo" : "district";
    else if (draft.role !== "master") step = "geo";
  }

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
    const lat = Number(result.submit.lat);
    const lng = Number(result.submit.lng);
    const svc = result.submit.serviceId ? serviceById(result.submit.serviceId) : undefined;
    if (svc && result.submit.problem && result.submit.phone && Number.isFinite(lat) && Number.isFinite(lng)) {
      const sub = await clientMustSubscribe(sql, uid, token, from.id);
      if (sub.block) {
        await sendSubscribePrompt(token, chatId, undefined, sub.url, sub.label);
        return { ok: true };
      }
      try {
        const geo = await resolveLocation(lat, lng);
        if (!geo.inside) {
          await tg(token, "sendMessage", {
            chat_id: Number(chatId),
            text: formatGeoCard(geo, lang === "uz" ? "uz" : "ru"),
            reply_markup: markup(clientMenu(draft.lang)),
          });
          return { ok: true };
        }
        const created = await insertOrder(sql, uid, {
          name,
          phone: result.submit.phone,
          category: svc.id,
          description: result.submit.problem,
          district: geo.neighborhood || geo.district || SERVICE_CITY,
          city: SERVICE_CITY,
          address: geo.fullAddress,
          neighborhood: geo.neighborhood,
          lat,
          lng,
          comment: result.submit.comment,
          photos: result.submit.photos,
          telegramId: chatId,
        });
        await sql`
          insert into as_tg_sessions (user_id, chat_id, step, draft, live_order_id, last_status, tg_name, updated_at)
          values (${uid}, ${chatId}, ${"live"}, ${JSON.stringify(draft)}, ${created.id}, ${"waiting_admin"}, ${name}, now())
          on conflict (user_id, chat_id) do update set step = ${"live"}, draft = ${JSON.stringify(draft)}, live_order_id = ${created.id}, last_status = ${"waiting_admin"}, tg_name = ${name}, updated_at = now()
        `;
        const replyText = [
          lang === "uz" ? "✅ ARIZA YARATILDI" : "✅ ЗАЯВКА СОЗДАНА",
          "",
          `📦 №${created.publicNo}`,
          "",
          lang === "uz" ? "🔧 Xizmat:" : "🔧 Услуга:",
          svcTitle(svc.id, lang === "uz" ? "uz" : "ru"),
          "",
          `📍 ${SERVICE_CITY}`,
          geo.neighborhood ? `📍 ${geo.neighborhood}` : "",
          geo.fullAddress ? `🏠 ${geo.fullAddress}` : "",
          "",
          HR,
          "",
          lang === "uz" ? "🟡 Status:" : "🟡 Статус:",
          "",
          lang === "uz" ? "Usta tayinlanishi kutilmoqda." : "Ожидает назначения мастера.",
          "",
          lang === "uz"
            ? "Dispatcher mos ustani tanlaydi va xabar beradi."
            : "Диспетчер подберёт подходящего мастера\nи сообщит вам после назначения.",
        ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
        await tg(token, "sendMessage", {
          chat_id: Number(chatId),
          text: replyText,
          reply_markup: markup([
            [{ id: `ord:${created.id}`, label: lang === "uz" ? "📦 Arizani ochish" : "📦 Открыть заявку" }],
            [{ id: "cmd:menu", label: lang === "uz" ? "🏠 Bosh menyu" : "🏠 Главное меню" }],
          ]),
        });
      } catch (err) {
        const msgText = err instanceof Error && err.message === "CLIENT_BLOCKED"
          ? "Ваш профиль заблокирован администратором. Новую заявку создать нельзя."
          : err instanceof Error && err.message === OUTSIDE_SERVICE_AREA
            ? (lang === "uz"
              ? "📍 ALL SERVIS hozir faqat Bekobodda ishlaydi."
              : "📍 ALL SERVIS сейчас работает только в городе Бекабад.")
          : formatOpError(lang === "uz" ? "uz" : "ru");
        await tg(token, "sendMessage", {
          chat_id: Number(chatId),
          text: msgText,
          reply_markup: markup([
            [{ id: "cmd:order", label: lang === "uz" ? "🔄 Qayta" : "🔄 Повторить" }],
            [{ id: "cmd:support", label: lang === "uz" ? "📞 Operator" : "📞 Оператор" }],
            [{ id: "cmd:menu", label: lang === "uz" ? "🏠 Bosh menyu" : "🏠 Главное меню" }],
          ]),
        });
      }
      return { ok: true };
    }
  }

  if (result.reviewText) {
    await saveReviewComment(sql, uid, chatId, result.reviewText, sess[0]?.live_order_id);
    step = "category";
    try {
      await sql`
        update as_tg_sessions set live_order_id = ${null}, step = ${"category"}, last_status = ${"completed"}, updated_at = now()
        where user_id = ${uid} and chat_id = ${chatId}
      `;
    } catch { /* ignore */ }
  }

  if (result.supportText) {
    await pushSupportAlert(sql, uid, chatId, {
      name,
      username: from.username,
      text: result.supportText,
      isMaster: Boolean(masterExists[0] && draft.role === "master"),
    });
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
