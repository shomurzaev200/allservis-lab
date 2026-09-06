import { s as formatSum } from "./_ssr/domain-zUVhUtxQ.mjs";
import { a as serviceById } from "./_ssr/catalog-Cq__2iHb.mjs";
import { v as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, n as useQuery } from "./_libs/react+tanstack__react-query.mjs";
import { i as Route$3 } from "./_ssr/router-DOTwMh3n.mjs";
import { c as getMaster } from "./_ssr/api-B2R1vwTw.mjs";
import { n as OrderBadge, t as OnlineDot } from "./_ssr/status-badge-BMr_179i.mjs";
import { t as Kpi } from "./_ssr/kpi-CslCcI8d.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_id-DxsF5ZXN.js
var import_jsx_runtime = require_jsx_runtime();
function MasterCard() {
	const { id } = Route$3.useParams();
	const { data, isPending } = useQuery({
		queryKey: ["master", id],
		queryFn: () => getMaster({ data: Number(id) })
	});
	if (isPending || !data?.master) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "p-6 text-sm text-muted",
		children: "Загрузка…"
	});
	const m = data.master;
	const accept = m.accepted_orders + m.rejected_orders;
	const rate = accept ? Math.round(m.accepted_orders / accept * 100) : 0;
	const rej = accept ? Math.round(m.rejected_orders / accept * 100) : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-3xl space-y-6 p-4 md:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "font-display text-2xl",
						children: [
							m.first_name,
							" ",
							m.last_name
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [
							serviceById(m.specialization)?.title,
							" · ",
							m.city,
							" · ",
							m.district
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 font-mono text-xs text-subtle",
						children: [
							"TG ",
							m.telegram_id,
							" · ",
							m.phone
						]
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OnlineDot, { status: m.online_status })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Рейтинг",
						value: m.rating.toFixed(2),
						tone: "accent"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Завершено",
						value: m.completed_orders
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Принятие",
						value: `${rate}%`,
						hint: `отказы ${rej}%`,
						tone: "ok"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Заработок",
						value: formatSum(m.earnings)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Активных",
						value: m.active_orders,
						tone: "warn"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Среднее время",
						value: `${m.avg_minutes} мин`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Отмены",
						value: m.cancelled_orders
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-muted",
				children: [
					"Last seen: ",
					new Date(m.last_seen).toLocaleString("ru-RU"),
					" · регистрация",
					" ",
					new Date(m.registered_at).toLocaleDateString("ru-RU"),
					m.lat != null && m.lng != null ? ` · ${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}` : ""
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mb-2 text-sm text-muted",
				children: "История заказов"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-2",
				children: data.orders.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/admin/orders/$id",
					params: { id: String(o.id) },
					className: "flex items-center justify-between rounded-lg bg-surface px-3 py-2 hover:bg-surface-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-sm",
						children: [
							"№",
							o.public_no,
							" · ",
							o.client_name
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrderBadge, { status: o.status })]
				}, o.id))
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mb-2 text-sm text-muted",
				children: "Отзывы"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2",
				children: [data.reviews.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-subtle",
					children: "Пока нет оценок"
				}) : null, data.reviews.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "rounded-lg bg-surface px-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm",
						children: [
							r.rating,
							"/5 · ",
							r.client_name || "клиент",
							" · №",
							r.public_no
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: r.comment
					})]
				}, r.id))]
			})] })
		]
	});
}
//#endregion
export { MasterCard as component };
