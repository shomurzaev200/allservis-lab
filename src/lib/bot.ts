import { DISTRICTS, type ServiceId } from "./catalog";
import type { ChatMessage, ChatStep, Draft, KeyboardButton, Lang, UserRole } from "./types";
import { formatPhone, isValidUzPhone, nowTime, uid } from "./utils";
import { clientLabel } from "./domain";
import type { OrderStatus } from "./domain";
import { cityFromCoords, isInsideServiceArea } from "./geo";
import { formatBecomeMaster, formatHowTo, formatPrices } from "./tg-ui";

export const BOT_NAME = "All Servis";
export const BOT_HANDLE = "@AllServisBot";
const STATIC_TIME = "12:40";

type Dict = Record<string, string>;

const RU: Dict = {
  pickLang: "👋 Добро пожаловать в ALL SERVIS!\n🔧 Вызов мастера на дом\n📍 Работаем по всему Узбекистану.\n\nВыберите язык / Tilni tanlang.",
  pickRole: "Кто вы?",
  client: "Я клиент",
  master: "Я мастер",
  welcome:
    "📍 Работаем по всему Узбекистану.\nСвободный мастер из вашего города назначается сам, по очереди.\n«Заявка»: комментарий, фото, точка на карте и телефон.",
  help: "📝 Заявка — комментарий, фото, гео, телефон\n📦 Мои заявки — статус\n💰 Счёт — пополнение\n🎁 Пригласить — своя ссылка и скидка\n👤 Профиль — данные\n👨‍🔧 Я мастер — кабинет мастера\n💬 Оператор — чат с диспетчером",
  cancelDraft: "Черновик сброшен.",
  needService: "Нажмите кнопку или напишите, например: «течёт кран».",
  describe: "Напишите комментарий: что случилось и что нужно сделать.",
  moreDetail: "Комментарий слишком короткий. Напишите чуть подробнее.",
  sendPhoto: "Пришлите фото поломки или пропустите — без фото тоже примем.",
  skipPhoto: "Пропустить фото",
  morePhoto: "Фото получил. Ещё одно или отправьте геолокацию.",
  enoughPhoto: "Три фото достаточно. Отправьте геолокацию — без точки на карте заявку не примем.",
  askGeo: "📍 Чтобы понять, можем ли мы обслужить адрес, отправьте геолокацию.",
  shareGeo: "📍 Отправить геолокацию",
  geoOk: "Геолокация принята. Отправьте номер телефона кнопкой.",
  districtOk: "Нужна точная точка на карте — район вручную не принимаем.",
  skipGeo: "Нужна геолокация",
  keepGeo: "✅ Не менять локацию",
  newGeo: "📍 Отправить новую",
  askKeepGeo: "Локация с прошлого раза. Отправить новую точку или не менять?",
  pickDistrict: "Нажмите «Отправить геолокацию».",
  outsideArea: "📍 Эта точка за пределами Узбекистана.\nМы работаем по всей стране.",
  sharePhone: "📱 Отправить номер",
  needPhone: "❌ НЕВЕРНЫЙ НОМЕР\n\nНужен ваш телефон.\nНажмите «📱 Отправить номер»\nили введите +998 XX XXX XX XX.\n\nМинус, плюс без цифр и чужой текст — отказ.",
  commentAsk: "Комментарий для мастера — или пропустите.",
  skipComment: "Без комментария",
  confirm: "Подтвердить",
  change: "Изменить",
  confirmHint: "Нажмите «Подтвердить» или «Изменить».",
  restart: "Начнём заново. Напишите, что случилось.",
  missing: "Данных не хватает. /start",
  live: "Заявка в работе. Статус придёт сюда.",
  startHint: "Чтобы оставить заявку — нажмите «Заявка».",
  thanksRate: "Спасибо. Оценка ушла администратору.",
  askReview: "Можете написать отзыв текстом или нажать меню.",
  reviewSaved: "Отзыв сохранён. Спасибо!",
  newOrder: "Новая заявка",
  menu: "Меню",
  masterSpec: "Отправьте номер телефона.",
  masterPhone: "Отправьте номер — по нему с вами свяжется диспетчер.",
  masterGeo: "Отправьте геолокацию. Заявки будут только из вашего города.",
  masterDone: "Профиль мастера сохранён. Онлайн/офлайн — кнопками. Админ видит вас в панели.",
  goOnline: "Я онлайн",
  goOffline: "Я офлайн",
  nowOnline: "Вы на линии. Заявки только из вашего города, по очереди.",
  nowOffline: "Вы офлайн. Заявки не будут предлагать в первую очередь.",
};

