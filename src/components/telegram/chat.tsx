import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, MoreVertical, Paperclip, Send } from "lucide-react";
import { useChatStore } from "@/lib/chat-store";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TelegramPhone({ framed = true }: { framed?: boolean }) {
  const inner = <TelegramChat />;
  if (!framed) return <div className="flex h-full min-h-0 flex-col bg-tg-bg">{inner}</div>;
  return (
    <div className="phone-bezel mx-auto w-full max-w-sm overflow-hidden p-2">
      <div className="relative flex phone-screen flex-col overflow-hidden rounded-phone-inner bg-tg-bg">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-2">
          <span className="h-5 w-24 rounded-full bg-black/80" />
        </div>
        {inner}
      </div>
    </div>
  );
}

function TelegramChat() {
  const messages = useChatStore((s) => s.messages);
  const typing = useChatStore((s) => s.typing);
  const sendText = useChatStore((s) => s.sendText);
  const tapButton = useChatStore((s) => s.tapButton);
  const attachPhoto = useChatStore((s) => s.attachPhoto);
  const syncLive = useChatStore((s) => s.syncLive);
  const live = useChatStore((s) => s.live);
  const [value, setValue] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => void syncLive(), 3500);
    return () => clearInterval(t);
  }, [live, syncLive]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = value.trim();
    if (!t) return;
    sendText(t);
    setValue("");
  }

  const lastBot = [...messages].reverse().find((m) => m.from === "bot");
  const keyboard = lastBot?.buttons?.length ? lastBot : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 bg-tg-header px-2 pb-2 pt-7 text-tg-text">
        <span className="flex size-10 items-center justify-center text-tg-meta">
          <ArrowLeft className="size-5" />
        </span>
        <span className="flex size-10 items-center justify-center rounded-full bg-accent/20 font-display text-sm font-semibold text-accent">
          A
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">All Servis</p>
          <p className="text-xs text-tg-meta">{typing ? "печатает…" : "бот · онлайн"}</p>
        </div>
        <span className="flex size-10 items-center justify-center text-tg-link">
          <MoreVertical className="size-5" />
        </span>
      </header>

      <div ref={scroller} className="tg-wallpaper min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {typing ? <TypingBubble /> : null}
      </div>

      {keyboard && !typing ? (
        <div className="shrink-0 space-y-1.5 bg-tg-composer px-2 pb-2 pt-1">
          {keyboard.buttons!.map((row, i) => (
            <div key={i} className={cn("grid gap-1.5", row.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
              {row.map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => tapButton(btn.id, btn.label)}
                  className="min-h-11 rounded-md bg-tg-btn px-2 text-center text-sm font-medium text-tg-btn-text transition-opacity duration-150 hover:opacity-90 active:scale-[0.98]"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex shrink-0 items-center gap-1 bg-tg-composer px-2 py-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === "string") attachPhoto(reader.result);
            };
            reader.readAsDataURL(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="flex size-10 items-center justify-center text-tg-meta"
          onClick={() => fileRef.current?.click()}
          aria-label="Фото"
        >
          <Paperclip className="size-5" />
        </button>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Сообщение"
          className="h-10 min-w-0 flex-1 rounded-full bg-tg-input px-4 text-sm text-tg-text placeholder:text-tg-meta outline-none"
          autoComplete="off"
        />
        <button
          type="submit"
          className="flex size-10 items-center justify-center rounded-full text-tg-link transition-transform duration-150 active:scale-[0.96]"
          aria-label="Отправить"
        >
          <Send className="size-5" />
        </button>
      </form>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  if (message.from === "system") {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-tg-date px-3 py-1 text-xs font-medium text-tg-meta">{message.text}</span>
      </div>
    );
  }
  const mine = message.from === "user";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-xs rounded-lg px-2.5 py-1.5 text-sm leading-snug text-tg-text",
          mine ? "rounded-br-sm bg-tg-out" : "rounded-bl-sm bg-tg-in",
        )}
      >
        <p className="whitespace-pre-wrap">{message.text}</p>
        <div className="mt-0.5 flex justify-end">
          <span className="text-xs text-tg-meta">{message.time}</span>
        </div>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-lg rounded-bl-sm bg-tg-in px-3 py-2.5">
        <span className="typing-dot size-1.5 rounded-full bg-tg-meta" />
        <span className="typing-dot size-1.5 rounded-full bg-tg-meta" />
        <span className="typing-dot size-1.5 rounded-full bg-tg-meta" />
      </div>
    </div>
  );
}
