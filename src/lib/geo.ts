/** Рабочая зона ALL SERVIS: весь Узбекистан. Заявки не пересекают города. */

export const SERVICE_CITY = "Бекабад";
export const SERVICE_CITY_UZ = "Bekobod";
export const SERVICE_CITY_EN = "Bekabad";
export const SERVICE_COUNTRY = "Uzbekistan";
export const SERVICE_CITY_LAT = 40.2206;
export const SERVICE_CITY_LNG = 69.2697;

/** Полигон городской черты Бекабада (lat, lng). Не покрывает Ташкент (~41.3°N). */
export const SERVICE_POLYGON: [number, number][] = [
  [40.252, 69.218],
  [40.254, 69.268],
  [40.248, 69.305],
  [40.232, 69.328],
  [40.212, 69.332],
  [40.194, 69.318],
  [40.184, 69.288],
  [40.186, 69.248],
  [40.196, 69.214],
  [40.218, 69.202],
  [40.238, 69.206],
];

const UZ_NORTH = 45.6;
const UZ_SOUTH = 37.15;
const UZ_WEST = 55.95;
const UZ_EAST = 73.2;

const BEKABAD_NAMES = [
  "бекабад",
  "бекабод",
  "bekabad",
  "bekobod",
  "bekobod city",
  "bekabad city",
  "город бекабад",
  "шаҳри бекобод",
];

const TASHKENT_CITY_NAMES = [
  "ташкент",
  "toshkent",
  "tashkent",
  "чиланзар",
  "chilonzor",
  "chilanzar",
  "юнусабад",
  "yunusobod",
  "yunusabad",
  "мирабад",
  "mirobod",
  "mirabad",
  "яккасарай",
  "yakkasaroy",
  "yakkasaray",
  "мирзо-улугбек",
  "mirzo ulugbek",
  "шайхантахур",
  "shayxontohur",
  "алмазар",
  "olmazor",
  "учтепа",
  "uchtepa",
  "сергели",
  "sergeli",
  "яшнабад",
  "yashnobod",
  "бектемир",
  "bektemir",
];

export type GeoFix = {
  lat: number;
  lng: number;
  inside: boolean;
  city: string;
  district: string;
  neighborhood: string;
  street: string;
  house: string;
  fullAddress: string;
  source: "polygon" | "nominatim" | "reject";
};

