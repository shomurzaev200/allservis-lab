import { o as __toESM } from "./_runtime.mjs";
import { s as formatSum } from "./_ssr/domain-zUVhUtxQ.mjs";
import { a as serviceById } from "./_ssr/catalog-Cq__2iHb.mjs";
import { n as require_react } from "./_libs/@radix-ui/react-compose-refs+[...].mjs";
import { v as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, i as useQueryClient, n as useQuery, t as useMutation } from "./_libs/react+tanstack__react-query.mjs";
import { n as Route$1 } from "./_ssr/router-DOTwMh3n.mjs";
import { l as getOrder, n as cancelOrder } from "./_ssr/api-B2R1vwTw.mjs";
import { n as OrderBadge, t as OnlineDot } from "./_ssr/status-badge-BMr_179i.mjs";
import { t as Button } from "./_ssr/button-PrOHLo0L.mjs";
import { t as AssignDialog } from "./_ssr/assign-dialog-ivRF0zth.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_id-B_wnTnUP.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var EVENT_LABEL = {
	created: "Заявка создана",
	geo: "Получена геолокация",
	photos: "Фотографии",
	assigned: "Администратор назначил мастера",
	master_accepted: "Мастер принял заказ",
	master_rejected: "Мастер отказался",
	enroute: "Мастер выехал",
	arrived: "Мастер прибыл",
	started: "Работа начата",
	in_progress: "Работа начата",
	completed: "Работа завершена",
	cancelled: "Отмена",
	reviewed: "Оценка клиента"
};
function OrderPage() {
	const { id } = Route$1.useParams();
	const orderId = Number(id);
	const qc = useQueryClient();
	const { data, isPending } = useQuery({
		queryKey: ["order", orderId],
		queryFn: () => getOrder({ data: orderId })
	});
	const [assign, setAssign] = (0, import_react.useState)(false);
	const cancel = useMutation({
		mutationFn: () => cancelOrder({ data: orderId }),
		onSuccess: () => qc.invalidateQueries()
	});
	if (isPending || !data?.order) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "p-6 text-sm text-muted",
		children: "Загрузка заявки…"
	});
	const o = data.order;
	const canAssign = o.status === "waiting_admin" || o.status === "master_rejected" || o.status === "assigned";
	let photos = [];
	try {
		const parsed = JSON.parse(o.photos);
		if (Array.isArray(parsed)) photos = parsed.filter((x) => typeof x === "string");
	} catch {
		photos = [];
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-4xl space-y-6 p-4 md:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-mono text-xs text-muted",
					children: ["№", o.public_no]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-2xl",
					children: o.client_name
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrderBadge, { status: o.status })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 md:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "glass-card rounded-xl p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-medium text-muted",
							children: "Клиент"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2",
							children: o.client_name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: o.phone
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm text-muted",
							children: ["Telegram: ", o.client_tg ?? "—"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm text-muted",
							children: ["Рейтинг клиента: ", o.client_rating.toFixed(1)]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm text-muted",
							children: ["Заявок в истории: ", data.clientOrders]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "glass-card rounded-xl p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-medium text-muted",
							children: "Заказ"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2",
							children: serviceById(o.category_slug)?.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm leading-relaxed",
							children: o.description
						}),
						o.comment ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-sm text-muted",
							children: ["Комментарий: ", o.comment]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-xs text-muted",
							children: [
								o.address,
								" · ",
								o.lat?.toFixed(4),
								", ",
								o.lng?.toFixed(4)
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 font-mono text-xs",
							children: formatSum(o.price)
						}),
						photos.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 flex gap-2",
							children: photos.map((src) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src,
								alt: "",
								className: "size-16 rounded-md object-cover"
							}, src.slice(0, 24)))
						}) : null
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "glass-card rounded-xl p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-medium text-muted",
						children: "Мастер"
					}),
					data.master ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/admin/masters/$id",
							params: { id: String(data.master.id) },
							className: "hover:text-accent",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
								data.master.first_name,
								" ",
								data.master.last_name
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm text-muted",
								children: [
									data.master.rating.toFixed(2),
									" · ",
									data.master.completed_orders,
									" заказов · ",
									data.master.phone
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OnlineDot, { status: data.master.online_status })]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "Ещё не назначен"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex flex-wrap gap-2",
						children: [canAssign ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							onClick: () => setAssign(true),
							children: o.status === "master_rejected" ? "Назначить другого мастера" : "Назначить мастера"
						}) : null, o.status !== "completed" && o.status !== "cancelled" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "outline",
							onClick: () => cancel.mutate(),
							children: "Отменить заявку"
						}) : null]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "glass-card rounded-xl p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-medium text-muted",
					children: "Timeline"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "mt-4 space-y-3",
					children: data.events.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex gap-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "w-16 shrink-0 font-mono text-xs text-accent",
							children: new Date(e.created_at).toLocaleTimeString("ru-RU", {
								hour: "2-digit",
								minute: "2-digit"
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: EVENT_LABEL[e.event_type] ?? e.event_type })]
					}, e.id))
				})]
			}),
			assign ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssignDialog, {
				orderId: o.id,
				publicNo: o.public_no,
				clientName: o.client_name,
				onClose: () => setAssign(false)
			}) : null
		]
	});
}
//#endregion
export { OrderPage as component };
