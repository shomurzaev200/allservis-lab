import { DISTRICT_COORDS } from "./domain";

export type ServiceId =
  | "plumb"
  | "elec"
  | "ac"
  | "appliance"
  | "furniture"
  | "lock"
  | "paint"
  | "other";

export type Service = {
  id: ServiceId;
  title: string;
  hint: string;
  from: number;
  diag: number;
  etaMin: number;
  keywords: string[];
};

export type District = {
  id: string;
  title: string;
  lat: number;
  lng: number;
};

export const SERVICES: Service[] = [
  {
    id: "plumb",
    title: "Сантехник",
    hint: "Краны, трубы, унитаз, засор",
    from: 80_000,
    diag: 30_000,
    etaMin: 25,
    keywords: ["сантех", "кран", "труб", "унитаз", "смесит", "засор", "протеч", "вода", "стояк", "слив", "santex", "kran", "truba"],
  },
  {
    id: "elec",
    title: "Электрик",
    hint: "Розетки, щиток, свет, проводка",
    from: 70_000,
    diag: 30_000,
    etaMin: 30,
    keywords: ["электр", "свет", "розет", "щит", "провод", "автомат", "ламп", "выключ", "elektr", "chiroq", "rozetka"],
  },
  {
    id: "ac",
    title: "Кондиционер",
    hint: "Заправка, чистка, монтаж",
    from: 150_000,
    diag: 40_000,
    etaMin: 40,
    keywords: ["кондиц", "сплит", "заправ", "фреон", "охлажд", "кондёр", "кондер", "konditsioner", "konditsion"],
  },
  {
    id: "appliance",
    title: "Бытовая техника",
    hint: "Стиралка, холодильник, плита",
    from: 100_000,
    diag: 40_000,
    etaMin: 45,
    keywords: ["стирал", "холодиль", "плит", "духов", "посудом", "техника", "машинк", "texnika", "texnik", "sovutgich"],
  },
  {
    id: "furniture",
    title: "Сборка мебели",
    hint: "Шкафы, кухни, IKEA",
    from: 120_000,
    diag: 0,
    etaMin: 60,
    keywords: ["мебел", "сборк", "шкаф", "ikea", "икеа", "кухн", "стол", "кровать", "mebel"],
  },
  {
    id: "lock",
    title: "Замки и двери",
    hint: "Вскрытие, замена, броня",
    from: 90_000,
    diag: 0,
    etaMin: 20,
    keywords: ["замк", "дверь", "двери", "вскры", "ключ", "личинк", "броне", "qulf", "eshik"],
  },
  {
    id: "paint",
    title: "Малярные работы",
    hint: "Стены, потолок, обои",
    from: 200_000,
    diag: 0,
    etaMin: 90,
    keywords: ["маляр", "покрас", "обои", "шпакл", "потолок", "стен", "boyoq", "bo'yoq", "malyar"],
  },
  {
    id: "other",
    title: "Другое",
    hint: "Подберём мастера под задачу",
    from: 80_000,
    diag: 30_000,
    etaMin: 40,
    keywords: ["друг", "не знаю", "мастер", "помощь", "boshqa", "other"],
  },
];

export const DISTRICTS: District[] = Object.entries(DISTRICT_COORDS).map(([id, d]) => ({
  id,
  title: d.title,
  lat: d.lat,
  lng: d.lng,
}));

export function serviceById(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

export function districtById(id: string): District | undefined {
  return DISTRICTS.find((d) => d.id === id);
}

export function matchService(text: string): Service | undefined {
  const q = text.toLowerCase().replace(/[‘’ʻʼ`']/g, "'").trim();
  if (q.startsWith("svc:")) return serviceById(q.slice(4));
  const aliases: Record<string, ServiceId> = {
    техника: "appliance",
    texnika: "appliance",
    "бытовая техника": "appliance",
    сантехник: "plumb",
    santexnik: "plumb",
    электрик: "elec",
    elektrik: "elec",
    кондиционер: "ac",
    konditsioner: "ac",
    мебель: "furniture",
    mebel: "furniture",
    замки: "lock",
    qulflar: "lock",
    маляр: "paint",
    "bo'yoqchi": "paint",
    "bo‘yoqchi": "paint",
    другое: "other",
    boshqa: "other",
  };
  if (aliases[q]) return serviceById(aliases[q]);
  const exact = SERVICES.find((s) => s.title.toLowerCase() === q);
  if (exact) return exact;
  return SERVICES.find((s) => s.keywords.some((k) => q.includes(k)));
}
