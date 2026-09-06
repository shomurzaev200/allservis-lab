import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { m as listNotifications } from "./api-B2R1vwTw.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/notifications-BQbi3T2M.js
var import_jsx_runtime = require_jsx_runtime();
function NotificationsPage() {
	const { data = [], isPending } = useQuery({
		queryKey: ["notifications"],
		queryFn: () => listNotifications()
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4 p-4 md:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl",
				children: "Уведомления"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Новые заявки, отказы мастеров, смена статусов."
			})] }),
			isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Загрузка…"
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-2",
				children: data.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "glass-card rounded-xl p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs uppercase tracking-wider text-subtle",
								children: n.kind
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "mt-1 font-medium",
								children: n.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm text-muted",
								children: n.body
							})
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
							className: "shrink-0 font-mono text-xs text-subtle",
							children: new Date(n.created_at).toLocaleString("ru-RU")
						})]
					}), n.order_id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/admin/orders/$id",
						params: { id: String(n.order_id) },
						className: "mt-3 inline-block text-sm text-accent",
						children: "Открыть заявку"
					}) : null]
				}, n.id))
			})
		]
	});
}
//#endregion
export { NotificationsPage as component };
