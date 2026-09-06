import { o as __toESM } from "../_runtime.mjs";
import { i as STATUS_LABEL } from "./domain-zUVhUtxQ.mjs";
import { a as serviceById } from "./catalog-Cq__2iHb.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { a as require_jsx_runtime, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { s as getMapData } from "./api-B2R1vwTw.mjs";
import { t as cn } from "./utils-CH_OWAWG.mjs";
import { n as OrderBadge, t as OnlineDot } from "./status-badge-BMr_179i.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/map-BKuoWlP7.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var NORTH = 41.4;
var WEST = 69.14;
function xy(lat, lng) {
	const x = (lng - WEST) / .23999999999999488 * 100;
	const y = (NORTH - lat) / .19999999999999574 * 100;
	return {
		x: Math.min(98, Math.max(2, x)),
		y: Math.min(98, Math.max(2, y))
	};
}
function MapCanvas({ masters, orders }) {
	const [sel, setSel] = (0, import_react.useState)(null);
	const selectedOrder = sel?.type === "order" ? orders.find((o) => o.id === sel.id) : null;
	const selectedMaster = sel?.type === "master" ? masters.find((m) => m.id === sel.id) : null;
	const lines = orders.filter((o) => o.master_id && o.lat != null && o.lng != null).map((o) => {
		const m = masters.find((x) => x.id === o.master_id);
		if (!m || m.lat == null || m.lng == null || o.lat == null || o.lng == null) return null;
		return {
			o,
			a: xy(o.lat, o.lng),
			b: xy(m.lat, m.lng)
		};
	}).filter(Boolean);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4 lg:grid-cols-[1fr_20rem]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "hud-grid relative min-h-[28rem] overflow-hidden rounded-xl border border-border bg-surface",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "absolute left-3 top-3 z-10 font-mono text-xs text-accent",
					children: "TASHKENT LIVE GRID"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
					className: "absolute inset-0 size-full",
					viewBox: "0 0 100 100",
					preserveAspectRatio: "none",
					children: lines.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
						x1: l.a.x,
						y1: l.a.y,
						x2: l.b.x,
						y2: l.b.y,
						stroke: "rgb(34 211 238 / 0.45)",
						strokeWidth: "0.35"
					}, l.o.id))
				}),
				orders.map((o) => {
					if (o.lat == null || o.lng == null) return null;
					const p = xy(o.lat, o.lng);
					const waiting = o.status === "waiting_admin" || o.status === "master_rejected";
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						style: {
							left: `${p.x}%`,
							top: `${p.y}%`
						},
						className: cn("absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full", waiting ? "bg-danger shadow-[0_0_10px_#f43f5e]" : "bg-accent shadow-[0_0_10px_#22d3ee]"),
						onClick: () => setSel({
							type: "order",
							id: o.id
						}),
						title: `Заявка №${o.public_no}`
					}, `o-${o.id}`);
				}),
				masters.map((m) => {
					if (m.lat == null || m.lng == null) return null;
					const p = xy(m.lat, m.lng);
					const color = m.online_status === "online" ? "bg-ok" : m.online_status === "busy" ? "bg-warn" : m.online_status === "blocked" ? "bg-danger" : "bg-subtle";
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						style: {
							left: `${p.x}%`,
							top: `${p.y}%`
						},
						className: cn("absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-sm", color, m.online_status === "online" && "pulse-dot"),
						onClick: () => setSel({
							type: "master",
							id: m.id
						}),
						title: `${m.first_name} ${m.last_name}`
					}, `m-${m.id}`);
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "glass-card rounded-xl p-4",
			children: [
				!sel ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3 text-sm text-muted",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Клиент → заявка → администратор → мастер" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
							className: "space-y-1 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-sm bg-ok" }), " Онлайн мастер"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-sm bg-warn" }), " Занят"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-danger" }), " Новая заявка"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-accent" }), " Назначенная заявка"]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-subtle",
							children: "Линия клиент — мастер появляется только после ручного назначения."
						})
					]
				}) : null,
				selectedOrder ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted",
						children: ["ЗАЯВКА №", selectedOrder.public_no]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mt-1 font-medium",
						children: selectedOrder.client_name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: serviceById(selectedOrder.category_slug)?.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm",
						children: selectedOrder.description
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-muted",
						children: selectedOrder.district
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-subtle",
						children: new Date(selectedOrder.created_at).toLocaleString("ru-RU")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrderBadge, { status: selectedOrder.status })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-muted",
						children: STATUS_LABEL[selectedOrder.status]
					})
				] }) : null,
				selectedMaster ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "МАСТЕР"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: "mt-1 font-medium",
						children: [
							selectedMaster.first_name,
							" ",
							selectedMaster.last_name
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OnlineDot, { status: selectedMaster.online_status })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm text-muted",
						children: [
							serviceById(selectedMaster.specialization)?.title,
							" · ",
							selectedMaster.rating.toFixed(2),
							" ·",
							" ",
							selectedMaster.completed_orders,
							" заказов"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-xs text-subtle",
						children: [
							selectedMaster.district,
							" · last seen ",
							new Date(selectedMaster.last_seen).toLocaleTimeString("ru-RU")
						]
					})
				] }) : null
			]
		})]
	});
}
function MapPage() {
	const { data, isPending } = useQuery({
		queryKey: ["map"],
		queryFn: () => getMapData()
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4 p-4 md:p-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-2xl",
			children: "Карта"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "Клиент — заявка — мастер. Линии только после назначения администратором."
		})] }), isPending || !data ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-96 animate-pulse rounded-xl bg-surface-2" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapCanvas, {
			masters: data.masters,
			orders: data.orders
		})]
	});
}
//#endregion
export { MapPage as component };
