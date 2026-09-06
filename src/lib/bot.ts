import { DISTRICTS, matchService, serviceById } from "./catalog";
import type { ChatMessage, ChatStep, Draft, KeyboardButton } from "./types";
import { formatPhone, formatSum, isValidUzPhone, nowTime, uid } from "./utils";
import { clientLabel, DISTRICT_COORDS } from "./domain";
import type { OrderStatus } from "./domain";

export const BOT_NAME = "All Servis";
export const BOT_HANDLE = "@AllServisBot";
const STATIC_TIME = "12:40";

const CATEGORY_KEYS: KeyboardButton[][] = [
  [
    { id: "svc:plumb", label: "Сантехник" },
    { id: "svc:elec", label: "Электрик" },
  ],
  [
    { id: "svc:ac", label: "Кондиционер" },
    { id: "svc:appliance", label: "Техника" },
  ],
  [
    { id: "svc:furniture", label: "Мебель" },
    { id: "svc:lock", label: "Замки" },
  ],
  [
    { id: "svc:paint", label: "Маляр" },
    { id: "svc:other", label: "Другое" },
  ],
];

const DISTRICT_KEYS: KeyboardButton[][] = chunk(
  DISTRICTS.map((d) => ({ id: `dist:${d.id}`, label: d.title })),
  2,
);

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function bot(text: string, extra?: Partial<ChatMessage>): ChatMessage {
  return { id: uid("m"), from: "bot", text, time: nowTime(), ...extra };
}
function user(text: string): ChatMessage {
  return { id: uid("m"), from: "user", text, time: nowTime() };
}

export function emptyDraft(): Draft {
  return { photos: [], name: "Клиент" };
}

export function welcomeMessages(): ChatMessage[] {
  return [
    { id: "sys-hello", from: "system", text: "All Servis Bot", time: STATIC_TIME },
    {
      id: "bot-hello",
      from: "bot",
      text: "All Servis — мастер на дом в Ташкенте.\nАдминистратор назначит мастера вручную.\n\nВыберите услугу или напишите, что случилось.",
      time: STATIC_TIME,
      buttons: CATEGORY_KEYS,
    },
  ];
}

export type BotEvent =
  | { type: "text"; text: string }
  | { type: "tap"; id: string; label: string }
  | { type: "photo"; dataUrl: string }
  | { type: "location"; lat: number; lng: number };

export type BotResult = {
  userMessage?: ChatMessage;
  replies: ChatMessage[];
  step: ChatStep;
  draft: Draft;
  submit?: Draft;
  cancelLive?: boolean;
};

function summary(d: Draft): string {
  const svc = d.serviceId ? serviceById(d.serviceId) : undefined;
  const dist = d.districtId ? DISTRICT_COORDS[d.districtId] : undefined;
  const lines = [
    "Проверьте заявку:",
    "",
    `Услуга — ${svc?.title ?? "—"}`,
    `Задача — ${d.problem ?? "—"}`,
    `Район — ${dist?.title ?? "—"}`,
    `Геолокация — ${d.lat?.toFixed(4)}, ${d.lng?.toFixed(4)}`,
    `Телефон — ${d.phone ?? "—"}`,
    `Фото — ${d.photos.length ? d.photos.length + " шт." : "нет"}`,
    `Комментарий — ${d.comment || "нет"}`,
  ];
  if (svc) lines.push(`Выезд — от ${formatSum(svc.from)}`);
  return lines.join("\n");
}