const UZ: Dict = {
  pickLang: "👋 ALL SERVIS ga xush kelibsiz!\n🔧 Uyga usta chaqirish\n📍 Butun O‘zbekistonda ishlaymiz.\n\nTilni tanlang / Выберите язык.",
  pickRole: "Siz kimsiz?",
  client: "Men mijozman",
  master: "Men ustaman",
  welcome:
    "📍 Butun O‘zbekiston.\nBo‘sh usta shu shahardan o‘zi, navbat bilan tayinlanadi.\n«Ariza»: izoh, foto, nuqta va telefon.",
  help: "📝 Ariza — izoh, foto, geo, telefon\n📦 Arizalarim — status\n💰 Hisob — balans\n🎁 Taklif — shaxsiy havola va chegirma\n👤 Profil\n💬 Operator",
  cancelDraft: "Qoralama tozalandi.",
  needService: "Tugmani bosing yoki yozing, masalan: «kran oqayapti».",
  describe: "Izoh yozing: nima bo‘ldi va nima qilish kerak.",
  moreDetail: "Izoh juda qisqa. Biroz batafsilroq yozing.",
  sendPhoto: "Buzilish fotosini yuboring yoki o‘tkazing.",
  skipPhoto: "Fotosiz davom etish",
  morePhoto: "Foto oldim. Yana yuboring yoki geolokatsiya.",
  enoughPhoto: "Uchta foto yetarli. Geolokatsiya yuboring — nuqtasiz ariza olmaymiz.",
  askGeo: "📍 Xizmat ko‘rsata olishimiz uchun geolokatsiyani yuboring.",
  shareGeo: "📍 Geolokatsiya yuborish",
  geoOk: "Joylashuv qabul qilindi. Telefon raqamini tugma orqali yuboring.",
  districtOk: "Aniq nuqta kerak — tuman qo‘lda qabul qilinmaydi.",
  skipGeo: "Geolokatsiya kerak",
  keepGeo: "✅ O‘zgartirmaslik",
  newGeo: "📍 Yangi lokatsiya",
  askKeepGeo: "Oxirgi lokatsiya saqlangan. Yangisini yuborasizmi yoki qoldiramizmi?",
  pickDistrict: "«Geolokatsiya yuborish» ni bosing.",
  outsideArea: "📍 Nuqta O‘zbekistondan tashqarida.\nBiz butun mamlakatda ishlaymiz.",
  sharePhone: "📱 Raqamni yuborish",
  needPhone: "❌ NOTO‘G‘RI RAQAM\n\nO‘z telefoningiz kerak.\n«📱 Raqamni yuborish» ni bosing\nyoki +998 XX XXX XX XX yozing.\n\nMinus, plus yoki boshqa matn — rad.",
  commentAsk: "Usta uchun izoh — yoki o‘tkazing.",
  skipComment: "Izohsiz",
  confirm: "Tasdiqlash",
  change: "O‘zgartirish",
  confirmHint: "«Tasdiqlash» yoki «O‘zgartirish».",
  restart: "Qaytadan. Nima bo‘lganini yozing.",
  missing: "Ma’lumot yetarli emas. /start",
  live: "Ariza jarayonda. Status shu yerga keladi.",
  startHint: "Ariza uchun «Ariza» ni bosing.",
  thanksRate: "Rahmat. Baholash adminga ketdi.",
  askReview: "Matnli izoh yozishingiz yoki menyuni bosishingiz mumkin.",
  reviewSaved: "Izoh saqlandi. Rahmat!",
  newOrder: "Yangi ariza",
  menu: "Menyu",
  masterSpec: "Mutaxassislik?",
  masterPhone: "Raqamingizni yuboring — dispatcher shu orqali bog‘lanadi.",
  masterGeo: "Geolokatsiya yuboring. Buyurtmalar faqat shu shahardan keladi.",
  masterDone: "Usta profili saqlandi. Onlayn/oflayn — tugmalar. Admin sizni panelda ko‘radi.",
  goOnline: "Men onlaynman",
  goOffline: "Men oflaynman",
  nowOnline: "Siz liniyadasiz. Yangi buyurtmalar shu yerga keladi.",
  nowOffline: "Siz oflaynsiz.",
};

