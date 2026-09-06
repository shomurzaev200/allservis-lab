import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { f as listClients, h as listOrders } from "./api-B2R1vwTw.mjs";
import { n as OrderBadge } from "./status-badge-BMr_179i.mjs";
import { t as Input } from "./input-BR2-74_u.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/clients-Cvw5GMXW.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ClientsPage() {
	const [q, setQ] = (0, import_react.useState)("");
	const [openId, setOpenId] = (0, import_react.useState)(null);
	const { data = [], isPending } = useQuery({
		queryKey: ["clients"],
		queryFn: () => listClients()
	});
	const orders = useQuery({
		queryKey: ["orders", "all"],
		queryFn: () => listOrders({ data: { status: "all" } }),
		enabled: openId != null
	});
	const filtered = data.filter((c) => {
		if (!q.trim()) return true;
		const s = q.toLowerCase();
		return c.name.toLowerCase().includes(s) || c.phone.includes(s) || (c.telegram_id ?? "").includes(s);
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4 p-4 md:p-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-end justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl",
				children: "Клиенты"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: "Имя, телефон, Telegram",
				className: "max-w-xs"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "overflow-x-auto rounded-xl border border-border",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full min-w-[56rem] text-left text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "bg-surface-2 text-xs uppercase text-muted",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3",
							children: "Имя"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3",
							children: "Телефон"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3",
							children: "Telegram"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3",
							children: "Район"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3",
							children: "Рейтинг"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3",
							children: "Заказы"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3",
							children: "Готово"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3",
							children: "Отмены"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3",
							children: "Активность"
						})
					] })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					className: "px-3 py-6 text-muted",
					colSpan: 9,
					children: "Загрузка…"
				}) }) : null, filtered.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "cursor-pointer border-t border-border hover:bg-surface-2",
					onClick: () => setOpenId(openId === c.id ? null : c.id),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-3",
							children: c.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-3 font-mono text-xs",
							children: c.phone
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-3 font-mono text-xs",
							children: c.telegram_id ?? "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-3",
							children: c.district
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-3",
							children: Number(c.rating).toFixed(1)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-3",
							children: c.orders_count
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-3",
							children: c.completed_count
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-3",
							children: c.cancelled_count
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-3 text-xs text-muted",
							children: c.last_active ? new Date(c.last_active).toLocaleDateString("ru-RU") : "—"
						})
					]
				}), openId === c.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
					className: "border-t border-border bg-surface",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
						colSpan: 9,
						className: "px-3 py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mb-2 text-xs text-muted",
							children: "История заявок"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-1",
							children: (orders.data ?? []).filter((o) => o.client_id === c.id).map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/admin/orders/$id",
								params: { id: String(o.id) },
								className: "flex items-center justify-between rounded-md px-2 py-2 hover:bg-surface-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-sm",
									children: [
										"№",
										o.public_no,
										" · ",
										o.description
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrderBadge, { status: o.status })]
							}, o.id))
						})]
					})
				}, `${c.id}-h`) : null] }, c.id))] })]
			})
		})]
	});
}
//#endregion
export { ClientsPage as component };
