import { create } from "zustand";
import { createOrder, pollOrder, rateOrder } from "@/lib/server/api";
import { emptyDraft, reduceBot, statusReply, welcomeMessages } from "@/lib/bot";
import { serviceById } from "@/lib/catalog";
import type { ChatMessage, ChatStep, Draft, LiveOrder } from "@/lib/types";
import type { OrderStatus } from "@/lib/domain";

type State = {
  messages: ChatMessage[];
  step: ChatStep;
  draft: Draft;
  typing: boolean;
  live?: LiveOrder;
  lastStatus?: OrderStatus;
  sendText: (text: string) => void;
  tapButton: (id: string, label: string) => void;
  attachPhoto: (dataUrl: string) => void;
  resetChat: () => void;
  syncLive: () => Promise<void>;
};

let timer: ReturnType<typeof setTimeout> | null = null;
const queue: ChatMessage[][] = [];

function pump(get: () => State, set: (p: Partial<State>) => void) {
  if (timer) return;
  const next = queue[0];
  if (!next) {
    set({ typing: false });
    return;
  }
  if (next.length === 0) {
    queue.shift();
    pump(get, set);
    return;
  }
  set({ typing: true });
  timer = setTimeout(() => {
    timer = null;
    const msg = next.shift();
    if (msg) set({ messages: [...get().messages, msg], typing: next.length > 0 });
    if (next.length === 0) queue.shift();
    pump(get, set);
  }, 420);
}

function enqueue(get: () => State, set: (p: Partial<State>) => void, replies: ChatMessage[]) {
  if (!replies.length) return;
  queue.push([...replies]);
  pump(get, set);
}

async function submitDraft(get: () => State, set: (p: Partial<State>) => void, draft: Draft) {
  const svc = draft.serviceId ? serviceById(draft.serviceId) : undefined;
  if (!svc || !draft.problem || !draft.phone || draft.lat == null || draft.lng == null) return;
  try {
    const res = await createOrder({
      data: {
        name: draft.name || "Клиент Telegram",
        phone: draft.phone,
        category: svc.id,
        description: draft.problem,
        district: draft.neighborhood || draft.city || "Бекабад",
        lat: draft.lat,
        lng: draft.lng,
        comment: draft.comment,
        photos: draft.photos,
        city: draft.city,
        address: draft.fullAddress,
        neighborhood: draft.neighborhood,
      },
    });
    set({
      live: { id: res.id, publicNo: res.publicNo, status: "waiting_admin" },
      lastStatus: "waiting_admin",
    });
    enqueue(get, set, [
      statusReply("waiting_admin"),
      {
        id: `ord-${res.id}`,
        from: "bot",
        text: `Заявка №${res.publicNo}\nСтатус: ожидает назначения мастера\nВыезд от ${svc.from.toLocaleString("ru-RU")} сум`,
        time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        kind: "order",
        orderId: res.id,
      },
    ]);
  } catch {
    enqueue(get, set, [
      {
        id: "err",
        from: "bot",
        text: "Не удалось создать заявку. Войдите в аккаунт и попробуйте снова.",
        time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    set({ step: "confirm" });
  }
}

export const useChatStore = create<State>((set, get) => ({
  messages: welcomeMessages(),
  step: "category",
  draft: emptyDraft(),
  typing: false,

  sendText: (text) => apply(get, set, { type: "text", text }),
  tapButton: (id, label) => {
    if (id.startsWith("rate:") && get().live) {
      const rating = Number(id.slice(5));
      void rateOrder({ data: { orderId: get().live!.id, rating } });
    }
    apply(get, set, { type: "tap", id, label });
  },
  attachPhoto: (dataUrl) => apply(get, set, { type: "photo", dataUrl }),
  resetChat: () => {
    if (timer) clearTimeout(timer);
    timer = null;
    queue.length = 0;
    set({
      messages: welcomeMessages(),
      step: "category",
      draft: emptyDraft(),
      typing: false,
      live: undefined,
      lastStatus: undefined,
    });
  },
  syncLive: async () => {
    const live = get().live;
    if (!live) return;
    try {
      const o = await pollOrder({ data: live.id });
      if (!o) return;
      if (o.status !== get().lastStatus) {
        set({
          lastStatus: o.status,
          live: { ...live, status: o.status, masterName: o.master_name },
          step: o.status === "completed" ? "rate" : o.status === "cancelled" ? "idle" : "live",
        });
        enqueue(get, set, [statusReply(o.status, o.master_name)]);
      }
    } catch {
      /* session */
    }
  },
}));

function apply(
  get: () => State,
  set: (p: Partial<State>) => void,
  event: { type: "text"; text: string } | { type: "tap"; id: string; label: string } | { type: "photo"; dataUrl: string },
) {
  const state = get();
  const result = reduceBot(state.step, state.draft, event);
  if (result.userMessage) set({ messages: [...get().messages, result.userMessage] });
  set({ step: result.step, draft: result.draft });
  if (result.submit) {
    void submitDraft(get, set, result.submit);
    return;
  }
  enqueue(get, set, result.replies);
}
