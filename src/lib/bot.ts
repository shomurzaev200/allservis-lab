import { DISTRICTS, matchService, serviceById, type ServiceId } from "./catalog";
import type { ChatMessage, ChatStep, Draft, KeyboardButton, Lang, UserRole } from "./types";
import { formatPhone, formatSum, isValidUzPhone, nowTime, uid } from "./utils";
import { clientLabel, DISTRICT_COORDS } from "./domain";
import type { OrderStatus } from "./domain";

export const BOT_NAME = "All Servis";
export const BOT_HANDLE = "@AllServisBot";
const STATIC_TIME = "12:40";

type Dict = Record<string, string>;

const RU: Dict = {
  pickLang: "All Servis — мастер на дом в Ташкенте.\nВыберите язык / Tilni tanlang.",
  pickRole: "Кто вы?",
  client: "Я клиент",
  master: "Я мастер",
  welcome:
    "Заявку видит администратор. Мастера система сама не назначает.\nВыберите услугу или напишите, что случилось.",
  help: "🛠 Вызвать мастера — заявка\n📋 Мои заявки — статус\n👤 Профиль — данные и ссылка\n💬 Поддержка — диспетчер",
  cancelDraft: "Черновик сброшен.",
  needService: "Нажмите кнопку или напишите, например: «течёт кран».",
  describe: "Коротко опишите проблему.",
  moreDetail: "Нужно чуть конкретнее — что случилось и где.",
  sendPhoto: "Пришлите фото поломки или пропустите — без фото тоже примем.",
  skipPhoto: "Пропустить фото",
  morePhoto: "Фото получил. Ещё одно или отправьте геолокацию.",
  enoughPhoto: "Три фото достаточно. Отправьте геолокацию или выберите район.",
  askGeo: "Отправьте точку на карте кнопкой или выберите район.",
  shareGeo: "📍 Отправить геолокацию",
  geoOk: "Геолокация записана. Отправьте номер телефона кнопкой.",
  districtOk: "Район записан. Теперь точная геолокация — или сразу номер.",
  skipGeo: "Района достаточно",
  keepGeo: "✅ Не менять локацию",
  newGeo: "📍 Отправить новую",
  askKeepGeo: "Локация с прошлого раза. Отправить новую точку или не менять?",
  pickDistrict: "Выберите район или нажмите «Отправить геолокацию».",
  sharePhone: "📱 Отправить номер",
  needPhone: "Нажмите «Отправить номер» или введите +998 90 123 45 67.",
  commentAsk: "Комментарий для мастера — или пропустите.",
  skipComment: "Без комментария",
  confirm: "Подтвердить",
  change: "Изменить",
  confirmHint: "Нажмите «Подтвердить» или «Изменить».",
  restart: "Начнём заново. Выберите услугу.",
  missing: "Данных не хватает. /start",
  live: "Заявка у диспетчера. Статус придёт сюда.",
  startHint: "Чтобы вызвать мастера — нажмите «Вызвать мастера».",
  thanksRate: "Спасибо. Оценка ушла администратору.",
  askReview: "Можете написать отзыв текстом или нажать меню.",
  reviewSaved: "Отзыв сохранён. Спасибо!",
  newOrder: "Новая заявка",
  menu: "Меню",
  masterSpec: "Какая специальность?",
  masterPhone: "Отправьте номер — по нему с вами свяжется диспетчер.",
  masterGeo: "Отправьте геолокацию — так вы отобразитесь на карте.",
  masterDone: "Профиль мастера сохранён. Онлайн/офлайн — кнопками. Админ видит вас в панели.",
  goOnline: "Я онлайн",
  goOffline: "Я офлайн",
  nowOnline: "Вы на линии. Новые назначения придут сюда.",
  nowOffline: "Вы офлайн. Заявки не будут предлагать в первую очередь.",
};

const UZ: Dict = {
  pickLang: "All Servis — Toshkentda uyga usta.\nTilni tanlang / Выберите язык.",
  pickRole: "Siz kimsiz?",
  client: "Men mijozman",
  master: "Men ustaman",
  welcome:
    "Arizani administrator ko‘radi. Tizim ustani o‘zi tayinlamaydi.\nXizmatni tanlang yoki nima bo‘lganini yozing.",
  help: "🛠 Usta chaqirish — ariza\n📋 Arizalarim — status\n👤 Profil — ma’lumot va havola\n💬 Yordam — dispatcher",
  cancelDraft: "Qoralama tozalandi.",
  needService: "Tugmani bosing yoki yozing, masalan: «kran oqayapti».",
  describe: "Muammoni qisqa yozing.",
  moreDetail: "Aniqroq yozing — nima bo‘ldi va qayerda.",
  sendPhoto: "Buzilish fotosini yuboring yoki o‘tkazing.",
  skipPhoto: "Fotosiz davom etish",
  morePhoto: "Foto oldim. Yana yuboring yoki geolokatsiya.",
  enoughPhoto: "Uchta foto yetarli. Geolokatsiya yoki tuman.",
  askGeo: "Xaritadan nuqta yuboring yoki tumanni tanlang.",
  shareGeo: "📍 Geolokatsiya yuborish",
  geoOk: "Joylashuv yozildi. Telefon raqamini tugma orqali yuboring.",
  districtOk: "Tuman yozildi. Endi aniq geolokatsiya — yoki raqam.",
  skipGeo: "Tuman yetarli",
  keepGeo: "✅ O‘zgartirmaslik",
  newGeo: "📍 Yangi lokatsiya",
  askKeepGeo: "Oxirgi lokatsiya saqlangan. Yangisini yuborasizmi yoki qoldiramizmi?",
  pickDistrict: "Tumanni tanlang yoki geolokatsiya yuboring.",
  sharePhone: "📱 Raqamni yuborish",
  needPhone: "«Raqamni yuborish» ni bosing yoki +998 90 123 45 67 yozing.",
  commentAsk: "Usta uchun izoh — yoki o‘tkazing.",
  skipComment: "Izohsiz",
  confirm: "Tasdiqlash",
  change: "O‘zgartirish",
  confirmHint: "«Tasdiqlash» yoki «O‘zgartirish».",
  restart: "Qaytadan. Xizmatni tanlang.",
  missing: "Ma’lumot yetarli emas. /start",
  live: "Ariza dispatcherga ketdi. Status shu yerga keladi.",
  startHint: "Usta chaqirish uchun «Usta chaqirish» ni bosing.",
  thanksRate: "Rahmat. Baholash adminga ketdi.",
  askReview: "Matnli izoh yozishingiz yoki menyuni bosishingiz mumkin.",
  reviewSaved: "Izoh saqlandi. Rahmat!",
  newOrder: "Yangi ariza",
  menu: "Menyu",
  masterSpec: "Mutaxassislik?",
  masterPhone: "Raqamingizni yuboring — dispatcher shu orqali bog‘lanadi.",
  masterGeo: "Geolokatsiya yuboring — xaritada ko‘rinasiz.",
  masterDone: "Usta profili saqlandi. Onlayn/oflayn — tugmalar. Admin sizni panelda ko‘radi.",
  goOnline: "Men onlaynman",
  goOffline: "Men oflaynman",
  nowOnline: "Siz liniyadasiz. Yangi buyurtmalar shu yerga keladi.",
  nowOffline: "Siz oflaynsiz.",
};

