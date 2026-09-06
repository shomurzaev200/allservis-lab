import { o as __toESM } from "../_runtime.mjs";
import { i as STATUS_LABEL, r as ORDER_STATUSES } from "./domain-zUVhUtxQ.mjs";
import { a as serviceById } from "./catalog-Cq__2iHb.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { r as Route$2 } from "./router-DOTwMh3n.mjs";
import { h as listOrders } from "./api-B2R1vwTw.mjs";
import { n as OrderBadge } from "./status-badge-BMr_179i.mjs";
import { t as Button } from "./button-PrOHLo0L.mjs";
import { t as AssignDialog } from "./assign-dialog-ivRF0zth.mjs";
import { t as Input } from "./input-BR2-74_u.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/orders-Co4T1yb_.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function OrdersPage() {
	const search = Route$2.useSearch();
	const [status, setStatus] = (0, import_react.useState)(search.status ?? "all");
	const [q, setQ] = (0, import_react.useState)(search.q ?? "");
	const [assign, setAssign] = (0, import_react.useState)(null);
	const { data = [], isPending } = useQuery({
		queryKey: [
			"orders",
			status,
			q
		],
		queryFn: () => listOrders({ data: {
			status,
			q
		} })
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4 p-4 md:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-2xl",
					children: "Заявки"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Назначение мастера — только вручную."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Поиск: клиент, телефон, номер",
					className: "max-w-xs"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
						id: "all",
						label: "Все",
						cur: status,
						set: setStatus
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
						id: "waiting",
						label: "Ожидают",
						cur: status,
						set: setStatus
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
						id: "work",
						label: "В работе",
						cur: status,
						set: setStatus
					}),
					ORDER_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
						id: s,
						label: STATUS_LABEL[s],
						cur: status,
						set: setStatus
					}, s))
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-x-auto rounded-xl border border-border",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[56rem] text-left text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "bg-surface-2 text-xs uppercase tracking-wider text-muted",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-3",
								children: "ID"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-3",
								children: "Клиент"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-3",
								children: "Категория"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-3",
								children: "Мастер"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-3",
								children: "Статус"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-3",
								children: "Район"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-3",
								children: "Создана"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-3",
								children: "Обновлена"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "px-3 py-3" })
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [
						isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-8 text-muted",
							colSpan: 9,
							children: "Загрузка…"
						}) }) : null,
						!isPending && data.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-8 text-muted",
							colSpan: 9,
							children: "Нет заявок по фильтру"
						}) }) : null,
						data.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "px-3 py-3 font-mono text-xs",
									children: ["№", o.public_no]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-3",
									children: o.client_name
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-3",
									children: serviceById(o.category_slug)?.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-3",
									children: o.master_name ?? "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-3",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrderBadge, { status: o.status })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-3",
									children: o.district
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-3 text-xs text-muted",
									children: new Date(o.created_at).toLocaleString("ru-RU")
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-3 text-xs text-muted",
									children: new Date(o.updated_at).toLocaleString("ru-RU")
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-3 py-3",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											size: "sm",
											variant: "outline",
											asChild: true,
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
												to: "/admin/orders/$id",
												params: { id: String(o.id) },
												children: "Карточка"
											})
										}), o.status === "waiting_admin" || o.status === "master_rejected" || o.status === "assigned" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											size: "sm",
											onClick: () => setAssign({
												id: o.id,
												no: o.public_no,
												name: o.client_name
											}),
											children: "Назначить"
										}) : null]
									})
								})
							]
						}, o.id))
					] })]
				})
			}),
			assign ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssignDialog, {
				orderId: assign.id,
				publicNo: assign.no,
				clientName: assign.name,
				onClose: () => setAssign(null)
			}) : null
		]
	});
}
function FilterChip({ id, label, cur, set }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick: () => set(id),
		className: cur === id ? "h-9 rounded-full bg-accent px-3 text-xs font-medium text-primary-fg" : "h-9 rounded-full bg-surface-2 px-3 text-xs text-muted",
		children: label
	});
}
//#endregion
export { OrdersPage as component };
