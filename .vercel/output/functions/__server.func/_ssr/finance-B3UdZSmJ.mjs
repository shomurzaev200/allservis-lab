import { s as formatSum } from "./domain-zUVhUtxQ.mjs";
import { a as require_jsx_runtime, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { o as getDashboard, p as listMasters } from "./api-B2R1vwTw.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/finance-B3UdZSmJ.js
var import_jsx_runtime = require_jsx_runtime();
function FinancePage() {
	const dash = useQuery({
		queryKey: ["dashboard"],
		queryFn: () => getDashboard()
	});
	const masters = useQuery({
		queryKey: ["masters"],
		queryFn: () => listMasters()
	});
	const f = dash.data?.finance;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6 p-4 md:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl",
				children: "Финансы"
			}),
			f ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						k: "Сегодня",
						v: formatSum(Number(f.today))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						k: "Неделя",
						v: formatSum(Number(f.week))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						k: "Месяц",
						v: formatSum(Number(f.month))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						k: "Средний чек",
						v: formatSum(Number(f.avg))
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Загрузка…"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted",
				children: ["Выплаты мастерам (70% чека): ", f ? formatSum(Number(f.payout)) : "—"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm text-muted",
					children: "Заработок по мастерам"
				}), (masters.data ?? []).map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between rounded-lg bg-surface px-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-sm",
						children: [
							m.first_name,
							" ",
							m.last_name
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-sm text-accent",
						children: formatSum(m.earnings)
					})]
				}, m.id))]
			})
		]
	});
}
function Card({ k, v }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "glass-card rounded-xl p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs text-muted",
			children: k
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 font-display text-xl",
			children: v
		})]
	});
}
//#endregion
export { FinancePage as component };
