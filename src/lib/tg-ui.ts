import { SERVICES, serviceById } from "./catalog";
import { formatSum } from "./domain";

export const HR = "━━━━━━━━━━━━━━━━";

export const SVC_EMOJI: Record<string, string> = {
  plumb: "🚰",
  elec: "🔌",
  ac: "❄️",
  appliance: "📺",
  furniture: "🪚",
  lock: "🔑",
  paint: "🎨",
  other: "🏠",
};

export function svcTitle(id: string, lang: "ru" | "uz" = "ru"): string {
  const emoji = SVC_EMOJI[id] ?? "🔧";
  if (lang === "uz") {
    const uz: Record<string, string> = {
      plumb: "Santexnik", elec: "Elektrik", ac: "Konditsioner", appliance: "Texnika",
      furniture: "Mebel", lock: "Quflar", paint: "Bo‘yoqchi", other: "Boshqa",
    };
    return `${emoji} ${uz[id] ?? id}`;
  }
  return `${emoji} ${serviceById(id)?.title ?? id}`;
}

export function displayArea(
  district: string | null | undefined,
  _lat?: number | null,
  _lng?: number | null,
  lang: "ru" | "uz" = "ru",
): string {
  const unk = lang === "uz" ? "aniqlanmadi" : "не определён";
  const raw = (district ?? "").trim();
  if (!raw) return unk;
  return raw;
}

export function statusLine(status: string, lang: "ru" | "uz" = "ru"): string {
  const ru: Record<string, string> = {
    waiting_admin: "🟡 Ожидает назначения",
    assigned: "🔵 Мастер назначен",
    master_accepted: "🟢 Мастер принял заявку",
    master_rejected: "❌ Мастер отказался",
    enroute: "🚗 Мастер едет к вам",
    arrived: "📍 Мастер прибыл",
    in_progress: "🔧 Работа выполняется",
    completed: "✅ Заявка завершена",
    cancelled: "❌ Заявка отменена",
  };
  const uz: Record<string, string> = {
    waiting_admin: "🟡 Tayinlash kutilmoqda",
    assigned: "🔵 Usta tayinlandi",
    master_accepted: "🟢 Usta qabul qildi",
    master_rejected: "❌ Usta rad etdi",
    enroute: "🚗 Usta yo‘lda",
    arrived: "📍 Usta yetib keldi",
    in_progress: "🔧 Ish boshlandi",
    completed: "✅ Yakunlandi",
    cancelled: "❌ Bekor qilindi",
  };
  return (lang === "uz" ? uz : ru)[status] ?? status;
}

export function formatClientHome(opts: {
  name: string; city?: string; balance?: number; lang: "ru" | "uz";
}): string {
  const city = opts.city || (opts.lang === "uz" ? "O‘zbekiston" : "Узбекистан");
  const n = opts.name.split(" ")[0] || opts.name;
  if (opts.lang === "uz") {
    return [
      "🔧 ALL SERVIS",
      "Uyga usta chaqirish",
      "",
      `Xush kelibsiz, ${n}! 👋`,
      "",
      `📍 ${city}`,
      "💳 Ustaga joyida to‘laysiz",
      "",
      "Qanday yordam bera olamiz?",
      "Pastdagi tugmani tanlang.",
    ].join("\n");
  }
  return [
    "🔧 ALL SERVIS",
    "Вызов мастера на дом",
    "",
    `Добро пожаловать, ${n}! 👋`,
    "",
    `📍 ${city}`,
    "💳 Мастеру платите на месте",
    "",
    "Чем можем помочь?",
    "👇 Выберите действие",
  ].join("\n");
}

export function formatPrices(lang: "ru" | "uz"): string {
  const lines = lang === "uz"
    ? ["💵 NARXLAR VA XIZMATLAR", "", HR, ""]
    : ["💵 ЦЕНЫ И УСЛУГИ", "", HR, ""];
  for (const s of SERVICES) {
    lines.push(`${svcTitle(s.id, lang)}`, `от ${formatSum(s.from)}`, "");
  }
  lines.push(HR, "");
  lines.push(
    lang === "uz"
      ? "ℹ️ Aniq narx ish murakkabligiga bog‘liq.\nUsta ishni boshlashdan oldin aytadi."
      : "ℹ️ Точная стоимость зависит\nот сложности работы.\n\nПеред началом мастер сообщает\nстоимость.",
  );
  return lines.join("\n");
}

export function formatHowTo(lang: "ru" | "uz"): string {
  if (lang === "uz") {
    return [
      "ℹ️ ALL SERVIS QANDAY ISHLAYDI?",
      "",
      "1️⃣ Ariza yaratasiz",
      "2️⃣ 📍 Joylashuv yuborasiz",
      "3️⃣ 👨‍🔧 Bo‘sh usta shu shahardan o‘zi tayinlanadi",
      "4️⃣ 👨‍🔧 Usta arizani oladi",
      "5️⃣ ✅ Usta tasdiqlaydi",
      "6️⃣ 🚗 Usta keladi",
      "7️⃣ 🔧 Ishni bajaradi",
      "8️⃣ ⭐️ Siz baholaysiz",
    ].join("\n");
  }
  return [
    "ℹ️ КАК РАБОТАЕТ ALL SERVIS?",
    "",
    "1️⃣ Вы создаёте заявку",
    "2️⃣ 📍 Отправляете местоположение",
    "3️⃣ 👨‍🔧 Свободный мастер из вашего города назначается сам",
    "4️⃣ 👨‍🔧 Мастер получает заявку",
    "5️⃣ ✅ Мастер подтверждает заказ",
    "6️⃣ 🚗 Мастер приезжает",
    "7️⃣ 🔧 Выполняет работу",
    "8️⃣ ⭐️ Вы оцениваете мастера",
  ].join("\n");
}

export function formatBecomeMaster(lang: "ru" | "uz"): string {
  if (lang === "uz") {
    return [
      "👨‍🔧 USTA BO‘LISH",
      "",
      "ALL SERVIS da usta bo‘lib ishlamoqchimisiz?",
      "",
      "✅ mijoz arizalarini olasiz",
      "✅ o‘z vaqtingizda ishlaysiz",
      "✅ yangi buyurtmalar haqida xabar",
      "✅ o‘z buyurtmalaringizni ko‘rasiz",
      "✅ reyting va izohlar",
      "✅ ALL SERVIS orqali daromad",
      "",
      "📍 Butun O‘zbekiston. Buyurtma faqat siz turgan shahardan keladi.",
    ].join("\n");
  }
  return [
    "👨‍🔧 СТАТЬ МАСТЕРОМ",
    "",
    "Хотите работать мастером в ALL SERVIS?",
    "",
    "✅ получать заявки клиентов",
    "✅ выбирать удобное время работы",
    "✅ уведомления о новых заказах",
    "✅ видеть свои заказы",
    "✅ рейтинг и отзывы",
    "✅ зарабатывать через ALL SERVIS",
    "",
    "📍 Работаем по всему Узбекистану. Заявки приходят только из вашего города.",
  ].join("\n");
}

export function formatOpError(lang: "ru" | "uz"): string {
  return lang === "uz"
    ? "❌ OPERATSIYA BAJARILMADI\n\nQayta urinib ko‘ring.\nTakrorlansa — operatorga yozing."
    : "❌ НЕ УДАЛОСЬ ВЫПОЛНИТЬ ОПЕРАЦИЮ\n\nПопробуйте ещё раз.\nЕсли проблема повторяется — напишите оператору.";
}

