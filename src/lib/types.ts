import type { ServiceId } from "./catalog";
import type { OrderStatus } from "./domain";

export type ChatStep =
  | "lang"
  | "role"
  | "category"
  | "problem"
  | "photo"
  | "geo_choice"
  | "district"
  | "geo"
  | "phone"
  | "comment"
  | "confirm"
  | "live"
  | "support"
  | "rate"
  | "idle"
  | "master_spec"
  | "master_phone"
  | "master_geo";

export type KeyboardButton = {
  id: string;
  label: string;
  requestContact?: boolean;
  requestLocation?: boolean;
};

export type ChatMessage = {
  id: string;
  from: "bot" | "user" | "system";
  text: string;
  time: string;
  buttons?: KeyboardButton[][];
  orderId?: number;
  masterName?: string;
  kind?: "text" | "order" | "master" | "status";
};

export type Lang = "ru" | "uz";
export type UserRole = "client" | "master";

export type Draft = {
  serviceId?: ServiceId;
  problem?: string;
  photos: string[];
  districtId?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  fullAddress?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  comment?: string;
  name: string;
  lang?: Lang;
  role?: UserRole;
};

export type LiveOrder = {
  id: number;
  publicNo: number;
  status: OrderStatus;
  masterName?: string | null;
};