function t(lang: Lang | undefined, key: keyof typeof RU): string {
  return (lang === "uz" ? UZ : RU)[key] ?? RU[key];
}

const DIST_UZ: Record<string, string> = {
  bekabad: "Bekobod",
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
  return [[{ id: "geo:share", label: t(lang, "shareGeo"), requestLocation: true }]];
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
  const next = { ...draft, serviceId: "other" as ServiceId };
  if (!next.phone) {
    return {
      userMessage,
      replies: [bot(t(lang, "needPhone"), { buttons: phoneKeys(lang) })],
      step: "phone",
      draft: next,
    };
  }
  return confirmStep(next, lang, userMessage);
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
      [{ id: "cmd:jobs", label: "📦 Buyurtmalar" }, { id: "cmd:mbalance", label: "💰 Balans" }],
      [{ id: "cmd:stats", label: "📊 Statistika" }, { id: "cmd:reviews", label: "⭐️ Izohlar" }],
      [{ id: online ? "online:off" : "online:on", label: online ? "🔴 Oflayn" : "🟢 Onlayn" }, { id: "cmd:loc", label: "📍 Lokatsiya" }],
      [{ id: "cmd:ref", label: "🎁 Taklif" }, { id: "cmd:mprofile", label: "👤 Kabinet" }],
      [{ id: "role:client", label: "👤 Men mijozman" }],
    ];
  }
  return [
    [{ id: "cmd:jobs", label: "📦 Мои заявки" }, { id: "cmd:mbalance", label: "💰 Баланс" }],
    [{ id: "cmd:stats", label: "📊 Статистика" }, { id: "cmd:reviews", label: "⭐️ Отзывы" }],
    [{ id: online ? "online:off" : "online:on", label: online ? "🔴 Офлайн" : "🟢 На линии" }, { id: "cmd:loc", label: "📍 Локация" }],
    [{ id: "cmd:ref", label: "🎁 Пригласить" }, { id: "cmd:mprofile", label: "👤 Кабинет" }],
    [{ id: "role:client", label: "👤 Я клиент" }],
  ];
}

function categoryPickKeys(lang: Lang | undefined): KeyboardButton[][] {
  return [[{ id: "cmd:menu", label: lang === "uz" ? "◀️ Menyuga" : "◀️ В меню" }]];
}

function liveMenuKeys(lang: Lang | undefined): KeyboardButton[][] {
  if (lang === "uz") {
    return [
      [{ id: "cmd:myorders", label: "📦 Arizam" }],
      [{ id: "cmd:profile", label: "👤 Profil" }, { id: "cmd:support", label: "📞 Operator" }],
      [{ id: "cmd:cancel", label: "❌ Bekor qilish" }],
    ];
  }
  return [
    [{ id: "cmd:myorders", label: "📦 Моя заявка" }],
    [{ id: "cmd:profile", label: "👤 Профиль" }, { id: "cmd:support", label: "📞 Оператор" }],
    [{ id: "cmd:cancel", label: "❌ Отменить заявку" }],
  ];
}