function fold(s: string) {
  return s
    .toLowerCase()
    .replace(/[‘’ʻʼ`']/g, "'")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

export function isBekabadName(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const s = fold(raw);
  if (!s) return false;
  if (s.includes("tashkent region") || s.includes("тошкент вилояти") || s.includes("ташкентская область")) return false;
  return BEKABAD_NAMES.some((n) => s === n || s.includes(n));
}

export function isTashkentDistrictName(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const s = fold(raw);
  return TASHKENT_CITY_NAMES.some((n) => s === n || s.startsWith(n + " ") || s.includes(" " + n));
}

type CitySpot = { key: string; lat: number; lng: number; km: number; names: string[] };

/** Центры городов. Радиус — черта города, не область. Соседний город не захватывается. */
const CITY_SPOTS: CitySpot[] = [
  { key: "Ташкент", lat: 41.3111, lng: 69.2797, km: 18, names: ["ташкент", "tashkent", "toshkent", "тошкент", "чиланзар", "chilonzor", "chilanzar", "юнусабад", "yunusobod", "yunusabad", "мирабад", "mirobod", "mirabad", "яккасарай", "yakkasaroy", "yakkasaray", "мирзо улугбек", "mirzo ulugbek", "шайхантахур", "shayxontohur", "алмазар", "olmazor", "учтепа", "uchtepa", "сергели", "sergeli", "яшнабад", "yashnobod", "yashnabad", "бектемир", "bektemir"] },
  { key: "Бекабад", lat: 40.2206, lng: 69.2697, km: 12, names: ["бекабад", "бекобод", "bekabad", "bekobod"] },
  { key: "Самарканд", lat: 39.6542, lng: 66.9597, km: 14, names: ["самарканд", "samarkand", "samarqand"] },
  { key: "Бухара", lat: 39.7681, lng: 64.4217, km: 12, names: ["бухара", "бухоро", "buxoro", "bukhara"] },
  { key: "Андижан", lat: 40.7821, lng: 72.3442, km: 10, names: ["андижан", "андижон", "andijan", "andijon"] },
  { key: "Наманган", lat: 40.9983, lng: 71.6726, km: 10, names: ["наманган", "namangan"] },
  { key: "Фергана", lat: 40.3864, lng: 71.7864, km: 10, names: ["фергана", "фаргона", "fergana", "fargona"] },
  { key: "Коканд", lat: 40.5286, lng: 70.9425, km: 8, names: ["коканд", "kokand", "qoqon"] },
  { key: "Маргилан", lat: 40.4711, lng: 71.7247, km: 7, names: ["маргилан", "margilan", "margilon"] },
  { key: "Нукус", lat: 42.4611, lng: 59.6003, km: 10, names: ["нукус", "nukus"] },
  { key: "Карши", lat: 38.8606, lng: 65.7891, km: 10, names: ["карши", "qarshi", "karshi"] },
  { key: "Навои", lat: 40.1039, lng: 65.3688, km: 10, names: ["навои", "navoi", "navoiy"] },
  { key: "Ургенч", lat: 41.55, lng: 60.6333, km: 8, names: ["ургенч", "urgench", "urganch"] },
  { key: "Хива", lat: 41.3775, lng: 60.3631, km: 6, names: ["хива", "khiva", "xiva"] },
  { key: "Термез", lat: 37.2242, lng: 67.2783, km: 8, names: ["термез", "termez", "termiz"] },
  { key: "Джизак", lat: 40.1158, lng: 67.8422, km: 8, names: ["джизак", "жиззах", "jizzakh", "jizzax"] },
  { key: "Гулистан", lat: 40.4897, lng: 68.7842, km: 8, names: ["гулистан", "gulistan", "guliston"] },
  { key: "Чирчик", lat: 41.4689, lng: 69.5822, km: 8, names: ["чирчик", "chirchiq", "chirchik"] },
  { key: "Ангрен", lat: 41.0167, lng: 70.1436, km: 8, names: ["ангрен", "angren"] },
  { key: "Алмалык", lat: 40.8448, lng: 69.5983, km: 8, names: ["алмалык", "olmaliq", "almalyk"] },
  { key: "Янгиюль", lat: 41.112, lng: 69.0472, km: 7, names: ["янгиюль", "yangiyol"] },
  { key: "Нурафшон", lat: 41.0436, lng: 69.3578, km: 7, names: ["нурафшон", "nurafshon", "тойтепа", "toytepa"] },
  { key: "Ахангаран", lat: 40.9064, lng: 69.6436, km: 7, names: ["ахангаран", "ohangaron"] },
  { key: "Чиназ", lat: 40.9364, lng: 68.7697, km: 6, names: ["чиназ", "chinoz", "chinaz"] },
  { key: "Шахрисабз", lat: 39.0578, lng: 66.8342, km: 7, names: ["шахрисабз", "shahrisabz"] },
  { key: "Каттакурган", lat: 39.8989, lng: 66.2561, km: 6, names: ["каттакурган", "kattakurgan"] },
  { key: "Зарафшан", lat: 41.5667, lng: 64.2, km: 6, names: ["зарафшан", "zarafshan", "zarafshon"] },
  { key: "Денау", lat: 38.2669, lng: 67.8989, km: 6, names: ["денау", "denov", "denau"] },
  { key: "Паркент", lat: 41.2947, lng: 69.6764, km: 6, names: ["паркент", "parkent"] },
  { key: "Газалкент", lat: 41.5581, lng: 69.7708, km: 6, names: ["газалкент", "gazalkent", "g'azalkent"] },
];

const REGION_WORD = /(област|viloyat|вилоят|region|туман|район|district|tuman)/;

function kmBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function aliasHit(hay: string, needle: string): boolean {
  const i = hay.indexOf(needle);
  if (i < 0) return false;
  const before = hay[i - 1] ?? "";
  const after = hay[i + needle.length] ?? "";
  if (before && !/[\s,.\-/]/.test(before)) return false;
  if (after && !/[\s,.\-/]/.test(after)) return false;
  return true;
}

/** Каноническое имя города. «Ташкентская область» — не Ташкент. Районы Ташкента — Ташкент. */
export function canonicalCity(raw: string | undefined | null): string {
  if (!raw) return "";
  let s = fold(raw).replace(/^(город|шахар|shahar|city)\s+/, "").trim();
  if (!s) return "";
  const aliases = CITY_SPOTS.flatMap((c) => c.names.map((n) => ({ key: c.key, n }))).sort((a, b) => b.n.length - a.n.length);
  if (REGION_WORD.test(s)) {
    const town = aliases.find((a) => a.key !== "Ташкент" && aliasHit(s, a.n));
    return town?.key ?? "";
  }
  for (const a of aliases) {
    if (aliasHit(s, a.n)) return a.key;
  }
  return "";
}

/** Ближайший город, если точка внутри его черты. Иначе пусто — чужой город не подставляем. */
export function cityFromCoords(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  let best: { key: string; km: number } | null = null;
  for (const c of CITY_SPOTS) {
    const km = kmBetween(lat, lng, c.lat, c.lng);
    if (km <= c.km && (!best || km < best.km)) best = { key: c.key, km };
  }
  return best?.key ?? "";
}

const GENERIC_CITY = new Set(["", "узбекистан", "uzbekistan", "o'zbekiston", "ozbekiston", "вне зоны", "не определен", "aniqlanmadi"]);

/** Город для назначения: координаты важнее старой подписи (раньше всем писали «Бекабад»). */
export function assignmentCity(stored: string | null | undefined, lat?: number | null, lng?: number | null): string {
  const latN = lat == null ? NaN : Number(lat);
  const lngN = lng == null ? NaN : Number(lng);
  const gps = Number.isFinite(latN) && Number.isFinite(lngN) ? cityFromCoords(latN, lngN) : "";
  if (gps) return gps;
  const label = canonicalCity(stored);
  if (label) return label;
  const raw = fold(stored ?? "");
  if (GENERIC_CITY.has(raw)) return "";
  return raw;
}

export function sameDispatchCity(
  orderCity: string | null | undefined,
  orderLat: number,
  orderLng: number,
  masterCity: string | null | undefined,
  masterLat: number,
  masterLng: number,
): boolean {
  const a = assignmentCity(orderCity, orderLat, orderLng);
  const b = assignmentCity(masterCity, masterLat, masterLng);
  return Boolean(a && b && a === b);
}

function pointInPolygon(lat: number, lng: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i]![0];
    const xi = ring[i]![1];
    const yj = ring[j]![0];
    const xj = ring[j]![1];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Вся территория Узбекистана, не один город. */
export function isInsideServiceArea(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat <= UZ_NORTH && lat >= UZ_SOUTH && lng >= UZ_WEST && lng <= UZ_EAST;
}

function pickAddr(addr: Record<string, string | undefined>, keys: string[]): string {
  for (const k of keys) {
    const v = addr[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

const geoCache = new Map<string, GeoFix>();

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function fromPolygonOnly(lat: number, lng: number, inside: boolean): GeoFix {
  if (!inside) {
    return {
      lat, lng, inside: false, city: "", district: "", neighborhood: "", street: "", house: "",
      fullAddress: "", source: "reject",
    };
  }
  const city = cityFromCoords(lat, lng);
  return {
    lat, lng, inside: true, city, district: "", neighborhood: "", street: "", house: "",
    fullAddress: city, source: "polygon",
  };
}

export async function reverseGeocode(lat: number, lng: number): Promise<{
  city: string; district: string; neighborhood: string; street: string; house: string; fullAddress: string; countryCode: string;
} | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&format=jsonv2&addressdetails=1&zoom=18&accept-language=ru`;
    const res = await fetch(url, {
      headers: { "User-Agent": "AllServis/1.0 (bekabad-dispatch; contact@allservis.local)", Accept: "application/json" },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string | undefined>;
    };
    const a = data.address ?? {};
    const city = pickAddr(a, ["city", "town", "municipality", "village", "hamlet", "county"]);
    const district = pickAddr(a, ["city_district", "suburb", "district", "county", "state_district"]);
    const neighborhood = pickAddr(a, ["suburb", "neighbourhood", "quarter", "residential", "hamlet"]);
    const streetRaw = pickAddr(a, ["road", "pedestrian", "footway", "residential", "street"]);
    const house = pickAddr(a, ["house_number"]);
    const full = (data.display_name ?? "").trim();
    const street = streetRaw || streetFromText(full);
    const countryCode = String(a.country_code ?? "").toLowerCase();
    return { city, district, neighborhood, street, house, fullAddress: full, countryCode };
  } catch {
    return null;
  }
}

export async function resolveLocation(lat: number, lng: number): Promise<GeoFix> {
  const key = cacheKey(lat, lng);
  const hit = geoCache.get(key);
  if (hit) return hit;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return fromPolygonOnly(lat, lng, false);
  }

  const nom = await reverseGeocode(lat, lng);
  const code = (nom?.countryCode ?? "").toLowerCase();
  const inBox = isInsideServiceArea(lat, lng);
  const inside = code ? code === "uz" : inBox;
  const rawCity = (nom?.city ?? "").trim();
  const city = canonicalCity(rawCity) || canonicalCity(nom?.district) || cityFromCoords(lat, lng) || rawCity;
  const district = nom?.district ?? "";
  const neighborhood = nom?.neighborhood && nom.neighborhood !== city ? nom.neighborhood : "";
  const street = nom?.street ?? "";
  const house = nom?.house ?? "";
  const parts = [city, neighborhood || district, [street, house].filter(Boolean).join(", ")].filter(Boolean);
  const out: GeoFix = {
    lat, lng, inside,
    city,
    district, neighborhood, street, house,
    fullAddress: parts.join(", ") || (nom?.fullAddress ?? ""),
    source: nom ? "nominatim" : "polygon",
  };
  geoCache.set(key, out);
  return out;
}

export function formatGeoCard(geo: GeoFix, lang: "ru" | "uz" = "ru"): string {
  const unk = lang === "uz" ? "aniqlanmadi" : "не определён";
  const city = geo.city || unk;
  const area = geo.neighborhood || geo.district || unk;
  const addr = [geo.street, geo.house].filter(Boolean).join(", ") || (geo.inside ? unk : geo.fullAddress) || unk;
  if (lang === "uz") {
    if (!geo.inside) {
      return [
        "📍 JOYLASHUVNI TEKSHIRISH",
        "",
        "ALL SERVIS hozir butun O‘zbekistonda ishlaydi.",
        "Joylashuv O‘zbekistondan tashqarida.",
        "",
        `🏙 Shahar: ${city}`,
        "",
        "Xizmat shahringizda ochilganda xabar beramiz.",
      ].join("\n");
    }
    return [
      "📍 JOYLASHUV",
      "",
      "✅ Lokatsiya qabul qilindi",
      "",
      `🏙 Shahar: ${city}`,
      `📍 Tuman/mahalla: ${area}`,
      `🏠 Manzil: ${addr}`,
      "",
      "📌 Koordinatalar saqlandi.",
    ].join("\n");
  }
  if (!geo.inside) {
    return [
      "📍 ПРОВЕРКА МЕСТОПОЛОЖЕНИЯ",
      "",
      "ALL SERVIS работает по всему Узбекистану.",
      "Эта точка за пределами страны.",
      "",
      `🏙 Город: ${city || "другой"}`,
      "",
      "Мы сообщим, когда сервис станет доступен в вашем городе.",
    ].join("\n");
  }
  return [
    "📍 МЕСТОПОЛОЖЕНИЕ",
    "",
    "✅ Локация получена",
    "",
    `🏙 Город: ${city}`,
    `📍 Район / махалля: ${area}`,
    `🏠 Адрес: ${addr}`,
    "",
    "📌 Координаты сохранены.",
  ].join("\n");
}

export const OUTSIDE_SERVICE_AREA = "OUTSIDE_SERVICE_AREA";

const STREET_RE = /улиц|проспект|пр-т|переул|тупик|шоссе|проезд|бульвар|массив|ko['’ʻ]?chasi|kuchasi|\bst\.?\b|street|avenue|йўл|yo['’ʻ]?l/i;

/** Улица из строки Nominatim, если поле road пустое. «Лолазар» — махалля, не адрес. */
export function streetFromText(raw: string | null | undefined): string {
  const parts = String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    if (!STREET_RE.test(p)) continue;
    if (/област|район|туман|вилоят|махал|mahalla|mfy/i.test(p)) continue;
    return p;
  }
  return "";
}

/** Улица и дом впереди, махалля следом. Так в профиле не остаётся одно «Лолазар». */
export function placeLine(geo: { street?: string; house?: string; neighborhood?: string; district?: string; fullAddress?: string }): string {
  const street = (geo.street || streetFromText(geo.fullAddress || "") || "").trim();
  const house = (geo.house || "").trim();
  const streetLine = [street, house].filter(Boolean).join(", ");
  const mahalla = (geo.neighborhood || "").trim();
  const area = (geo.district || "").trim();
  const bits = [
    streetLine,
    mahalla && mahalla !== street ? mahalla : "",
    !streetLine && area && area !== mahalla ? area : "",
  ].filter(Boolean);
  return bits.join(", ");
}
