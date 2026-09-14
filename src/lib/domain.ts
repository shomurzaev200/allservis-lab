export const ORDER_STATUSES = [
  "waiting_admin",
  "assigned",
  "master_accepted",
  "master_rejected",
  "enroute",
  "arrived",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OnlineStatus = "online" | "busy" | "offline" | "blocked";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  waiting_admin: "Ожидает назначения",
  assigned: "Назначен, ждёт мастера",
  master_accepted: "Мастер принял",
  master_rejected: "Мастер отказался",
  enroute: "В пути",
  arrived: "На месте",
  in_progress: "В работе",
  completed: "Завершён",
  cancelled: "Отменён",
};

export const STATUS_TONE: Record<OrderStatus, "cyan" | "ok" | "warn" | "danger" | "muted"> = {
  waiting_admin: "warn",
  assigned: "cyan",
  master_accepted: "ok",
  master_rejected: "danger",
  enroute: "cyan",
  arrived: "ok",
  in_progress: "ok",
  completed: "muted",
  cancelled: "danger",
};

export const ACTIVE_ORDER: OrderStatus[] = [
  "assigned",
  "master_accepted",
  "enroute",
  "arrived",
  "in_progress",
];

export const ASSIGNABLE: OrderStatus[] = ["waiting_admin", "master_rejected", "assigned"];

export const DISTRICT_COORDS: Record<string, { lat: number; lng: number; title: string }> = {
  bekabad: { lat: 40.2206, lng: 69.2697, title: "Бекабад" },
};

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 10) / 10;
}

export function formatSum(n: number): string {
  return `${Math.round(n).toLocaleString("ru-RU")} сум`;
}

export function clientLabel(status: OrderStatus): string {
  switch (status) {
    case "waiting_admin":
      return "Администратор подбирает мастера";
    case "assigned":
      return "Мастер назначен — ожидает подтверждения";
    case "master_accepted":
      return "Мастер принял заявку";
    case "master_rejected":
      return "Мастер отказался. Администратор назначит другого";
    case "enroute":
      return "Мастер выехал к вам";
    case "arrived":
      return "Мастер на месте";
    case "in_progress":
      return "Работа начата";
    case "completed":
      return "Работа завершена. Оцените мастера";
    case "cancelled":
      return "Заявка отменена";
    default:
      return STATUS_LABEL[status];
  }
}