function clientMenuKeys(lang: Lang | undefined): KeyboardButton[][] {
  if (lang === "uz") {
    return [
      [{ id: "cmd:order", label: "📝 Ariza" }, { id: "cmd:repeat", label: "🔁 Oldingi kabi" }],
      [{ id: "cmd:myorders", label: "📦 Arizalarim" }, { id: "cmd:profile", label: "👤 Profil" }],
      [{ id: "cmd:balance", label: "💰 Hisob" }, { id: "cmd:support", label: "📞 Operator" }],
      [{ id: "cmd:ref", label: "🎁 Taklif" }, { id: "cmd:reviews", label: "⭐️ Izohlar" }],
      [{ id: "cmd:become", label: "👨‍🔧 Men ustaman" }],
    ];
  }
  return [
    [{ id: "cmd:order", label: "📝 Заявка" }, { id: "cmd:repeat", label: "🔁 Как в прошлый раз" }],
    [{ id: "cmd:myorders", label: "📦 Мои заявки" }, { id: "cmd:profile", label: "👤 Профиль" }],
    [{ id: "cmd:balance", label: "💰 Счёт" }, { id: "cmd:support", label: "📞 Оператор" }],
    [{ id: "cmd:ref", label: "🎁 Пригласить" }, { id: "cmd:reviews", label: "⭐️ Отзывы" }],
    [{ id: "cmd:become", label: "👨‍🔧 Я мастер" }],
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

function applyLocation(draft: Draft, lat: number, lng: number): Draft {
  const inside = isInsideServiceArea(lat, lng);
  const city = cityFromCoords(lat, lng) || (inside ? draft.city || "" : draft.city);
  return {
    ...draft,
    lat,
    lng,
    districtId: undefined,
    city: inside ? city || draft.city : draft.city,
  };
}

function confirmStep(draft: Draft, lang: Lang | undefined, userMessage: ChatMessage): BotResult {
  const next: Draft = { ...draft, serviceId: "other" };
  return {
    userMessage,
    replies: [
      bot(summary(next), {
        kind: "order",
        buttons: [[
          { id: "confirm:yes", label: t(lang, "confirm") },
          { id: "confirm:no", label: t(lang, "change") },
        ]],
      }),
    ],
    step: "confirm",
    draft: next,
  };
}

function summary(d: Draft): string {
  const lang = d.lang;
  const city = d.city || (lang === "uz" ? "O‘zbekiston" : "Узбекистан");
  const area = d.fullAddress || d.neighborhood || "—";
  const task = d.problem || d.comment || "—";
  const lines =
    lang === "uz"
      ? [
          "Arizani tekshiring:",
          "",
          `Izoh — ${task}`,
          `Shahar — ${city}`,
          `Manzil — ${area}`,
          `Geo — ${d.lat?.toFixed(5)}, ${d.lng?.toFixed(5)}`,
          `Tel — ${d.phone ?? "—"}`,
          `Foto — ${d.photos.length ? d.photos.length + " ta" : "yo‘q"}`,
        ]
      : [
          "Проверьте заявку:",
          "",
          `Комментарий — ${task}`,
          `Город — ${city}`,
          `Адрес — ${area}`,
          `Геолокация — ${d.lat?.toFixed(5)}, ${d.lng?.toFixed(5)}`,
          `Телефон — ${d.phone ?? "—"}`,
          `Фото — ${d.photos.length ? d.photos.length + " шт." : "нет"}`,
        ];
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
  if (q === fold(RU.client) || q === fold(UZ.client) || q === "клиент" || q === "mijoz") return "role:client";
  if (q === fold(RU.master) || q === fold(UZ.master) || q === "мастер" || q === "usta") return "role:master";
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
  if (q === fold(RU.change) || q === "изменить" || ((q.includes("измен") || q.includes("zgartir")) && !q.includes("локац") && !q.includes("lokatsiya"))) return "confirm:no";
  if (q === fold(RU.goOnline) || q === "я онлайн" || q.includes("onlaynman") || q.includes("на линии")) return "online:on";
  if (q === fold(RU.goOffline) || q === "я офлайн" || q.includes("oflayn") || q.includes("офлайн")) return "online:off";
  if (q.includes("повтор") || q.includes("oldingi") || q.includes("как в прошл")) return "cmd:repeat";
  if (q.includes("вызвать") || q.includes("chaqirish") || q === "услуги" || q === "xizmat") return "cmd:order";
  if (q.includes("доступн") || q.startsWith("⚡") || q.includes("buyurtma") && !q.includes("usta")) return "cmd:jobs";
  if (q.includes("локац") || q.includes("lokatsiya")) return "cmd:loc";
  if (q.includes("стать мастером") || q.includes("usta bo") || q === "мастер") return "cmd:become";
  if (q.includes("начать регистрац") || q.includes("регистрацию") || q.includes("ro'yxatdan") || q.includes("royxatdan")) return "role:master";
  if (q.includes("кабинет") || q.includes("kabinet")) return "cmd:mprofile";
  if (q.includes("профиль") || q.includes("profil")) return "cmd:profile";
  if ((q.includes("доступ") || q.includes("kirish") || q.includes("баланс") || q.includes("balans")) && !q.includes("доступн")) return "cmd:balance";
  if (q.includes("цены") || q.includes("narxlar") || q.includes("narx va")) return "cmd:prices";
  if (q.includes("отзыв") || q.includes("izoh")) return "cmd:reviews";
  if (q.includes("как это") || q.includes("qanday ishlaydi") || q.includes("как работает")) return "cmd:howto";
  if (q === "заявка" || q === "ariza" || q.includes("новая заявка") || q.includes("yangi ariza") || q === fold(RU.newOrder) || q === fold(UZ.newOrder)) return "cmd:order";
  if (q.includes("заявк") || q.includes("ariza")) return "cmd:myorders";
  if (q.includes("активн") || q.includes("faol")) return "cmd:active";
  if (q.includes("статисти") || q.includes("statistika")) return "cmd:stats";
  if (q.includes("помощ") || q.includes("yordam") || q === "/help" || q.includes("поддерж") || q === "оператор" || q === "operator") return "cmd:support";
  if (q.includes("друз") || q.includes("do'st") || q.includes("dostlar") || q.includes("реферал") || q === "/ref" || q.includes("приглас") || q.includes("taklif") || q.includes("скидк") || q.includes("chegirma")) return "cmd:ref";
  if (q.includes("язык") || q === "til" || q === "/lang") return "cmd:lang";
  if (q.includes("главное меню") || q.includes("bosh menyu") || q === "🏠") return "cmd:menu";
  if (q.includes("меню") || q.includes("menyu") || q.includes("назад")) return "cmd:menu";
  if (q === fold("✅ всё верно") || q.includes("всё верно") || q.includes("hammasi to")) return "geo:ok";
  if (q.includes("другую локац") || q.includes("boshqa lokatsiya")) return "geo:new";
  if (q === fold(RU.menu) || q === fold(UZ.menu)) return "cmd:menu";
  if (q.includes("отмен") || q.includes("bekor") || q === "/cancel") return "cmd:cancel";
  if (q === "сейчас" || q === "hozir" || q === "лучше сейчас") return "when:now";
  if (q.includes("на дату") || q.includes("sana va")) return "when:later";
  if (q === "счет" || q === "hisob" || q.includes("на счете")) return "cmd:balance";
  return null;
}

function parseWhen(raw: string): string | null {
  const text = raw.trim().toLowerCase();
  const clock = text.match(/(\d{1,2})[:.](\d{2})/);
  const abs = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
  const now = new Date();
  const at = new Date(now);
  if (abs) {
    at.setFullYear(Number(abs[1]), Number(abs[2]) - 1, Number(abs[3]));
  } else if (text.includes("послезавтра") || text.includes("indingi")) {
    at.setDate(at.getDate() + 2);
  } else if (text.includes("завтра") || text.includes("ertaga")) {
    at.setDate(at.getDate() + 1);
  }
  if (clock) {
    at.setHours(Number(clock[1]), Number(clock[2]), 0, 0);
  } else if (!abs) {
    return null;
  }
  if (at.getTime() < Date.now() - 60_000) at.setDate(at.getDate() + 1);
  return at.toISOString();
}

export function reduceBot(step: ChatStep, draft: Draft, event: BotEvent): BotResult {
  const lang = draft.lang ?? "ru";

  if (event.type === "text") {
    const mapped = labelToTapId(event.text);
    if (mapped) event = { type: "tap", id: mapped, label: event.text };
  }

  if (event.type === "contact") {
    const phone = formatPhone(event.phone);
    if (!isValidUzPhone(event.phone)) {
      return {
        userMessage: user(event.phone),
        replies: [bot(t(lang, "needPhone"), { buttons: phoneKeys(lang) })],
        step: step === "master_phone" ? "master_phone" : "phone",
        draft,
      };
    }
    if (step === "master_phone" || step === "master_geo" || step === "master_spec" || (draft.role === "master" && step !== "category" && step !== "problem" && step !== "photo" && step !== "phone" && step !== "district" && step !== "geo" && step !== "geo_choice" && step !== "confirm" && step !== "when")) {
      return {
        userMessage: user(phone),
        replies: [bot(t(lang, "masterGeo"), { buttons: [[{ id: "geo:share", label: t(lang, "shareGeo"), requestLocation: true }]] })],
        step: "master_geo",
        draft: { ...draft, phone, serviceId: "other", role: "master" },
      };
    }
    const next = { ...draft, phone, serviceId: "other" as ServiceId, role: "client" as const };
    if (next.problem && next.lat != null && next.lng != null) return confirmStep(next, lang, user(phone));
    if (!next.problem) {
      return {
        userMessage: user(phone),
        replies: [bot(t(lang, "describe"))],
        step: "problem",
        draft: next,
      };
    }
    return {
      userMessage: user(phone),
      replies: [bot(t(lang, "askGeo"), { buttons: geoKeys(lang) })],
      step: "district",
      draft: next,
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
    const inside = isInsideServiceArea(event.lat, event.lng);
    if (!inside) {
      if (step === "master_geo" || (draft.role === "master" && step === "master_phone")) {
        return {
          userMessage: user("📍"),
          replies: [
            bot(t(lang, "outsideArea"), { buttons: geoKeys(lang) }),
            bot(t(lang, "masterGeo"), { buttons: geoKeys(lang) }),
          ],
          step: "master_geo",
          draft: { ...next, districtId: undefined },
        };
      }
      return {
        userMessage: user("📍"),
        replies: [
          bot(t(lang, "outsideArea"), { buttons: [...geoKeys(lang), [{ id: "cmd:menu", label: lang === "uz" ? "◀️ Menyuga" : "◀️ В меню" }]] }),
        ],
        step: step === "category" || step === "idle" ? "category" : "district",
        draft: { ...next, districtId: undefined, neighborhood: undefined, fullAddress: undefined },
      };
    }
    if (step === "master_geo" || (draft.role === "master" && step === "master_phone")) {
      return {
        userMessage: user("📍"),
        replies: [bot(t(lang, "masterDone"), { buttons: masterMenuKeys(lang) })],
        step: "idle",
        draft: next,
        registerMaster: true,
      };
    }
    if (!next.problem && step !== "photo" && step !== "district" && step !== "geo" && step !== "geo_choice") {
      return {
        userMessage: user("📍"),
        replies: [bot(t(lang, "describe"))],
        step: "problem",
        draft: { ...next, serviceId: "other", role: "client" },
      };
    }
    return {
      userMessage: user("📍"),
      replies: [bot(t(lang, "askKeepGeo"), { buttons: [
        [{ id: "geo:ok", label: lang === "uz" ? "✅ Hammasi to‘g‘ri" : "✅ Всё верно" }],
        [{ id: "geo:new", label: t(lang, "newGeo"), requestLocation: true }],
        [{ id: "cmd:menu", label: lang === "uz" ? "◀️ Orqaga" : "◀️ Назад" }],
      ] })],
      step: "geo",
      draft: next,
    };
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
        replies: [bot(t(lang, "masterPhone"), { buttons: phoneKeys(lang) })],
        step: "master_phone",
        draft: { ...d, serviceId: "other" },
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

  if (tapId === "cmd:become") {
    return {
      userMessage: user(lang === "uz" ? "Usta bo‘lish" : "Стать мастером"),
      replies: [bot(formatBecomeMaster(lang === "uz" ? "uz" : "ru"), {
        buttons: [
          [{ id: "role:master", label: lang === "uz" ? "👨‍🔧 Ro‘yxatdan o‘tish" : "👨‍🔧 Начать регистрацию" }],
          [{ id: "cmd:menu", label: lang === "uz" ? "◀️ Orqaga" : "◀️ Назад" }],
        ],
      })],
      step: step === "live" ? "live" : "category",
      draft,
    };
  }

  if (tapId === "cmd:prices") {
    return {
      userMessage: user(lang === "uz" ? "Narxlar" : "Цены"),
      replies: [bot(formatPrices(lang === "uz" ? "uz" : "ru"), { buttons: [
        [{ id: "cmd:order", label: lang === "uz" ? "📝 Ariza" : "📝 Заявка" }],
        [{ id: "cmd:menu", label: lang === "uz" ? "🏠 Bosh menyu" : "🏠 Главное меню" }],
      ] })],
      step: step === "live" ? "live" : "category",
      draft,
    };
  }

  if (tapId === "cmd:howto") {
    return {
      userMessage: user(lang === "uz" ? "Qanday ishlaydi" : "Как это работает"),
      replies: [bot(formatHowTo(lang === "uz" ? "uz" : "ru"), { buttons: [
        [{ id: "cmd:order", label: lang === "uz" ? "📝 Ariza" : "📝 Заявка" }],
        [{ id: "cmd:menu", label: lang === "uz" ? "🏠 Bosh menyu" : "🏠 Главное меню" }],
      ] })],
      step: step === "live" ? "live" : "category",
      draft,
    };
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
      userMessage: user(lang === "uz" ? "Ariza" : "Заявка"),
      replies: [bot(t(lang, "describe"))],
      step: "problem",
      draft: { ...draft, photos: [], problem: undefined, serviceId: "other", comment: undefined, role: "client" },
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
        lang === "uz"
          ? "Yozing. Xabar operatorga ketadi, javob shu chatga qaytadi."
          : "Напишите сообщение. Оно уйдёт оператору, ответ придёт в этот чат.",
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
    return {
      userMessage: user(raw || t(lang, "master")),
      replies: [bot(t(lang, "masterPhone"), { buttons: phoneKeys(lang) })],
      step: "master_phone",
      draft: { ...draft, serviceId: "other", role: "master" },
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
    const problem = raw.slice(0, 400);
    if (problem.length < 4) {
      return {
        userMessage: user(raw),
        replies: [bot(t(lang, "describe"), { buttons: clientMenuKeys(lang) })],
        step: "problem",
        draft: { ...draft, serviceId: "other", role: "client" },
      };
    }
    return {
      userMessage: user(problem),
      replies: [bot(t(lang, "sendPhoto"), { buttons: [[{ id: "photo:skip", label: t(lang, "skipPhoto") }]] })],
      step: "photo",
      draft: { ...draft, serviceId: "other", photos: [], problem, comment: undefined, role: "client" },
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
      draft: { ...draft, problem, serviceId: "other" },
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
    if (tapId === "geo:keep") {
      const lat = Number(draft.lat);
      const lng = Number(draft.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInsideServiceArea(lat, lng)) {
        return {
          userMessage: user(t(lang, "keepGeo")),
          replies: [bot(`${t(lang, "outsideArea")}\n\n${t(lang, "askGeo")}`, { buttons: geoKeys(lang) })],
          step: "district",
          draft: { ...draft, districtId: undefined },
        };
      }
      return afterKeepGeo(draft, lang, user(t(lang, "keepGeo")));
    }
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
    if (tapId === "geo:ok") {
      const lat = Number(draft.lat);
      const lng = Number(draft.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInsideServiceArea(lat, lng)) {
        return {
          userMessage: user(raw),
          replies: [bot(t(lang, "outsideArea"), { buttons: geoKeys(lang) })],
          step: "district",
          draft,
        };
      }
      return afterKeepGeo(draft, lang, user(lang === "uz" ? "To‘g‘ri" : "Всё верно"));
    }
    if (tapId === "geo:skip" || tapId.startsWith("dist:")) {
      return {
        userMessage: user(raw || t(lang, "skipGeo")),
        replies: [bot(t(lang, "askGeo"), { buttons: geoKeys(lang) })],
        step: "district",
        draft,
      };
    }
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
      replies: [bot(t(lang, "askGeo"), { buttons: geoKeys(lang) })],
      step: "district",
      draft,
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
    return confirmStep({ ...draft, phone: formatPhone(raw), serviceId: "other" }, lang, user(formatPhone(raw)));
  }

  if (step === "comment") {
    const comment = tapId === "cmt:skip" || lower.includes("без коммент") || lower.includes("izohsiz") ? "" : raw.slice(0, 240);
    const next = { ...draft, comment, problem: draft.problem || comment, serviceId: "other" as ServiceId };
    if (!next.problem || next.problem.length < 4) {
      return {
        userMessage: user(raw),
        replies: [bot(t(lang, "describe"))],
        step: "problem",
        draft: next,
      };
    }
    return confirmStep(next, lang, user(comment || t(lang, "skipComment")));
  }

  if (step === "confirm") {
    if (tapId === "confirm:no" || lower.includes("измен") || lower.includes("zgartir")) {
      return {
        userMessage: user(t(lang, "change")),
        replies: [bot(t(lang, "describe"))],
        step: "problem",
        draft: { ...draft, photos: [], problem: undefined, comment: undefined, serviceId: "other", role: "client" },
      };
    }
    if (tapId === "confirm:yes" || lower.includes("подтвер") || lower.includes("tasdiq")) {
      if (!draft.problem) {
        return {
          userMessage: user(raw),
          replies: [bot(t(lang, "describe"))],
          step: "problem",
          draft: { ...draft, serviceId: "other" },
        };
      }
      if (!draft.phone) {
        return {
          userMessage: user(raw),
          replies: [bot(t(lang, "needPhone"), { buttons: phoneKeys(lang) })],
          step: "phone",
          draft,
        };
      }
      if (draft.lat == null || draft.lng == null || !isInsideServiceArea(Number(draft.lat), Number(draft.lng))) {
        return {
          userMessage: user(raw),
          replies: [bot(`${t(lang, "missing")}\n${t(lang, "askGeo")}`, { buttons: geoKeys(lang) })],
          step: "district",
          draft,
        };
      }
      return {
        userMessage: user(t(lang, "confirm")),
        replies: [bot(lang === "uz" ? "Qachon kerak?" : "Когда нужен мастер?", {
          buttons: [
            [{ id: "when:now", label: lang === "uz" ? "⚡ Hozir" : "⚡ Сейчас" }],
            [{ id: "when:later", label: lang === "uz" ? "📅 Sana va vaqt" : "📅 На дату и время" }],
          ],
        })],
        step: "when",
        draft: { ...draft, when: undefined },
      };
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

  if (step === "when") {
    const q = fold(raw);
    const later = tapId === "when:later" || q.includes("на дату") || q.includes("sana va");
    const now = !later && (tapId === "when:now" || q === "сейчас" || q === "hozir" || q === "лучше сейчас");
    if (later) {
      return {
        userMessage: user(raw || (lang === "uz" ? "Sana" : "На время")),
        replies: [bot(lang === "uz"
          ? "Yozing: 2026-10-26 15:00 yoki «ertaga 15:00»."
          : "Напишите: 2026-10-26 15:00 или «завтра 15:00».", {
          buttons: [[{ id: "when:now", label: lang === "uz" ? "⚡ Hozir" : "⚡ Лучше сейчас" }]],
        })],
        step: "when",
        draft: { ...draft, when: "ask" },
      };
    }
    if (now) {
      const next = { ...draft, serviceId: "other" as ServiceId, when: undefined };
      return { userMessage: user(lang === "uz" ? "Hozir" : "Сейчас"), replies: [], step: "live", draft: next, submit: next };
    }
    if (draft.when === "ask" && raw && event.type === "text") {
      const iso = parseWhen(raw);
      if (!iso) {
        return {
          userMessage: user(raw),
          replies: [bot(lang === "uz" ? "Sana tushunilmadi. Masalan: ertaga 15:00" : "Не разобрал дату. Например: завтра 15:00")],
          step: "when",
          draft,
        };
      }
      const next = { ...draft, serviceId: "other" as ServiceId, when: iso };
      return { userMessage: user(raw), replies: [], step: "live", draft: next, submit: next };
    }
    return {
      userMessage: user(raw),
      replies: [bot(lang === "uz" ? "Hozir yoki sana?" : "Сейчас или на дату?", {
        buttons: [
          [{ id: "when:now", label: lang === "uz" ? "⚡ Hozir" : "⚡ Сейчас" }],
          [{ id: "when:later", label: lang === "uz" ? "📅 Sana va vaqt" : "📅 На дату и время" }],
        ],
      })],
      step: "when",
      draft,
    };
  }

  if (step === "support") {
    if (tapId.startsWith("cmd:") || tapId.startsWith("svc:") || tapId.startsWith("role:") || tapId.startsWith("lang:")) {
      /* commands above already returned */
    } else if (raw) {
      return {
        userMessage: user(raw),
        replies: [bot(
          lang === "uz"
            ? "Yubordim. Javob shu chatga keladi. Yana yozishingiz mumkin."
            : "Отправил оператору. Ответ придёт в этот чат. Можно писать ещё.",
          { buttons: clientMenuKeys(lang) },
        )],
        step: "support",
        draft,
        supportText: raw,
      };
    }
    return {
      replies: [bot(
        lang === "uz" ? "Xabar yozing — operator javob beradi." : "Напишите сообщение — оператор ответит здесь.",
        { buttons: clientMenuKeys(lang) },
      )],
      step: "support",
      draft,
    };
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
    if (raw && !tapId.startsWith("cmd:") && !tapId.startsWith("rate:") && !tapId.startsWith("svc:")) {
      return {
        userMessage: user(raw),
        replies: [bot(lang === "uz" ? "Operatorga yubordim. Javob shu yerga keladi." : "Отправил оператору. Ответ придёт сюда.", { buttons: liveMenuKeys(lang) })],
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
