import { serviceById } from "./catalog";
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
      `💰 Hisob: ${formatSum(opts.balance ?? 0)}`,
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
    `💰 На счёте: ${formatSum(opts.balance ?? 0)}`,
    "",
    "Чем можем помочь?",
    "👇 Выберите действие",
  ].join("\n");
}

export function formatPrices(lang: "ru" | "uz"): string {
  return lang === "uz"
    ? [
        "💵 NARX",
        "",
        HR,
        "",
        "Katalog yo‘q. Narxni usta bilan joyida kelishasiz.",
        "Do‘st taklif qilsangiz, chegirma shu narxdan.",
        "1 yakunlangan do‘st = 1%.",
      ].join("\n")
    : [
        "💵 ЦЕНА",
        "",
        HR,
        "",
        "Каталога услуг нет.",
        "Цену согласуете с мастером на месте.",
        "Скидка за друзей, которые уже завершили заказ:",
        "1 друг = 1%, 10 друзей = 10%.",
      ].join("\n");
}

export function formatHowTo(lang: "ru" | "uz"): string {
  if (lang === "uz") {
    return [
      "ℹ️ ALL SERVIS QANDAY ISHLAYDI?",
      "",
      "1️⃣ «Ariza» ni bosing",
      "2️⃣ Izoh: nima bo‘ldi",
      "3️⃣ Foto (o‘tkazish mumkin)",
      "4️⃣ 📍 Geolokatsiya",
      "5️⃣ 📱 Telefon",
      "6️⃣ Hozir yoki sana",
      "7️⃣ 👨‍🔧 Shu shahardagi bo‘sh usta",
      "8️⃣ Joyida to‘lov. Chegirma — yakunlangan do‘stlar uchun",
    ].join("\n");
  }
  return [
    "ℹ️ КАК РАБОТАЕТ ALL SERVIS?",
    "",
    "1️⃣ Нажмите «Заявка»",
    "2️⃣ Комментарий: что случилось",
    "3️⃣ Фото, можно пропустить",
    "4️⃣ 📍 Геолокация",
    "5️⃣ 📱 Телефон",
    "6️⃣ Сейчас или на дату",
    "7️⃣ 👨‍🔧 Свободный мастер из вашего города",
    "8️⃣ Оплата мастеру на месте. Скидка — за друзей с завершённым заказом",
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
      "Telefon va geolokatsiya. Mutaxassislik so‘ralmaydi.",
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
    "Нужны телефон и геолокация. Специальность не спрашиваем.",
  ].join("\n");
}

export function formatOpError(lang: "ru" | "uz"): string {
  return lang === "uz"
    ? "❌ OPERATSIYA BAJARILMADI\n\nQayta urinib ko‘ring.\nTakrorlansa — operatorga yozing."
    : "❌ НЕ УДАЛОСЬ ВЫПОЛНИТЬ ОПЕРАЦИЮ\n\nПопробуйте ещё раз.\nЕсли проблема повторяется — напишите оператору.";
}