function t(lang: Lang | undefined, key: keyof typeof RU): string {
  return (lang === "uz" ? UZ : RU)[key] ?? RU[key];
}

const SVC_UZ: Record<string, string> = {
  plumb: "Santexnik",
  elec: "Elektrik",
  ac: "Konditsioner",
  appliance: "Texnika",
  furniture: "Mebel",
  lock: "Qulflar",
  paint: "Bo‘yoqchi",
  other: "Boshqa",
};

const DIST_UZ: Record<string, string> = {
  chilanzar: "Chilonzor",
  yunusabad: "Yunusobod",
  mirzo: "Mirzo Ulug‘bek",
  yakkasaray: "Yakkasaroy",
  mirabad: "Mirobod",
  shayhantahur: "Shayxontohur",
  almazar: "Olmazor",
  uchtepa: "Uchtepa",
  sergeli: "Sergeli",
  yashnabad: "Yashnobod",
  bektemir: "Bektemir",
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function categoryKeys(lang: Lang | undefined): KeyboardButton[][] {
  const label = (id: ServiceId) => (lang === "uz" ? SVC_UZ[id] : serviceById(id)!.title);
  return [
    [
      { id: "svc:plumb", label: label("plumb") },
      { id: "svc:elec", label: label("elec") },
    ],
    [
      { id: "svc:ac", label: label("ac") },
      { id: "svc:appliance", label: label("appliance") },
    ],
    [
      { id: "svc:furniture", label: label("furniture") },
      { id: "svc:lock", label: label("lock") },
    ],
    [
      { id: "svc:paint", label: label("paint") },
      { id: "svc:other", label: label("other") },
    ],
  ];
}

function districtKeys(lang: Lang | undefined): KeyboardButton[][] {
  return chunk(
    DISTRICTS.map((d) => ({
      id: `dist:${d.id}`,
      label: lang === "uz" ? (DIST_UZ[d.id] ?? d.title) : d.title,
    })),
    2,
  );
}

function geoKeys(lang: Lang | undefined): KeyboardButton[][] {
  return [[{ id: "geo:share", label: t(lang, "shareGeo"), requestLocation: true }], ...districtKeys(lang)];
}

function keepGeoKeys(lang: Lang | undefined): KeyboardButton[][] {
  return [
    [{ id: "geo:keep", label: t(lang, "keepGeo") }],
    [{ id: "geo:new", label: t(lang, "newGeo"), requestLocation: true }],
  ];
}

function geoPrompt(draft: Draft, lang: Lang | undefined): string {
  const dist = draft.districtId
    ? (lang === "uz" ? (DIST_UZ[draft.districtId] ?? districtTitle(draft.districtId)) : districtTitle(draft.districtId))
    : "";
  const lat = Number(draft.lat);
  const lng = Number(draft.lng);
  const geo = Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "";
  const where = [dist, geo].filter(Boolean).join(" · ");
  return where ? `${t(lang, "askKeepGeo")}\n${where}` : t(lang, "askKeepGeo");
}

function districtTitle(id: string) {
  return DISTRICTS.find((d) => d.id === id)?.title ?? id;
}

function afterKeepGeo(draft: Draft, lang: Lang | undefined, userMessage: ChatMessage): BotResult {
  if (draft.phone) {
    return {
      userMessage,
      replies: [bot(t(lang, "commentAsk"), { buttons: [[{ id: "cmt:skip", label: t(lang, "skipComment") }]] })],
      step: "comment",
      draft,
    };
  }
  return {
    userMessage,
    replies: [bot(t(lang, "needPhone"), { buttons: phoneKeys(lang) })],
    step: "phone",
    draft,
  };
}

function afterPhotos(draft: Draft, lang: Lang | undefined, userMessage: ChatMessage): BotResult {
  if (draft.lat != null && draft.lng != null && Number.isFinite(Number(draft.lat)) && Number.isFinite(Number(draft.lng))) {
    return {
      userMessage,
      replies: [bot(geoPrompt(draft, lang), { buttons: keepGeoKeys(lang) })],
      step: "geo_choice",
      draft,
    };
  }
  return {
    userMessage,
    replies: [bot(t(lang, "askGeo"), { buttons: geoKeys(lang) })],
    step: "district",
    draft,
  };
}

function phoneKeys(lang: Lang | undefined): KeyboardButton[][] {
  return [[{ id: "phone:share", label: t(lang, "sharePhone"), requestContact: true }]];
}

function roleKeys(lang: Lang | undefined): KeyboardButton[][] {
  return [
    [
      { id: "role:client", label: t(lang, "client") },
      { id: "role:master", label: t(lang, "master") },
    ],
  ];
}

function masterMenuKeys(lang: Lang | undefined, online = true): KeyboardButton[][] {
  if (lang === "uz") {
    return [
      [{ id: "cmd:jobs", label: "⚡ Buyurtmalar" }, { id: online ? "online:off" : "online:on", label: online ? "🟢 Onlayn" : "⚪️ Oflayn" }],
      [{ id: "cmd:loc", label: "📍 Lokatsiya" }, { id: "cmd:active", label: "📦 Faol" }],
      [{ id: "cmd:profile", label: "👤 Profil" }, { id: "cmd:stats", label: "📊 Statistika" }],
      [{ id: "cmd:ref", label: "👥 Do‘stlar" }, { id: "cmd:help", label: "🆘 Yordam" }],
      [{ id: "role:client", label: "👤 Mijoz" }, { id: "cmd:cancel", label: "❌ Bekor" }],
    ];
  }
  return [
    [{ id: "cmd:jobs", label: "⚡ Заказы" }, { id: online ? "online:off" : "online:on", label: online ? "🟢 На линии" : "⚪️ Офлайн" }],
    [{ id: "cmd:loc", label: "📍 Локация" }, { id: "cmd:active", label: "📦 Активные" }],
    [{ id: "cmd:profile", label: "👤 Профиль" }, { id: "cmd:stats", label: "📊 Статистика" }],
    [{ id: "cmd:ref", label: "👥 Друзья" }, { id: "cmd:help", label: "🆘 Помощь" }],
    [{ id: "role:client", label: "👤 Клиент" }, { id: "cmd:cancel", label: "❌ Отмена" }],
  ];
}

function categoryPickKeys(lang: Lang | undefined): KeyboardButton[][] {
  return [
    ...categoryKeys(lang),
    [{ id: "cmd:menu", label: lang === "uz" ? "◀️ Menyuga" : "◀️ В меню" }],
  ];
}

function liveMenuKeys(lang: Lang | undefined): KeyboardButton[][] {
  if (lang === "uz") {
    return [
      [{ id: "cmd:myorders", label: "📋 Arizam" }],
      [{ id: "cmd:profile", label: "👤 Profil" }, { id: "cmd:support", label: "💬 Yordam" }],
      [{ id: "cmd:cancel", label: "❌ Bekor qilish" }],
    ];
  }
  return [
    [{ id: "cmd:myorders", label: "📋 Моя заявка" }],
    [{ id: "cmd:profile", label: "👤 Профиль" }, { id: "cmd:support", label: "💬 Поддержка" }],
    [{ id: "cmd:cancel", label: "❌ Отменить заявку" }],
  ];
}

function clientMenuKeys(lang: Lang | undefined): KeyboardButton[][] {
  if (lang === "uz") {
    return [
      [{ id: "cmd:order", label: "🛠 Usta chaqirish" }],
      [{ id: "cmd:myorders", label: "📋 Arizalarim" }, { id: "cmd:profile", label: "👤 Profil" }],
      [{ id: "cmd:ref", label: "👥 Do‘stlar" }, { id: "cmd:support", label: "💬 Yordam" }],
    ];
  }
  return [
    [{ id: "cmd:order", label: "🛠 Вызвать мастера" }],
    [{ id: "cmd:myorders", label: "📋 Мои заявки" }, { id: "cmd:profile", label: "👤 Профиль" }],
    [{ id: "cmd:ref", label: "👥 Друзья" }, { id: "cmd:support", label: "💬 Поддержка" }],
  ];
}

function bot(text: string, extra?: Partial<ChatMessage>): ChatMessage {
  return { id: uid("m"), from: "bot", text, time: nowTime(), ...extra };
}
function user(text: string): ChatMessage {
  return { id: uid("m"), from: "user", text, time: nowTime() };
}

export function emptyDraft(): Draft {
  return { photos: [], name: "Клиент", lang: "ru", role: "client" };
}

export function welcomeMessages(): ChatMessage[] {
  return [
    { id: "sys-hello", from: "system", text: "All Servis Bot", time: STATIC_TIME },
    {
      id: "bot-hello",
      from: "bot",
      text: RU.pickLang,
      time: STATIC_TIME,
      buttons: [
        [
          { id: "lang:ru", label: "Русский" },
          { id: "lang:uz", label: "O‘zbekcha" },
        ],
      ],
    },
  ];
}

export type BotEvent =
  | { type: "text"; text: string }
  | { type: "tap"; id: string; label: string }
  | { type: "photo"; dataUrl: string }
  | { type: "location"; lat: number; lng: number }
  | { type: "contact"; phone: string };

export type BotResult = {
  userMessage?: ChatMessage;
  replies: ChatMessage[];
  step: ChatStep;
  draft: Draft;
  submit?: Draft;
  cancelLive?: boolean;
  registerMaster?: boolean;
  setOnline?: boolean;
  supportText?: string;
  reviewText?: string;
};

function nearestDistrict(lat: number, lng: number) {
  let best = DISTRICTS[0]!;
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dx = d.lat - lat;
    const dy = d.lng - lng;
    const dist = dx * dx + dy * dy;
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}

function applyLocation(draft: Draft, lat: number, lng: number): Draft {
  const distId = draft.districtId ?? nearestDistrict(lat, lng).id;
  return { ...draft, lat, lng, districtId: distId };
}

function summary(d: Draft): string {
  const lang = d.lang;
  const svc = d.serviceId ? serviceById(d.serviceId) : undefined;
  const dist = d.districtId ? DISTRICT_COORDS[d.districtId] : undefined;
  const svcTitle = svc ? (lang === "uz" ? SVC_UZ[svc.id] : svc.title) : "—";
  const distTitle = dist ? (lang === "uz" ? DIST_UZ[d.districtId!] ?? dist.title : dist.title) : "—";
  const lines =
    lang === "uz"
      ? [
          "Arizani tekshiring:",
          "",
          `Xizmat — ${svcTitle}`,
          `Muammo — ${d.problem ?? "—"}`,
          `Tuman — ${distTitle}`,
          `Geo — ${d.lat?.toFixed(5)}, ${d.lng?.toFixed(5)}`,
          `Tel — ${d.phone ?? "—"}`,
          `Foto — ${d.photos.length ? d.photos.length + " ta" : "yo‘q"}`,
          `Izoh — ${d.comment || "yo‘q"}`,
        ]
      : [
          "Проверьте заявку:",
          "",
          `Услуга — ${svcTitle}`,
          `Задача — ${d.problem ?? "—"}`,
          `Район — ${distTitle}`,
          `Геолокация — ${d.lat?.toFixed(5)}, ${d.lng?.toFixed(5)}`,
          `Телефон — ${d.phone ?? "—"}`,
          `Фото — ${d.photos.length ? d.photos.length + " шт." : "нет"}`,
          `Комментарий — ${d.comment || "нет"}`,
        ];
  if (svc) lines.push(lang === "uz" ? `Chaqiruv — ${formatSum(svc.from)} dan` : `Выезд — от ${formatSum(svc.from)}`);
  return lines.join("\n");
}

function fold(s: string) {
  return s
    .toLowerCase()
    .replace(/[‘’ʻʼ`']/g, "'")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function allMenuRows(lang: Lang): KeyboardButton[][] {
  return [
    ...clientMenuKeys(lang),
    ...categoryPickKeys(lang),
    ...liveMenuKeys(lang),
    ...masterMenuKeys(lang, true),
    ...masterMenuKeys(lang, false),
    ...roleKeys(lang),
  ];
}

export function labelToTapId(raw: string): string | null {
  const q = fold(raw);
  if (!q) return null;
  if (q === "русский") return "lang:ru";
  if (q.includes("zbek")) return "lang:uz";
  if (q === fold(RU.client) || q === fold(UZ.client)) return "role:client";
  if (q === fold(RU.master) || q === fold(UZ.master)) return "role:master";
  for (const lang of ["ru", "uz"] as Lang[]) {
    for (const row of allMenuRows(lang)) {
      for (const b of row) if (fold(b.label) === q) return b.id;
    }
    for (const row of keepGeoKeys(lang)) {
      for (const b of row) if (fold(b.label) === q) return b.id;
    }
    for (const row of districtKeys(lang)) {
      for (const b of row) if (fold(b.label) === q) return b.id;
    }
  }
  if (q === fold(RU.skipPhoto) || q === fold(UZ.skipPhoto) || q.includes("пропуст") || q.includes("fotosiz")) return "photo:skip";
  if (q === fold(RU.keepGeo) || q === fold(UZ.keepGeo) || q.includes("не менять") || q.includes("zgartirmas")) return "geo:keep";
  if (q === fold(RU.newGeo) || q === fold(UZ.newGeo) || q.includes("новую") || q.includes("yangi lokatsiya")) return "geo:new";
  if (q === fold(RU.skipGeo) || q === fold(UZ.skipGeo)) return "geo:skip";
  if (q === fold(RU.skipComment) || q === fold(UZ.skipComment) || q.includes("изохсиз")) return "cmt:skip";
  if (q === fold(RU.confirm) || q === "подтвердить" || q === "tasdiqlash") return "confirm:yes";
  if (q === fold(RU.change) || q.includes("измен") || q.includes("zgartir")) return "confirm:no";
  if (q === fold(RU.goOnline) || q === "я онлайн" || q.includes("onlaynman") || q.includes("на линии")) return "online:on";
  if (q === fold(RU.goOffline) || q === "я офлайн" || q.includes("oflayn") || q.includes("офлайн")) return "online:off";
  if (q.includes("вызвать") || q.includes("chaqirish") || q === "услуги" || q === "xizmat") return "cmd:order";
  if (q.includes("доступн") || q.startsWith("⚡") || q.includes("buyurtma")) return "cmd:jobs";
  if (q.includes("локац") || q.includes("lokatsiya")) return "cmd:loc";
  if (q.includes("профиль") || q.includes("profil") || q.includes("баланс")) return "cmd:profile";
  if (q.includes("заявк") || q.includes("ariza")) return "cmd:myorders";
  if (q.includes("активн") || q.includes("faol")) return "cmd:active";
  if (q.includes("статисти") || q.includes("statistika")) return "cmd:stats";
  if (q.includes("помощ") || q.includes("yordam") || q === "/help" || q.includes("поддерж") || q === "оператор" || q === "operator") return "cmd:support";
  if (q.includes("друз") || q.includes("do'st") || q.includes("dostlar") || q.includes("реферал") || q === "/ref") return "cmd:ref";
  if (q.includes("язык") || q === "til" || q === "/lang") return "cmd:lang";
  if (q.includes("меню") || q.includes("menyu") || q.includes("назад")) return "cmd:menu";
  if (q.includes("режим клиента") || q.includes("mijoz rejim") || q === "клиент") return "role:client";
  if (q.includes("стать мастером") || q.includes("usta bo") || q === "мастер") return "role:master";
  if (q.includes("новая заявка") || q.includes("yangi ariza") || q === fold(RU.newOrder) || q === fold(UZ.newOrder)) return "cmd:start";
  if (q === fold(RU.menu) || q === fold(UZ.menu)) return "cmd:menu";
  if (q.includes("отмен") || q.includes("bekor") || q === "/cancel") return "cmd:cancel";
  return null;
}

export function reduceBot(step: ChatStep, draft: Draft, event: BotEvent): BotResult {
  const lang = draft.lang ?? "ru";

  if (event.type === "text") {
    const mapped = labelToTapId(event.text);
    if (mapped) event = { type: "tap", id: mapped, label: event.text };
  }

  if (event.type === "contact") {
    const phone = formatPhone(event.phone);
    if (!isValidUzPhone(event.phone) && event.phone.replace(/\D/g, "").length < 8) {
      return {
        userMessage: user(event.phone),
        replies: [bot(t(lang, "needPhone"), { buttons: phoneKeys(lang) })],
        step: step === "master_phone" ? "master_phone" : "phone",
        draft,
      };
    }
    if (step === "master_phone" || step === "master_geo" || (draft.role === "master" && step !== "category")) {
      return {
        userMessage: user(phone),
        replies: [bot(t(lang, "masterGeo"), { buttons: [[{ id: "geo:share", label: t(lang, "shareGeo"), requestLocation: true }]] })],
        step: "master_geo",
        draft: { ...draft, phone },
      };
    }
    return {
      userMessage: user(phone),
      replies: [bot(t(lang, "commentAsk"), { buttons: [[{ id: "cmt:skip", label: t(lang, "skipComment") }]] })],
      step: "comment",
      draft: { ...draft, phone },
    };
  }

  if (event.type === "photo") {
    if (step !== "photo") return { replies: [], step, draft };
    const photos = [...draft.photos, event.dataUrl].slice(0, 3);
    if (photos.length >= 3) {
      return afterPhotos({ ...draft, photos }, lang, user("📷"));
    }
    return {
      userMessage: user("📷"),
      replies: [
        bot(t(lang, "morePhoto"), {
          buttons: [[{ id: "photo:skip", label: t(lang, "skipPhoto") }]],
        }),
      ],
      step: "photo",
      draft: { ...draft, photos },
    };
  }

  if (event.type === "location") {
    const next = applyLocation(draft, event.lat, event.lng);
    if (step === "master_geo" || (draft.role === "master" && (step === "master_phone" || step === "master_geo"))) {
      return {
        userMessage: user("📍"),
        replies: [bot(t(lang, "masterDone"), { buttons: masterMenuKeys(lang) })],
        step: "idle",
        draft: next,
        registerMaster: true,
      };
    }
    return afterKeepGeo(next, lang, user("📍"));
  }

  const raw = event.type === "text" ? event.text.trim() : event.type === "tap" ? event.label : "";
  const tapId = event.type === "tap" ? event.id : "";
  const lower = raw.toLowerCase();

  if (lower === "/lang" || tapId === "cmd:lang") {
    return {
      userMessage: user("/lang"),
      replies: [
        bot(t(lang, "pickLang"), {
          buttons: [
            [
              { id: "lang:ru", label: "Русский" },
              { id: "lang:uz", label: "O‘zbekcha" },
            ],
          ],
        }),
      ],
      step: "lang",
      draft,
    };
  }

  if (lower === "/start" || tapId === "cmd:start") {
    if (step === "live") {
      return {
        userMessage: user("/start"),
        replies: [bot(t(lang, "live"), { buttons: liveMenuKeys(lang) })],
        step: "live",
        draft,
      };
    }
    const registered = !!(draft.phone && draft.lat && draft.lang);
    if (registered) {
      return {
        userMessage: user("/start"),
        replies: [bot(t(lang, "welcome"), { buttons: clientMenuKeys(lang) })],
        step: "category",
        draft: { ...draft, photos: [], problem: undefined, serviceId: undefined, comment: undefined, role: "client" },
      };
    }
    return {
      userMessage: user("/start"),
      replies: [
        bot(t(lang, "pickLang"), {
          buttons: [
            [
              { id: "lang:ru", label: "Русский" },
              { id: "lang:uz", label: "O‘zbekcha" },
            ],
          ],
        }),
      ],
      step: "lang",
      draft: { ...emptyDraft(), name: draft.name, lang, phone: draft.phone, lat: draft.lat, lng: draft.lng, districtId: draft.districtId },
    };
  }

  if (tapId === "lang:ru" || tapId === "lang:uz" || lower === "русский" || lower.includes("zbek")) {
    const nextLang: Lang = tapId === "lang:uz" || lower.includes("zbek") ? "uz" : "ru";
    const d = { ...draft, lang: nextLang };
    if (step === "live") {
      return {
        userMessage: user(nextLang === "uz" ? "O‘zbekcha" : "Русский"),
        replies: [bot(t(nextLang, "live"), { buttons: liveMenuKeys(nextLang) })],
        step: "live",
        draft: d,
      };
    }
    return {
      userMessage: user(nextLang === "uz" ? "O‘zbekcha" : "Русский"),
      replies: [bot(t(nextLang, "pickRole"), { buttons: roleKeys(nextLang) })],
      step: "role",
      draft: d,
    };
  }

  if (tapId === "role:client" || tapId === "role:master" || lower === t(lang, "client").toLowerCase() || lower === t(lang, "master").toLowerCase()) {
    const role: UserRole = tapId === "role:master" || lower === t(lang, "master").toLowerCase() ? "master" : "client";
    const d = { ...draft, role };
    if (role === "master") {
      return {
        userMessage: user(t(lang, "master")),
        replies: [bot(t(lang, "masterSpec"), { buttons: categoryKeys(lang) })],
        step: "master_spec",
        draft: d,
      };
    }
    return {
      userMessage: user(t(lang, "client")),
      replies: [bot(t(lang, "welcome"), { buttons: clientMenuKeys(lang) })],
      step: "category",
      draft: d,
    };
  }

  if (tapId === "online:on" || tapId === "online:off") {
    const on = tapId === "online:on";
    return {
      userMessage: user(on ? t(lang, "goOnline") : t(lang, "goOffline")),
      replies: [bot(on ? t(lang, "nowOnline") : t(lang, "nowOffline"), { buttons: masterMenuKeys(lang) })],
      step: "idle",
      draft,
      setOnline: on,
    };
  }

  if (lower === "/help" || tapId === "cmd:help") {
    return { userMessage: user("?"), replies: [bot(t(lang, "help"), { buttons: clientMenuKeys(lang) })], step: step === "live" ? "live" : "category", draft };
  }

  if (tapId === "cmd:order") {
    if (step === "live") {
      return {
        userMessage: user(lang === "uz" ? "Usta chaqirish" : "Вызвать мастера"),
        replies: [bot(lang === "uz"
          ? "Faol ariza bor. Avval bekor qiling."
          : "Сначала закройте текущую заявку — «Отменить заявку».", { buttons: liveMenuKeys(lang) })],
        step: "live",
        draft,
      };
    }
    return {
      userMessage: user(lang === "uz" ? "Usta chaqirish" : "Вызвать мастера"),
      replies: [bot(lang === "uz" ? "Xizmatni tanlang:" : "Выберите услугу:", { buttons: categoryPickKeys(lang) })],
      step: "category",
      draft: { ...draft, photos: [], problem: undefined, serviceId: undefined, comment: undefined, role: "client" },
    };
  }

  if (tapId === "cmd:menu") {
    if (step === "live") {
      return {
        userMessage: user(lang === "uz" ? "Menyu" : "Меню"),
        replies: [bot(t(lang, "live"), { buttons: liveMenuKeys(lang) })],
        step: "live",
        draft,
      };
    }
    return {
      userMessage: user(lang === "uz" ? "Menyu" : "Меню"),
      replies: [bot(t(lang, "welcome"), { buttons: clientMenuKeys(lang) })],
      step: "category",
      draft: { ...draft, photos: [], problem: undefined, serviceId: undefined, comment: undefined },
    };
  }

  if (tapId === "cmd:support") {
    return {
      userMessage: user(lang === "uz" ? "Yordam" : "Поддержка"),
      replies: [bot(
        lang === "uz" ? "Savolingizni yozing — dispatcher siz bilan bog‘lanadi." : "Напишите вопрос — диспетчер свяжется с вами.",
        { buttons: step === "live" ? liveMenuKeys(lang) : clientMenuKeys(lang) },
      )],
      step: "support",
      draft,
    };
  }

  if (lower === "/cancel" || tapId === "cmd:cancel") {
    if (step === "live") {
      return {
        userMessage: user("/cancel"),
        replies: [bot(t(lang, "cancelDraft"))],
        step: "live",
        draft,
        cancelLive: true,
      };
    }
    return {
      userMessage: user("/cancel"),
      replies: [bot(t(lang, "cancelDraft") + "\n" + t(lang, "welcome"), { buttons: clientMenuKeys(lang) })],
      step: "category",
      draft: { ...emptyDraft(), lang, role: draft.role, name: draft.name },
    };
  }

  if (tapId.startsWith("rate:")) {
    return {
      userMessage: user(`${tapId.slice(5)}`),
      replies: [bot(`${t(lang, "thanksRate")}\n${t(lang, "askReview")}`, { buttons: clientMenuKeys(lang) })],
      step: "rate",
      draft: { ...draft, lang, role: draft.role, name: draft.name },
    };
  }

  if (step === "lang") {
    return {
      replies: [
        bot(t(lang, "pickLang"), {
          buttons: [
            [
              { id: "lang:ru", label: "Русский" },
              { id: "lang:uz", label: "O‘zbekcha" },
            ],
          ],
        }),
      ],
      step: "lang",
      draft,
    };
  }

  if (step === "role") {
    return { replies: [bot(t(lang, "pickRole"), { buttons: roleKeys(lang) })], step: "role", draft };
  }

  if (step === "master_spec") {
    const svc = tapId.startsWith("svc:") ? serviceById(tapId.slice(4)) : matchService(raw);
    if (!svc) {
      return {
        userMessage: user(raw),
        replies: [bot(t(lang, "masterSpec"), { buttons: categoryKeys(lang) })],
        step: "master_spec",
        draft,
      };
    }
    return {
      userMessage: user(lang === "uz" ? SVC_UZ[svc.id] : svc.title),
      replies: [bot(t(lang, "masterPhone"), { buttons: phoneKeys(lang) })],
      step: "master_phone",
      draft: { ...draft, serviceId: svc.id },
    };
  }

  if (step === "master_phone") {
    if (!isValidUzPhone(raw)) {
      return {
        userMessage: user(raw),
        replies: [bot(t(lang, "needPhone"), { buttons: phoneKeys(lang) })],
        step: "master_phone",
        draft,
      };
    }
    return {
      userMessage: user(formatPhone(raw)),
      replies: [bot(t(lang, "masterGeo"), { buttons: [[{ id: "geo:share", label: t(lang, "shareGeo"), requestLocation: true }]] })],
      step: "master_geo",
      draft: { ...draft, phone: formatPhone(raw) },
    };
  }

  if (step === "master_geo") {
    return {
      replies: [bot(t(lang, "masterGeo"), { buttons: [[{ id: "geo:share", label: t(lang, "shareGeo"), requestLocation: true }]] })],
      step: "master_geo",
      draft,
    };
  }

  if (step === "category") {
    const svc = tapId.startsWith("svc:") ? serviceById(tapId.slice(4)) : matchService(raw);
    const userMessage = user(svc ? (lang === "uz" ? SVC_UZ[svc.id] : svc.title) : raw);
    if (!svc) {
      return {
        userMessage,
        replies: [bot(t(lang, "needService"), { buttons: clientMenuKeys(lang) })],
        step: "category",
        draft,
      };
    }
    return {
      userMessage,
      replies: [bot(`${lang === "uz" ? SVC_UZ[svc.id] : svc.title}. ${t(lang, "describe")}`)],
      step: "problem",
      draft: { ...draft, serviceId: svc.id, photos: [], problem: undefined },
    };
  }

  if (step === "problem") {
    const problem = raw.slice(0, 400);
    if (problem.length < 4) {
      return { userMessage: user(raw), replies: [bot(t(lang, "moreDetail"))], step: "problem", draft };
    }
    return {
      userMessage: user(problem),
      replies: [bot(t(lang, "sendPhoto"), { buttons: [[{ id: "photo:skip", label: t(lang, "skipPhoto") }]] })],
      step: "photo",
      draft: { ...draft, problem },
    };
  }

  if (step === "photo") {
    if (tapId === "photo:skip" || lower.includes("пропуст") || lower.includes("fotosiz") || lower.includes("o‘tkaz") || lower.includes("otkaz")) {
      return afterPhotos(draft, lang, user(t(lang, "skipPhoto")));
    }
    return {
      userMessage: user(raw),
      replies: [bot(t(lang, "sendPhoto"), { buttons: [[{ id: "photo:skip", label: t(lang, "skipPhoto") }]] })],
      step: "photo",
      draft,
    };
  }

  if (step === "geo_choice") {
    if (tapId === "geo:keep") return afterKeepGeo(draft, lang, user(t(lang, "keepGeo")));
    if (tapId === "geo:new") {
      return {
        userMessage: user(t(lang, "newGeo")),
        replies: [bot(t(lang, "askGeo"), { buttons: geoKeys(lang) })],
        step: "district",
        draft,
      };
    }
    return {
      userMessage: user(raw),
      replies: [bot(geoPrompt(draft, lang), { buttons: keepGeoKeys(lang) })],
      step: "geo_choice",
      draft,
    };
  }

  if (step === "district" || step === "geo") {
    if (tapId === "geo:skip") {
      return {
        userMessage: user(t(lang, "skipGeo")),
        replies: [bot(t(lang, "needPhone"), { buttons: phoneKeys(lang) })],
        step: "phone",
        draft,
      };
    }
    const dist = tapId.startsWith("dist:")
      ? DISTRICTS.find((d) => d.id === tapId.slice(5))
      : DISTRICTS.find((d) => d.title.toLowerCase() === lower || (DIST_UZ[d.id] ?? "").toLowerCase() === lower);
    if (!dist) {
      return {
        userMessage: user(raw),
        replies: [bot(t(lang, "pickDistrict"), { buttons: geoKeys(lang) })],
        step: "district",
        draft,
      };
    }
    const title = lang === "uz" ? DIST_UZ[dist.id] ?? dist.title : dist.title;
    return {
      userMessage: user(title),
      replies: [
        bot(`${title}. ${t(lang, "districtOk")}`, {
          buttons: [
            [{ id: "geo:share", label: t(lang, "shareGeo"), requestLocation: true }],
            [{ id: "geo:skip", label: t(lang, "skipGeo") }],
            [{ id: "phone:share", label: t(lang, "sharePhone"), requestContact: true }],
          ],
        }),
      ],
      step: "geo",
      draft: { ...draft, districtId: dist.id, lat: draft.lat ?? dist.lat, lng: draft.lng ?? dist.lng },
    };
  }

  if (step === "phone") {
    if (!isValidUzPhone(raw)) {
      return {
        userMessage: user(raw),
        replies: [bot(t(lang, "needPhone"), { buttons: phoneKeys(lang) })],
        step: "phone",
        draft,
      };
    }
    return {
      userMessage: user(formatPhone(raw)),
      replies: [bot(t(lang, "commentAsk"), { buttons: [[{ id: "cmt:skip", label: t(lang, "skipComment") }]] })],
      step: "comment",
      draft: { ...draft, phone: formatPhone(raw) },
    };
  }

  if (step === "comment") {
    const comment = tapId === "cmt:skip" || lower.includes("без коммент") || lower.includes("izohsiz") ? "" : raw.slice(0, 240);
    const next = { ...draft, comment };
    return {
      userMessage: user(comment || t(lang, "skipComment")),
      replies: [
        bot(summary(next), {
          kind: "order",
          buttons: [
            [
              { id: "confirm:yes", label: t(lang, "confirm") },
              { id: "confirm:no", label: t(lang, "change") },
            ],
          ],
        }),
      ],
      step: "confirm",
      draft: next,
    };
  }

  if (step === "confirm") {
    if (tapId === "confirm:no" || lower.includes("измен") || lower.includes("zgartir")) {
      return {
        userMessage: user(t(lang, "change")),
        replies: [bot(t(lang, "restart"), { buttons: clientMenuKeys(lang) })],
        step: "category",
        draft: { ...emptyDraft(), lang, role: "client", name: draft.name },
      };
    }
    if (tapId === "confirm:yes" || lower.includes("подтвер") || lower.includes("tasdiq")) {
      if (!draft.serviceId || !draft.problem || !draft.phone || !draft.districtId) {
        return {
          userMessage: user(raw),
          replies: [bot(t(lang, "missing"))],
          step: "category",
          draft: { ...emptyDraft(), lang, name: draft.name },
        };
      }
      return { userMessage: user(t(lang, "confirm")), replies: [], step: "live", draft, submit: draft };
    }
    return {
      userMessage: user(raw),
      replies: [
        bot(t(lang, "confirmHint"), {
          buttons: [
            [
              { id: "confirm:yes", label: t(lang, "confirm") },
              { id: "confirm:no", label: t(lang, "change") },
            ],
          ],
        }),
      ],
      step: "confirm",
      draft,
    };
  }

  if (step === "support") {
    if (tapId.startsWith("cmd:") || tapId.startsWith("svc:") || tapId.startsWith("role:") || tapId.startsWith("lang:")) {
      /* handled above or below */
    } else if (raw) {
      return {
        userMessage: user(raw),
        replies: [bot(lang === "uz" ? "Dispatcher siz bilan bog‘lanadi." : "Передал. Диспетчер свяжется с вами.", { buttons: clientMenuKeys(lang) })],
        step: "category",
        draft,
        supportText: raw,
      };
    }
  }

  if (step === "rate") {
    if (tapId.startsWith("cmd:") || tapId.startsWith("svc:") || tapId.startsWith("role:") || tapId.startsWith("lang:")) {
      /* menu handled above */
    } else if (raw) {
      return {
        userMessage: user(raw),
        replies: [bot(t(lang, "reviewSaved"), { buttons: clientMenuKeys(lang) })],
        step: "category",
        draft,
        reviewText: raw.slice(0, 500),
      };
    }
    return {
      userMessage: user(raw),
      replies: [bot(t(lang, "askReview"), { buttons: clientMenuKeys(lang) })],
      step: "rate",
      draft,
    };
  }

  if (step === "live") {
    const svcLive = tapId.startsWith("svc:") ? serviceById(tapId.slice(4)) : matchService(raw);
    if (svcLive) {
      return {
        userMessage: user(lang === "uz" ? SVC_UZ[svcLive.id] : svcLive.title),
        replies: [bot(lang === "uz"
          ? "Sizda faol ariza bor. Avval «Bekor qilish» — keyin yangi xizmat."
          : "У вас уже есть заявка. Сначала «Отменить заявку» — потом новую услугу.", { buttons: liveMenuKeys(lang) })],
        step: "live",
        draft,
      };
    }
    if (raw && !tapId.startsWith("cmd:") && !tapId.startsWith("rate:")) {
      return {
        userMessage: user(raw),
        replies: [bot(lang === "uz" ? "Dispatcher siz bilan bog‘lanadi." : "Передал. Диспетчер свяжется с вами.", { buttons: liveMenuKeys(lang) })],
        step: "live",
        draft,
        supportText: raw,
      };
    }
    return {
      userMessage: user(raw),
      replies: [bot(t(lang, "live"), { buttons: liveMenuKeys(lang) })],
      step: "live",
      draft,
    };
  }

  if (step === "idle" && draft.role === "master") {
    return { replies: [bot(t(lang, "masterDone"), { buttons: masterMenuKeys(lang) })], step: "idle", draft };
  }

  const svc = matchService(raw);
  if (svc) {
    return {
      userMessage: user(lang === "uz" ? SVC_UZ[svc.id] : svc.title),
      replies: [bot(`${lang === "uz" ? SVC_UZ[svc.id] : svc.title}. ${t(lang, "describe")}`)],
      step: "problem",
      draft: { ...draft, serviceId: svc.id },
    };
  }
  return {
    userMessage: user(raw),
    replies: [bot(t(lang, "startHint"), { buttons: clientMenuKeys(lang) })],
    step: "category",
    draft,
  };
}

export function statusReply(status: OrderStatus, masterName?: string | null, lang: Lang = "ru"): ChatMessage {
  const extra = masterName ? (lang === "uz" ? `\n\nUsta: ${masterName}` : `\n\nМастер: ${masterName}`) : "";
  const buttons =
    status === "completed"
      ? [
          [
            { id: "rate:5", label: "5" },
            { id: "rate:4", label: "4" },
          ],
          [
            { id: "rate:3", label: "3" },
            { id: "rate:2", label: "2" },
          ],
        ]
      : status === "master_rejected" || status === "cancelled"
        ? [[{ id: "cmd:start", label: t(lang, "newOrder") }]]
        : undefined;
  return bot(clientLabel(status) + extra, { kind: "status", masterName: masterName ?? undefined, buttons });
}

export function clientMenu(lang?: Lang) {
  return clientMenuKeys(lang);
}
export function liveMenu(lang?: Lang) {
  return liveMenuKeys(lang);
}
export function categoryMenu(lang?: Lang) {
  return categoryPickKeys(lang);
}
export function masterMenu(lang?: Lang, online = true) {
  return masterMenuKeys(lang, online);
}
