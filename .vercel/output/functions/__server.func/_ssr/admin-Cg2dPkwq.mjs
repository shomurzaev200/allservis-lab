import { s as formatSum } from "./domain-zUVhUtxQ.mjs";
import { a as serviceById } from "./catalog-Cq__2iHb.mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { w as ArrowRight } from "../_libs/lucide-react.mjs";
import { o as getDashboard } from "./api-B2R1vwTw.mjs";
import { n as OrderBadge } from "./status-badge-BMr_179i.mjs";
import { n as SectionTitle, t as Kpi } from "./kpi-CslCcI8d.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-Cg2dPkwq.js
var import_jsx_runtime = require_jsx_runtime();
function Dashboard() {
	const { data, isPending } = useQuery({
		queryKey: ["dashboard"],
		queryFn: () => getDashboard()
	});
	if (isPending || !data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid gap-4 p-6 md:grid-cols-3",
		children: Array.from({ length: 6 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-28 animate-pulse rounded-xl bg-surface-2" }, i))
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6 p-4 md:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs uppercase tracking-wider text-accent",
					children: "All Servis Admin"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-1 font-display text-2xl",
					children: "Диспетчерская"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Автоназначения нет. Каждую заявку закрывает оператор."
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "grid gap-2 sm:grid-cols-4",
				children: [
					["Клиент", "Создаёт заявку в боте"],
					["Заявка", `${data.orders.waiting} ждут вас`],
					["Администратор", "Выбирает мастера вручную"],
					["Мастер", "Принимает или отказывается"]
				].map(([t, d], i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "glass-card relative rounded-xl p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-mono text-xs text-accent",
							children: ["0", i + 1]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 font-medium",
							children: t
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted",
							children: d
						}),
						i < 3 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "absolute -right-2 top-1/2 hidden size-4 -translate-y-1/2 text-subtle sm:block" }) : null
					]
				}, t))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Мастеров онлайн",
						value: data.masters.online,
						hint: `свободны ${data.masters.free} · всего ${data.masters.total}`,
						tone: "ok"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Клиентов",
						value: data.clients.active,
						hint: `сегодня +${data.clients.today} · повторные ${data.clients.returning}`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Заказов сегодня",
						value: data.orders.today,
						hint: `неделя ${data.orders.week} · всего ${data.orders.total}`,
						tone: "accent"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Выручка сегодня",
						value: formatSum(Number(data.finance.today)),
						hint: `средний чек ${formatSum(Number(data.finance.avg))}`
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Online",
						value: data.masters.online,
						hint: "на линии",
						tone: "ok"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Busy",
						value: data.masters.busy,
						hint: "есть активный заказ",
						tone: "warn"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Offline",
						value: data.masters.offline,
						hint: "нет heartbeat 2 мин"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Ожидают назначения",
						value: data.orders.waiting,
						tone: "warn"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Назначены",
						value: data.orders.assigned,
						tone: "accent"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "В работе",
						value: data.orders.work,
						tone: "ok"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Завершено",
						value: data.orders.done
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Отказы / отмены",
						value: `${data.orders.rejected} / ${data.orders.cancelled}`,
						tone: "danger"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 lg:grid-cols-[1.4fr_1fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "glass-card rounded-xl p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
						extra: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/admin/orders",
							className: "text-sm text-accent",
							children: "Все"
						}),
						children: "Последние заявки"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-2",
						children: data.recent.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/admin/orders/$id",
							params: { id: String(o.id) },
							className: "flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-3 transition-colors hover:bg-border",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-mono text-xs text-subtle",
									children: ["№", o.public_no]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "truncate text-sm",
									children: [
										o.client_name,
										" · ",
										serviceById(o.category_slug)?.title
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrderBadge, { status: o.status })]
						}, o.id))
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "glass-card rounded-xl p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
						extra: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/admin/notifications",
							className: "text-sm text-accent",
							children: "Лента"
						}),
						children: "Уведомления"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-2",
						children: data.notifications.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "py-8 text-center text-sm text-subtle",
							children: "Пока тихо"
						}) : data.notifications.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: "rounded-lg bg-surface-2 px-3 py-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm",
								children: n.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-0.5 text-xs text-muted",
								children: n.body
							})]
						}, n.id))
					})]
				})]
			})
		]
	});
}
//#endregion
export { Dashboard as component };