export function reduceBot(step: ChatStep, draft: Draft, event: BotEvent): BotResult {
  if (event.type === "photo") {
    if (step !== "photo") return { replies: [], step, draft };
    const photos = [...draft.photos, event.dataUrl].slice(0, 3);
    return {
      userMessage: user("Фото прикреплено"),
      replies: [
        bot(
          photos.length >= 3
            ? "Три фото достаточно. Укажите район — так мы передадим геолокацию администратору."
            : "Фото получил. Ещё одно или перейдите к геолокации.",
          {
            buttons:
              photos.length >= 3
                ? DISTRICT_KEYS
                : [[{ id: "photo:skip", label: "Дальше — геолокация" }], ...DISTRICT_KEYS],
          },
        ),
      ],
      step: photos.length >= 3 ? "district" : "photo",
      draft: { ...draft, photos },
    };
  }

  if (event.type === "location") {
    let distId = draft.districtId;
    if (!distId) {
      let best = DISTRICTS[0]!;
      let bestD = Infinity;
      for (const d of DISTRICTS) {
        const dx = d.lat - event.lat;
        const dy = d.lng - event.lng;
        const dist = dx * dx + dy * dy;
        if (dist < bestD) {
          bestD = dist;
          best = d;
        }
      }
      distId = best.id;
    }
    return {
      userMessage: user("Геолокация получена"),
      replies: [bot("Точка на карте записана. Оставьте номер телефона.")],
      step: "phone",
      draft: { ...draft, lat: event.lat, lng: event.lng, districtId: distId },
    };
  }

  const raw = event.type === "text" ? event.text.trim() : event.type === "tap" ? event.label : "";
  const tapId = event.type === "tap" ? event.id : "";
  const lower = raw.toLowerCase();

  if (lower === "/start" || tapId === "cmd:start") {
    return {
      userMessage: user("/start"),
      replies: welcomeMessages().filter((m) => m.from !== "system"),
      step: "category",
      draft: emptyDraft(),
    };
  }
  if (lower === "/help" || tapId === "cmd:help") {
    return {
      userMessage: user("Помощь"),
      replies: [
        bot(
          "Заявка идёт администратору All Servis. Мастера система сама не выбирает.\n\n/start — новая заявка\n/cancel — отменить черновик",
        ),
      ],
      step,
      draft,
    };
  }
  if (lower === "/cancel" || tapId === "cmd:cancel") {
    if (step === "live") {
      return {
        userMessage: user("Отменить заявку"),
        replies: [bot("Заявка будет отменена администратором. Напишите /start для новой.")],
        step: "live",
        draft,
        cancelLive: true,
      };
    }
    return {
      userMessage: user("Отменить"),
      replies: [bot("Черновик сброшен. Выберите услугу.", { buttons: CATEGORY_KEYS })],
      step: "category",
      draft: emptyDraft(),
    };
  }

  if (tapId.startsWith("rate:")) {
    return {
      userMessage: user(`${tapId.slice(5)} из 5`),
      replies: [
        bot("Спасибо. Оценка ушла администратору.", {
          buttons: [[{ id: "cmd:start", label: "Новая заявка" }]],
        }),
      ],
      step: "idle",
      draft: emptyDraft(),
    };
  }

  if (step === "category") {
    const svc = tapId.startsWith("svc:") ? serviceById(tapId.slice(4)) : matchService(raw);
    const userMessage = user(svc?.title ?? raw);
    if (!svc) {
      return {
        userMessage,
        replies: [
          bot("Нажмите кнопку или напишите, например: «течёт кран».", { buttons: CATEGORY_KEYS }),
        ],
        step: "category",
        draft,
      };
    }
    return {
      userMessage,
      replies: [bot(`${svc.title}. Коротко опишите проблему.`)],
      step: "problem",
      draft: { ...emptyDraft(), serviceId: svc.id },
    };
  }

  if (step === "problem") {
    const problem = raw.slice(0, 400);
    if (problem.length < 4) {
      return {
        userMessage: user(raw),
        replies: [bot("Нужно чуть конкретнее — что случилось и где.")],
        step: "problem",
        draft,
      };
    }
    return {
      userMessage: user(problem),
      replies: [
        bot("Пришлите фото поломки или пропустите — без фото тоже примем.", {
          buttons: [[{ id: "photo:skip", label: "Пропустить фото" }]],
        }),
      ],
      step: "photo",
      draft: { ...draft, problem },
    };
  }

  if (step === "photo") {
    if (tapId === "photo:skip" || lower.includes("пропуст")) {
      return {
        userMessage: user("Пропустить фото"),
        replies: [
          bot("Укажите район Ташкента — это и будет геолокация заявки.", { buttons: DISTRICT_KEYS }),
        ],
        step: "district",
        draft,
      };
    }
    return {
      userMessage: user(raw),
      replies: [
        bot("Нажмите скрепку, чтобы прикрепить фото, или пропустите шаг.", {
          buttons: [[{ id: "photo:skip", label: "Пропустить фото" }]],
        }),
      ],
      step: "photo",
      draft,
    };
  }

  if (step === "district") {
    const dist = tapId.startsWith("dist:")
      ? DISTRICTS.find((d) => d.id === tapId.slice(5))
      : DISTRICTS.find((d) => d.title.toLowerCase() === lower);
    const userMessage = user(dist?.title ?? raw);
    if (!dist) {
      return {
        userMessage,
        replies: [bot("Выберите район кнопкой — так передадим координаты.", { buttons: DISTRICT_KEYS })],
        step: "district",
        draft,
      };
    }
    return {
      userMessage,
      replies: [bot(`${dist.title}. Координаты записаны.\nОставьте номер телефона.`)],
      step: "phone",
      draft: { ...draft, districtId: dist.id, lat: dist.lat, lng: dist.lng },
    };
  }

  if (step === "phone") {
    const userMessage = user(raw);
    if (!isValidUzPhone(raw)) {
      return {
        userMessage,
        replies: [bot("Нужен номер: +998 90 123 45 67 или 90 123 45 67.")],
        step: "phone",
        draft,
      };
    }
    return {
      userMessage,
      replies: [
        bot("Комментарий для мастера — или пропустите.", {
          buttons: [[{ id: "cmt:skip", label: "Без комментария" }]],
        }),
      ],
      step: "comment",
      draft: { ...draft, phone: formatPhone(raw) },
    };
  }

  if (step === "comment") {
    const comment = tapId === "cmt:skip" || lower.includes("без коммент") ? "" : raw.slice(0, 240);
    const next = { ...draft, comment };
    return {
      userMessage: user(comment || "Без комментария"),
      replies: [
        bot(summary(next), {
          kind: "order",
          buttons: [
            [
              { id: "confirm:yes", label: "Подтвердить" },
              { id: "confirm:no", label: "Изменить" },
            ],
          ],
        }),
      ],
      step: "confirm",
      draft: next,
    };
  }

  if (step === "confirm") {
    if (tapId === "confirm:no" || lower.includes("измен")) {
      return {
        userMessage: user("Изменить"),
        replies: [bot("Начнём заново. Выберите услугу.", { buttons: CATEGORY_KEYS })],
        step: "category",
        draft: emptyDraft(),
      };
    }
    if (tapId === "confirm:yes" || lower.includes("подтвер")) {
      if (!draft.serviceId || !draft.problem || !draft.phone || !draft.districtId) {
        return {
          userMessage: user(raw),
          replies: [bot("Данных не хватает. /start")],
          step: "category",
          draft: emptyDraft(),
        };
      }
      return {
        userMessage: user("Подтвердить"),
        replies: [],
        step: "live",
        draft,
        submit: draft,
      };
    }
    return {
      userMessage: user(raw),
      replies: [
        bot("Нажмите «Подтвердить» или «Изменить».", {
          buttons: [
            [
              { id: "confirm:yes", label: "Подтвердить" },
              { id: "confirm:no", label: "Изменить" },
            ],
          ],
        }),
      ],
      step: "confirm",
      draft,
    };
  }

  if (step === "live") {
    return {
      userMessage: user(raw),
      replies: [bot("Заявка уже у администратора. Статус придёт сюда сам. /start — новая.")],
      step: "live",
      draft,
    };
  }

  const svc = matchService(raw);
  if (svc) {
    return {
      userMessage: user(svc.title),
      replies: [bot(`${svc.title}. Коротко опишите проблему.`)],
      step: "problem",
      draft: { ...emptyDraft(), serviceId: svc.id },
    };
  }
  return {
    userMessage: user(raw),
    replies: [bot("Чтобы вызвать мастера — /start или кнопка услуги.", { buttons: CATEGORY_KEYS })],
    step: "category",
    draft: emptyDraft(),
  };
}

export function statusReply(status: OrderStatus, masterName?: string | null): ChatMessage {
  const extra = masterName ? `\n\nМастер: ${masterName}` : "";
  const buttons =
    status === "completed"
      ? [
          [
            { id: "rate:5", label: "5 — отлично" },
            { id: "rate:4", label: "4" },
          ],
          [
            { id: "rate:3", label: "3" },
            { id: "rate:2", label: "2" },
          ],
        ]
      : status === "master_rejected" || status === "cancelled"
        ? [[{ id: "cmd:start", label: "Новая заявка" }]]
        : undefined;
  return bot(clientLabel(status) + extra, { kind: "status", masterName: masterName ?? undefined, buttons });
}
