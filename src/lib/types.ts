import type { ServiceId } from "./catalog";
import type { OrderStatus } from "./domain";

export type ChatStep =
  | "category"
  | "problem"
  | "photo"
  | "district"
  | "phone"
  | "comment"
  | "confirm"
  | "live"
  | "rate"
  | "idle";

export type KeyboardButton = {
  id: string;
  label: string;
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

export type Draft = {
  serviceId?: ServiceId;
  problem?: string;
  photos: string[];
  districtId?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  comment?: string;
  name: string;
};

export type LiveOrder = {
  id: number;
  publicNo: number;
  status: OrderStatus;
  masterName?: string | null;
};
