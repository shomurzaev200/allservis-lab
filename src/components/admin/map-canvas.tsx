import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { MasterRow, OrderRow } from "@/lib/server/api";
import { STATUS_LABEL } from "@/lib/domain";
import { OnlineDot, OrderBadge } from "./status-badge";
import { serviceById } from "@/lib/catalog";
import { DISTRICTS } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const SOUTH = 41.2;
const NORTH = 41.4;
const WEST = 69.14;
const EAST = 69.38;

function xy(lat: number, lng: number) {
  const x = ((lng - WEST) / (EAST - WEST)) * 100;
  const y = ((NORTH - lat) / (NORTH - SOUTH)) * 100;
  return { x: Math.min(98, Math.max(2, x)), y: Math.min(98, Math.max(2, y)) };
}

export function MapCanvas({
  masters,
  orders,
}: {
  masters: MasterRow[];
  orders: OrderRow[];
}) {
  const [sel, setSel] = useState<{ type: "order" | "master"; id: number } | null>(null);
  const selectedOrder = sel?.type === "order" ? orders.find((o) => o.id === sel.id) : null;
  const selectedMaster = sel?.type === "master" ? masters.find((m) => m.id === sel.id) : null;
  const waiting = orders.filter((o) => o.status === "waiting_admin" || o.status === "master_rejected");
  const online = masters.filter((m) => m.online_status === "online" || m.online_status === "busy");

  const lines = orders
    .filter((o) => o.master_id && o.lat != null && o.lng != null)
    .map((o) => {
      const m = masters.find((x) => x.id === o.master_id);
      if (!m || m.lat == null || m.lng == null || o.lat == null || o.lng == null) return null;
      return { o, a: xy(o.lat, o.lng), b: xy(m.lat, m.lng) };
    })
    .filter(Boolean) as { o: OrderRow; a: { x: number; y: number }; b: { x: number; y: number } }[];

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
      <div className="relative min-h-[32rem] overflow-hidden rounded-xl border border-border bg-surface">
        <iframe
          title="Ташкент"
          className="pointer-events-none absolute inset-0 size-full opacity-55 grayscale contrast-125"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${WEST}%2C${SOUTH}%2C${EAST}%2C${NORTH}&layer=mapnik`}
        />
        <div className="absolute inset-0 bg-bg/35" />
        <p className="absolute left-3 top-3 z-10 font-mono text-xs text-accent">TASHKENT · OSM LIVE</p>
        <svg className="absolute inset-0 z-[1] size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {lines.map((l) => (
            <line key={l.o.id} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke="rgb(34 211 238 / 0.7)" strokeWidth="0.4" />
          ))}
        </svg>
        {DISTRICTS.map((d) => {
          const p = xy(d.lat, d.lng);
          return (
            <span
              key={d.id}
              className="pointer-events-none absolute z-[2] -translate-x-1/2 font-mono text-[10px] uppercase tracking-wide text-subtle"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              {d.title}
            </span>
          );
        })}
        {orders.map((o) => {
          if (o.lat == null || o.lng == null) return null;
          const p = xy(o.lat, o.lng);
          const wait = o.status === "waiting_admin" || o.status === "master_rejected";
          return (
            <button
              key={`o-${o.id}`}
              type="button"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              className={cn(
                "absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full",
                wait ? "bg-danger shadow-[0_0_10px_#f43f5e]" : "bg-accent shadow-[0_0_10px_#22d3ee]",
              )}
              onClick={() => setSel({ type: "order", id: o.id })}
              title={`Заявка №${o.public_no} · ${o.client_name}`}
            />
          );
        })}
        {masters.map((m) => {
          if (m.lat == null || m.lng == null) return null;
          const p = xy(m.lat, m.lng);
          const color =
            m.online_status === "online"
              ? "bg-ok"
              : m.online_status === "busy"
                ? "bg-warn"
                : m.online_status === "blocked"
                  ? "bg-danger"
                  : "bg-subtle";
          return (
            <button
              key={`m-${m.id}`}
              type="button"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              onClick={() => setSel({ type: "master", id: m.id })}
              title={`${m.first_name} ${m.last_name} · ${m.district}`}
            >
              <span className={cn("block size-3 rounded-sm", color, m.online_status === "online" && "pulse-dot")} />
              <span className="mt-0.5 block whitespace-nowrap text-[10px] text-fg drop-shadow">
                {m.first_name}
              </span>
            </button>
          );
        })}
      </div>
      <aside className="space-y-3">
        <div className="glass-card rounded-xl p-4">
          {!sel ? (
            <div className="space-y-3 text-sm text-muted">
              <p>Клиент → заявка → администратор → мастер. Линия появляется только после назначения.</p>
              <ul className="space-y-1 text-xs">
                <li className="flex items-center gap-2"><span className="size-2 rounded-sm bg-ok" /> Онлайн мастер</li>
                <li className="flex items-center gap-2"><span className="size-2 rounded-sm bg-warn" /> Занят</li>
                <li className="flex items-center gap-2"><span className="size-2 rounded-full bg-danger" /> Новая заявка</li>
                <li className="flex items-center gap-2"><span className="size-2 rounded-full bg-accent" /> Назначенная заявка</li>
              </ul>
            </div>
          ) : null}
          {selectedOrder ? (
            <div>
              <p className="text-xs text-muted">ЗАЯВКА №{selectedOrder.public_no}</p>
              <h3 className="mt-1 font-medium">{selectedOrder.client_name}</h3>
              <p className="mt-1 text-sm text-muted">{serviceById(selectedOrder.category_slug)?.title}</p>
              <p className="mt-2 text-sm">{selectedOrder.description}</p>
              <p className="mt-2 text-xs text-muted">{selectedOrder.district} · {selectedOrder.phone}</p>
              <p className="mt-1 text-xs text-subtle">{selectedOrder.lat?.toFixed(5)}, {selectedOrder.lng?.toFixed(5)}</p>
              <div className="mt-3"><OrderBadge status={selectedOrder.status} /></div>
              <p className="mt-2 text-xs text-muted">{STATUS_LABEL[selectedOrder.status]}</p>
              <Link className="mt-3 inline-block text-sm text-accent" to="/admin/orders/$id" params={{ id: String(selectedOrder.id) }}>
                Открыть карточку
              </Link>
            </div>
          ) : null}
          {selectedMaster ? (
            <div>
              <p className="text-xs text-muted">МАСТЕР</p>
              <h3 className="mt-1 font-medium">{selectedMaster.first_name} {selectedMaster.last_name}</h3>
              <div className="mt-2"><OnlineDot status={selectedMaster.online_status} /></div>
              <p className="mt-2 text-sm text-muted">
                {serviceById(selectedMaster.specialization)?.title} · {selectedMaster.rating.toFixed(2)} · {selectedMaster.completed_orders} заказов
              </p>
              <p className="mt-1 text-xs">{selectedMaster.phone}</p>
              <p className="mt-1 text-xs text-subtle">
                {selectedMaster.district} · {selectedMaster.lat?.toFixed(5)}, {selectedMaster.lng?.toFixed(5)}
              </p>
              <Link className="mt-3 inline-block text-sm text-accent" to="/admin/masters/$id" params={{ id: String(selectedMaster.id) }}>
                Профиль мастера
              </Link>
            </div>
          ) : null}
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Ждут назначения · {waiting.length}</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-sm">
            {waiting.map((o) => (
              <li key={o.id}>
                <button type="button" className="w-full text-left hover:text-accent" onClick={() => setSel({ type: "order", id: o.id })}>
                  №{o.public_no} · {o.district} · {serviceById(o.category_slug)?.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-muted">На линии · {online.length}</p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-sm">
            {online.map((m) => (
              <li key={m.id}>
                <button type="button" className="flex w-full items-center justify-between text-left hover:text-accent" onClick={() => setSel({ type: "master", id: m.id })}>
                  <span>{m.first_name} {m.last_name}</span>
                  <OnlineDot status={m.online_status} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
