import { o as __toESM } from "../_runtime.mjs";
import { a as serviceById } from "./catalog-Cq__2iHb.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { a as require_jsx_runtime, i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { r as candidatesForOrder, t as assignMaster } from "./api-B2R1vwTw.mjs";
import { t as cn } from "./utils-CH_OWAWG.mjs";
import { t as OnlineDot } from "./status-badge-BMr_179i.mjs";
import { t as Button } from "./button-PrOHLo0L.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/assign-dialog-ivRF0zth.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AssignDialog({ orderId, publicNo, clientName, onClose }) {
	const qc = useQueryClient();
	const { data, isPending } = useQuery({
		queryKey: ["candidates", orderId],
		queryFn: () => candidatesForOrder({ data: orderId })
	});
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [sort, setSort] = (0, import_react.useState)("km");
	const [picked, setPicked] = (0, import_react.useState)(null);
	const [confirm, setConfirm] = (0, import_react.useState)(false);
	const masters = (0, import_react.useMemo)(() => {
		let list = data?.masters ?? [];
		if (filter === "online") list = list.filter((m) => m.online_status === "online" || m.online_status === "busy");
		if (filter === "free") list = list.filter((m) => m.online_status === "online" && m.active_orders === 0);
		if (filter === "spec") list = list.filter((m) => m.recommended);
		const copy = [...list];
		copy.sort((a, b) => {
			if (sort === "rating") return b.rating - a.rating;
			if (sort === "jobs") return b.completed_orders - a.completed_orders;
			if (a.km == null) return 1;
			if (b.km == null) return -1;
			return a.km - b.km;
		});
		return copy;
	}, [
		data,
		filter,
		sort
	]);
	const pickedRow = masters.find((m) => m.id === picked) ?? data?.masters.find((m) => m.id === picked);
	const mut = useMutation({
		mutationFn: () => assignMaster({ data: {
			orderId,
			masterId: picked
		} }),
		onSuccess: async (res) => {
			if (!res.success) return;
			await qc.invalidateQueries();
			onClose();
		}
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 md:items-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "glass-card flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "border-b border-border px-5 py-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "Назначить мастера"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
							className: "font-display text-lg",
							children: ["Заявка №", publicNo]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-sm text-muted",
							children: [clientName ? `Клиент: ${clientName}. ` : "", "Рекомендации по дистанции и специализации — решение только за вами."]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2 border-b border-border px-5 py-3",
					children: [[
						["all", "Все"],
						["online", "Онлайн"],
						["free", "Свободен"],
						["spec", "Специализация"]
					].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setFilter(id),
						className: cn("h-9 rounded-full px-3 text-xs font-medium", filter === id ? "bg-accent text-primary-fg" : "bg-surface-2 text-muted"),
						children: label
					}, id)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: sort,
						onChange: (e) => setSort(e.target.value),
						className: "ml-auto h-9 rounded-md bg-surface-2 px-2 text-xs text-fg",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "km",
								children: "По расстоянию"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "rating",
								children: "По рейтингу"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "jobs",
								children: "По заказам"
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-h-0 flex-1 space-y-2 overflow-y-auto p-4",
					children: [isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "p-6 text-sm text-muted",
						children: "Загрузка парка…"
					}) : null, masters.map((m) => {
						const totalDec = m.accepted_orders + m.rejected_orders;
						const acceptPct = totalDec ? Math.round(m.accepted_orders / totalDec * 100) : 0;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => {
								setPicked(m.id);
								setConfirm(true);
							},
							className: cn("flex w-full items-start justify-between gap-3 rounded-lg bg-surface-2 p-3 text-left shadow-[var(--shadow-border)]", picked === m.id && "ring-1 ring-accent"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "font-medium",
										children: [
											m.first_name,
											" ",
											m.last_name
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-1 text-xs text-muted",
										children: [
											serviceById(m.specialization)?.title,
											" · ",
											m.rating.toFixed(2),
											" · ",
											m.completed_orders,
											" заказов · принятие ",
											acceptPct,
											"% · активных ",
											m.active_orders
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-1 text-xs text-accent",
										children: [
											m.km != null ? `${m.km} км от клиента` : "нет координат",
											m.recommended ? " · рекомендуется" : "",
											m.city ? ` · ${m.city}` : ""
										]
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OnlineDot, { status: m.online_status })]
						}, m.id);
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
					className: "flex justify-end gap-2 border-t border-border px-5 py-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: onClose,
						children: "Закрыть"
					})
				})
			]
		}), confirm && pickedRow ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "glass-card w-full max-w-md rounded-xl p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "font-display text-lg",
						children: "Подтвердить назначение?"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm text-muted",
						children: [
							"Заявка №",
							publicNo,
							clientName ? ` · ${clientName}` : "",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
							"Мастер: ",
							pickedRow.first_name,
							" ",
							pickedRow.last_name,
							pickedRow.km != null ? ` · ${pickedRow.km} км` : ""
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-danger",
						children: mut.data && !mut.data.success ? mut.data.error : null
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex justify-end gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "outline",
							onClick: () => setConfirm(false),
							children: "Отмена"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							disabled: mut.isPending,
							onClick: () => mut.mutate(),
							children: "Назначить"
						})]
					})
				]
			})
		}) : null]
	});
}
//#endregion
export { AssignDialog as t };
