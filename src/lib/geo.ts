/** Рабочая зона ALL SERVIS: город Бекабад, Ташкентская область. */

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

const HARD_NORTH = 40.55;
const HARD_SOUTH = 40.12;
const HARD_WEST = 69.08;
const HARD_EAST = 69.42;

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

export function isInsideServiceArea(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat > HARD_NORTH || lat < HARD_SOUTH || lng < HARD_WEST || lng > HARD_EAST) return false;
  return pointInPolygon(lat, lng, SERVICE_POLYGON);
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
  return {
    lat, lng, inside: true, city: SERVICE_CITY, district: "", neighborhood: "", street: "", house: "",
    fullAddress: SERVICE_CITY, source: "polygon",
  };
}

export async function reverseGeocode(lat: number, lng: number): Promise<{
  city: string; district: string; neighborhood: string; street: string; house: string; fullAddress: string;
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
    const city = pickAddr(a, ["city", "town", "municipality", "village", "county"]);
    const district = pickAddr(a, ["city_district", "district", "county", "state_district"]);
    const neighborhood = pickAddr(a, ["suburb", "neighbourhood", "quarter", "residential", "hamlet"]);
    const street = pickAddr(a, ["road", "pedestrian", "street"]);
    const house = pickAddr(a, ["house_number"]);
    const full = (data.display_name ?? "").trim();
    return { city, district, neighborhood, street, house, fullAddress: full };
  } catch {
    return null;
  }
}

export async function resolveLocation(lat: number, lng: number): Promise<GeoFix> {
  const key = cacheKey(lat, lng);
  const hit = geoCache.get(key);
  if (hit) return hit;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const miss = fromPolygonOnly(lat, lng, false);
    return miss;
  }

  if (lat > HARD_NORTH || lat < HARD_SOUTH || lng < HARD_WEST || lng > HARD_EAST) {
    const nom = await reverseGeocode(lat, lng);
    const city = nom?.city ?? "";
    const out: GeoFix = {
      lat, lng, inside: false,
      city: isBekabadName(city) ? SERVICE_CITY : (isTashkentDistrictName(city) ? city : city),
      district: nom?.district && !isTashkentDistrictName(nom.district) ? nom.district : "",
      neighborhood: nom?.neighborhood && !isTashkentDistrictName(nom.neighborhood) ? nom.neighborhood : "",
      street: nom?.street ?? "",
      house: nom?.house ?? "",
      fullAddress: nom?.fullAddress ?? "",
      source: "reject",
    };
    if (isTashkentDistrictName(city) || isTashkentDistrictName(nom?.district) || isTashkentDistrictName(nom?.neighborhood)) {
      out.neighborhood = "";
      if (isTashkentDistrictName(out.district)) out.district = "";
    }
    geoCache.set(key, out);
    return out;
  }

  const inPoly = isInsideServiceArea(lat, lng);
  const nom = await reverseGeocode(lat, lng);
  const nomCity = nom?.city ?? "";
  const nomSaysBekabad = isBekabadName(nomCity) || isBekabadName(nom?.district) || isBekabadName(nom?.fullAddress);
  const nomSaysTashkentCity = isTashkentDistrictName(nomCity) && !nomSaysBekabad;

  const inside = (inPoly || nomSaysBekabad) && !nomSaysTashkentCity;
  const neighborhood = inside
    ? (nom?.neighborhood && !isTashkentDistrictName(nom.neighborhood) && !isBekabadName(nom.neighborhood) ? nom.neighborhood : "")
    : (nom?.neighborhood ?? "");
  const district = inside
    ? (nom?.district && !isTashkentDistrictName(nom.district) && !isBekabadName(nom.district) ? nom.district : "")
    : (nom?.district ?? "");
  const street = nom?.street ?? "";
  const house = nom?.house ?? "";
  const city = inside ? SERVICE_CITY : (nomCity || "");
  const parts = [city, neighborhood || district, [street, house].filter(Boolean).join(", ")].filter(Boolean);
  const out: GeoFix = {
    lat, lng, inside,
    city, district, neighborhood, street, house,
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
        "Afsuski, ALL SERVIS hozir faqat Bekobod shahrida ishlaydi.",
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
      "К сожалению, ALL SERVIS пока работает только в городе Бекабад.",
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
