import { s as formatSum } from "./domain-zUVhUtxQ.mjs";
import { a as serviceById } from "./catalog-Cq__2iHb.mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { a as Route$4 } from "./router-DOTwMh3n.mjs";
import { p as listMasters } from "./api-B2R1vwTw.mjs";
import { t as OnlineDot } from "./status-badge-BMr_179i.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/masters-DAMIhDBg.js
var import_jsx_runtime = require_jsx_runtime();
function MastersPage() {
	const { filter } = Route$4.useSearch();
	const { data = [], isPending } = useQuery({
		queryKey: ["masters"],
		queryFn: () => listMasters()
	});
	let list = [...data];
	if (filter === "online") list = list.filter((m) => m.online_status === "online");
	if (filter === "busy") list = list.filter((m) => m.online_status === "busy");
	if (filter === "rating") list.sort((a, b) => b.rating - a.rating);
	const ranked = [...data].sort((a, b) => b.rating - a.rating);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6 p-4 md:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl",
				children: "Мастера"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Heartbeat 2 минуты. Offline не назначается автоматически — решение за вами."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mb-3 text-sm text-muted",
				children: "Рейтинг"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "space-y-2",
				children: ranked.slice(0, 8).map((m, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between rounded-lg bg-surface px-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-sm",
						children: [
							i + 1,
							". ",
							m.first_name,
							" ",
							m.last_name
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-sm text-accent",
						children: m.rating.toFixed(2)
					})]
				}, m.id))
			})] }),
			isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Загрузка парка…"
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-3 md:grid-cols-2 xl:grid-cols-3",
				children: list.map((m) => {
					const accept = m.accepted_orders + m.rejected_orders;
					const rate = accept ? Math.round(m.accepted_orders / accept * 100) : 0;
					const rej = accept ? Math.round(m.rejected_orders / accept * 100) : 0;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/admin/masters/$id",
						params: { id: String(m.id) },
						className: "glass-card rounded-xl p-4 transition-colors hover:bg-surface-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
									className: "font-medium",
									children: [
										m.first_name,
										" ",
										m.last_name
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted",
									children: serviceById(m.specialization)?.title
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OnlineDot, { status: m.online_status })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 font-mono text-lg text-accent",
								children: m.rating.toFixed(2)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-xs text-muted",
								children: [
									m.completed_orders,
									" заказов · принятие ",
									rate,
									"% · отказы ",
									rej,
									"% · среднее ",
									m.avg_minutes,
									" мин"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-xs text-subtle",
								children: [
									"Активных: ",
									m.active_orders,
									" · ",
									formatSum(m.earnings)
								]
							})
						]
					}, m.id);
				})
			})
		]
	});
}
//#endregion
export { MastersPage as component };
